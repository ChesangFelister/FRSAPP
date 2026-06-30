
CREATE TYPE public.utility_type AS ENUM ('power','water','waste');

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  owner_id uuid,
  entity text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  diff jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR actor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  owner_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Create notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() OR user_id = auth.uid());

CREATE TABLE public.utility_meters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  utility_type public.utility_type NOT NULL,
  identifier text NOT NULL,
  rate_per_unit numeric(12,4) NOT NULL DEFAULT 0,
  unit_label text NOT NULL DEFAULT 'unit',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_meters TO authenticated;
GRANT ALL ON public.utility_meters TO service_role;
ALTER TABLE public.utility_meters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own meters" ON public.utility_meters
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Tenant reads own unit meters" ON public.utility_meters
  FOR SELECT TO authenticated USING (
    unit_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.unit_id = utility_meters.unit_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin reads all meters" ON public.utility_meters
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_utility_meters_updated_at BEFORE UPDATE ON public.utility_meters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.utility_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id uuid NOT NULL REFERENCES public.utility_meters(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  reading_date date NOT NULL DEFAULT CURRENT_DATE,
  value numeric(14,3) NOT NULL,
  captured_by uuid,
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_readings_meter_date ON public.utility_readings(meter_id, reading_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_readings TO authenticated;
GRANT ALL ON public.utility_readings TO service_role;
ALTER TABLE public.utility_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own readings" ON public.utility_readings
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Tenant reads own readings" ON public.utility_readings
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.utility_meters m
      JOIN public.tenants t ON t.unit_id = m.unit_id
      WHERE m.id = utility_readings.meter_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin reads all readings" ON public.utility_readings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.utility_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  meter_id uuid REFERENCES public.utility_meters(id) ON DELETE SET NULL,
  utility_type public.utility_type NOT NULL,
  period_month integer NOT NULL,
  period_year integer NOT NULL,
  prev_reading numeric(14,3),
  curr_reading numeric(14,3),
  consumption numeric(14,3),
  rate numeric(12,4) NOT NULL DEFAULT 0,
  amount_due numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  status public.payment_status NOT NULL DEFAULT 'pending',
  notes text,
  approved_at timestamptz,
  approved_by uuid,
  published_at timestamptz,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_utility_bills_owner ON public.utility_bills(owner_id, utility_type, period_year, period_month);
CREATE INDEX idx_utility_bills_tenant ON public.utility_bills(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_bills TO authenticated;
GRANT ALL ON public.utility_bills TO service_role;
ALTER TABLE public.utility_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own utility bills" ON public.utility_bills
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Tenant reads own utility bills" ON public.utility_bills
  FOR SELECT TO authenticated USING (
    tenant_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = utility_bills.tenant_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin reads all utility bills" ON public.utility_bills
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.compute_utility_bill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.curr_reading IS NOT NULL AND NEW.prev_reading IS NOT NULL THEN
    NEW.consumption = GREATEST(NEW.curr_reading - NEW.prev_reading, 0);
  END IF;
  IF NEW.consumption IS NOT NULL AND NEW.rate IS NOT NULL THEN
    NEW.amount_due = ROUND(NEW.consumption * NEW.rate, 2);
  END IF;
  IF NEW.amount_paid >= NEW.amount_due AND NEW.amount_due > 0 THEN
    NEW.status = 'paid';
  ELSIF NEW.amount_paid > 0 AND NEW.amount_paid < NEW.amount_due THEN
    NEW.status = 'partial';
  ELSIF NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE AND COALESCE(NEW.amount_paid,0) = 0 THEN
    NEW.status = 'late';
  ELSE
    NEW.status = COALESCE(NEW.status, 'pending');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_utility_bills_compute BEFORE INSERT OR UPDATE ON public.utility_bills
  FOR EACH ROW EXECUTE FUNCTION public.compute_utility_bill();
