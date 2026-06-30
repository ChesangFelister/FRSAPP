-- Status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'late', 'partial');

-- Rent payments table
CREATE TABLE public.rent_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INTEGER NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  amount_due NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  paid_date DATE,
  status public.payment_status NOT NULL DEFAULT 'pending',
  method TEXT,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period_year, period_month)
);

CREATE INDEX idx_rent_payments_owner ON public.rent_payments(owner_id);
CREATE INDEX idx_rent_payments_tenant ON public.rent_payments(tenant_id);
CREATE INDEX idx_rent_payments_property ON public.rent_payments(property_id);

ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own rent payments" ON public.rent_payments
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert rent payments" ON public.rent_payments
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own rent payments" ON public.rent_payments
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own rent payments" ON public.rent_payments
  FOR DELETE USING (auth.uid() = owner_id);

-- Auto status + updated_at trigger
CREATE OR REPLACE FUNCTION public.compute_rent_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.amount_paid >= NEW.amount_due AND NEW.amount_due > 0 THEN
    NEW.status = 'paid';
    IF NEW.paid_date IS NULL THEN
      NEW.paid_date = CURRENT_DATE;
    END IF;
  ELSIF NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount_due THEN
    NEW.status = 'partial';
  ELSIF NEW.due_date < CURRENT_DATE AND COALESCE(NEW.amount_paid, 0) = 0 THEN
    NEW.status = 'late';
  ELSE
    NEW.status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER compute_rent_payment_status_trg
BEFORE INSERT OR UPDATE ON public.rent_payments
FOR EACH ROW EXECUTE FUNCTION public.compute_rent_payment_status();

-- Validate tenant ownership
CREATE OR REPLACE FUNCTION public.validate_rent_payment_tenant_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = NEW.tenant_id AND t.owner_id = NEW.owner_id
  ) THEN
    RAISE EXCEPTION 'Tenant does not belong to this landlord account'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_rent_payment_tenant_owner_trg
BEFORE INSERT OR UPDATE OF tenant_id, owner_id ON public.rent_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_rent_payment_tenant_owner();