-- ============= UNITS =============
CREATE TYPE public.unit_status AS ENUM ('vacant', 'occupied');

CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  status public.unit_status NOT NULL DEFAULT 'vacant',
  monthly_rent_ksh NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, label)
);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own units" ON public.units FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert units" ON public.units FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own units" ON public.units FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own units" ON public.units FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= TENANTS: link to unit + auth user =============
ALTER TABLE public.tenants ADD COLUMN unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL;
ALTER TABLE public.tenants ADD COLUMN user_id UUID;

-- Enforce unit owner matches tenant owner
CREATE OR REPLACE FUNCTION public.validate_tenant_unit_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.owner_id = NEW.owner_id
    ) THEN
      RAISE EXCEPTION 'Unit does not belong to this landlord account' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_tenant_unit_owner_trg
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_unit_owner();

-- Auto-update unit status based on tenant assignment
CREATE OR REPLACE FUNCTION public.sync_unit_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- old unit becomes vacant if no other active tenant
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.unit_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.unit_id = OLD.unit_id
        AND t.status = 'active'
        AND t.id <> COALESCE(NEW.id, OLD.id)
    ) THEN
      UPDATE public.units SET status = 'vacant' WHERE id = OLD.unit_id;
    END IF;
  END IF;
  -- new unit becomes occupied if tenant is active
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.unit_id IS NOT NULL AND NEW.status = 'active' THEN
    UPDATE public.units SET status = 'occupied' WHERE id = NEW.unit_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_unit_status_trg
  AFTER INSERT OR UPDATE OF unit_id, status OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.sync_unit_status();

-- Tenants can view their own tenant row
CREATE POLICY "Tenants view own record" ON public.tenants
  FOR SELECT USING (auth.uid() = user_id);

-- ============= TENANT INVITES =============
CREATE TABLE public.tenant_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  email TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  used_at TIMESTAMPTZ,
  used_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own invites" ON public.tenant_invites
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Function: tenant redeems invite -> assigns tenants.user_id, grants tenant role
CREATE OR REPLACE FUNCTION public.redeem_tenant_invite(_token TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  invite RECORD;
  tenant_record RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO invite FROM public.tenant_invites
  WHERE token = _token FOR UPDATE;

  IF invite IS NULL THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  IF invite.used_at IS NOT NULL THEN RAISE EXCEPTION 'Invite already used'; END IF;
  IF invite.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;

  SELECT * INTO tenant_record FROM public.tenants WHERE id = invite.tenant_id FOR UPDATE;
  IF tenant_record IS NULL THEN RAISE EXCEPTION 'Tenant record not found'; END IF;

  IF tenant_record.user_id IS NOT NULL AND tenant_record.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Tenant is already linked to another account';
  END IF;

  UPDATE public.tenants SET user_id = auth.uid() WHERE id = tenant_record.id;
  UPDATE public.tenant_invites SET used_at = now(), used_by_user_id = auth.uid() WHERE id = invite.id;

  -- Grant tenant role (if not already)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'tenant'::app_role)
  ON CONFLICT DO NOTHING;

  RETURN tenant_record.id;
END;
$$;

-- ============= RENT PAYMENTS: tenant access + payment intent =============
ALTER TABLE public.rent_payments ADD COLUMN submitted_at TIMESTAMPTZ;
ALTER TABLE public.rent_payments ADD COLUMN submitted_method TEXT;
ALTER TABLE public.rent_payments ADD COLUMN submitted_reference TEXT;

-- Tenants can view their own rent payments
CREATE POLICY "Tenants view own rent payments" ON public.rent_payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = rent_payments.tenant_id AND t.user_id = auth.uid())
  );

-- Tenants can submit a payment intent on their own rent payment (only update intent fields + notes)
CREATE OR REPLACE FUNCTION public.submit_rent_payment_intent(
  _payment_id UUID, _method TEXT, _reference TEXT, _note TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rent_payments rp
    JOIN public.tenants t ON t.id = rp.tenant_id
    WHERE rp.id = _payment_id AND t.user_id = auth.uid()
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'Not authorized for this payment'; END IF;

  UPDATE public.rent_payments
  SET submitted_at = now(),
      submitted_method = _method,
      submitted_reference = _reference,
      notes = COALESCE(NULLIF(_note,''), notes)
  WHERE id = _payment_id;
END;
$$;

-- Tenant balance helper
CREATE OR REPLACE FUNCTION public.tenant_outstanding_balance(_tenant_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0)
  FROM public.rent_payments
  WHERE tenant_id = _tenant_id AND status <> 'paid';
$$;