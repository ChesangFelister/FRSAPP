-- =============================================================================
-- FRS Property Management System — Utility Modules Migration
-- Date: 2026-06-24
-- Modules: Power, Water, Waste, Inventory & Procurement
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE public.utility_type AS ENUM ('power', 'water', 'waste');
CREATE TYPE public.bill_status AS ENUM ('draft', 'approved', 'sent', 'paid', 'disputed');
CREATE TYPE public.pr_status AS ENUM ('draft', 'pending_approval', 'approved', 'rejected', 'ordered', 'received', 'cancelled');
CREATE TYPE public.stock_movement_type AS ENUM ('purchase', 'usage', 'adjustment', 'transfer', 'disposal');

-- ---------------------------------------------------------------------------
-- AUDIT LOGS  (cross-module, immutable)
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_logs (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID        NOT NULL,
  actor_id      UUID        NOT NULL,  -- auth.uid() who performed the action
  table_name    TEXT        NOT NULL,
  record_id     UUID,
  action        TEXT        NOT NULL,  -- INSERT | UPDATE | DELETE | APPROVE | REJECT | etc.
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_owner    ON public.audit_logs(owner_id);
CREATE INDEX idx_audit_logs_table    ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_actor    ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created  ON public.audit_logs(created_at DESC);

CREATE POLICY "Admins view all audit logs"   ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners view own audit logs"   ON public.audit_logs FOR SELECT USING (auth.uid() = owner_id);
-- No UPDATE / DELETE — audit log is immutable

-- Helper to write an audit entry (call from any security-definer function)
CREATE OR REPLACE FUNCTION public.write_audit_log(
  _owner_id   UUID,
  _table_name TEXT,
  _record_id  UUID,
  _action     TEXT,
  _old_data   JSONB DEFAULT NULL,
  _new_data   JSONB DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_logs (owner_id, actor_id, table_name, record_id, action, old_data, new_data)
  VALUES (_owner_id, COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'), _table_name, _record_id, _action, _old_data, _new_data);
END;
$$;
GRANT EXECUTE ON FUNCTION public.write_audit_log TO authenticated;

-- ---------------------------------------------------------------------------
-- NOTIFICATIONS  (in-app notification queue)
-- ---------------------------------------------------------------------------

CREATE TABLE public.notifications (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID        NOT NULL,
  recipient_id  UUID        NOT NULL,  -- auth.users.id of the target user
  title         TEXT        NOT NULL,
  body          TEXT,
  type          TEXT        NOT NULL DEFAULT 'info',  -- info | warning | alert | billing
  related_table TEXT,
  related_id    UUID,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, read_at);

CREATE POLICY "Recipients view own notifications"   ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Recipients mark read"                ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);
CREATE POLICY "Owners insert notifications"         ON public.notifications FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view all notifications"       ON public.notifications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- UTILITY RATES  (per-property configurable rates)
-- ---------------------------------------------------------------------------

CREATE TABLE public.utility_rates (
  id                UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id          UUID         NOT NULL,
  property_id       UUID         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  utility_type      public.utility_type NOT NULL,
  rate_per_unit     NUMERIC(12,4) NOT NULL DEFAULT 0,   -- KSh per kWh / m3 / month
  fixed_charge      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- standing charge added to each bill
  unit_label        TEXT         NOT NULL DEFAULT 'kWh', -- 'kWh', 'm³', 'month'
  effective_from    DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (property_id, utility_type, effective_from)
);

ALTER TABLE public.utility_rates ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_utility_rates_property ON public.utility_rates(property_id, utility_type);

CREATE POLICY "Owners view own utility rates"   ON public.utility_rates FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert utility rates"     ON public.utility_rates FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own utility rates" ON public.utility_rates FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own utility rates" ON public.utility_rates FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all utility rates"   ON public.utility_rates FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_utility_rates_updated_at
  BEFORE UPDATE ON public.utility_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- UTILITY BILLS  (one bill per tenant per period per utility type)
-- ---------------------------------------------------------------------------

CREATE TABLE public.utility_bills (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL,
  tenant_id       UUID        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id     UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id         UUID        REFERENCES public.units(id) ON DELETE SET NULL,
  utility_type    public.utility_type NOT NULL,
  period_month    INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INTEGER     NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  units_consumed  NUMERIC(12,4) NOT NULL DEFAULT 0,
  rate_per_unit   NUMERIC(12,4) NOT NULL DEFAULT 0,
  fixed_charge    NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due      NUMERIC(12,2) NOT NULL DEFAULT 0,  -- computed: (units_consumed * rate_per_unit) + fixed_charge
  amount_paid     NUMERIC(12,2) NOT NULL DEFAULT 0,
  status          public.bill_status NOT NULL DEFAULT 'draft',
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  due_date        DATE,
  paid_date       DATE,
  notes           TEXT,                               -- explanation for unusually high bills
  rent_payment_id UUID        REFERENCES public.rent_payments(id) ON DELETE SET NULL,  -- for bundled invoicing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, utility_type, period_year, period_month)
);

ALTER TABLE public.utility_bills ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_utility_bills_owner    ON public.utility_bills(owner_id);
CREATE INDEX idx_utility_bills_tenant   ON public.utility_bills(tenant_id);
CREATE INDEX idx_utility_bills_property ON public.utility_bills(property_id);
CREATE INDEX idx_utility_bills_period   ON public.utility_bills(period_year, period_month);
CREATE INDEX idx_utility_bills_type     ON public.utility_bills(utility_type);

-- Landlord policies
CREATE POLICY "Owners view own utility bills"   ON public.utility_bills FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert utility bills"     ON public.utility_bills FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own utility bills" ON public.utility_bills FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own utility bills" ON public.utility_bills FOR DELETE USING (auth.uid() = owner_id);
-- Tenant policies
CREATE POLICY "Tenants view own utility bills"  ON public.utility_bills FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = utility_bills.tenant_id AND t.user_id = auth.uid())
);
-- Admin policies
CREATE POLICY "Admins view all utility bills"   ON public.utility_bills FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all utility bills" ON public.utility_bills FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_utility_bills_updated_at
  BEFORE UPDATE ON public.utility_bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-compute amount_due
CREATE OR REPLACE FUNCTION public.compute_utility_bill_amount()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at  := now();
  NEW.amount_due  := ROUND((COALESCE(NEW.units_consumed, 0) * COALESCE(NEW.rate_per_unit, 0)) + COALESCE(NEW.fixed_charge, 0), 2);
  RETURN NEW;
END;
$$;

CREATE TRIGGER compute_utility_bill_amount_trg
  BEFORE INSERT OR UPDATE OF units_consumed, rate_per_unit, fixed_charge
  ON public.utility_bills
  FOR EACH ROW EXECUTE FUNCTION public.compute_utility_bill_amount();

-- Function to approve a utility bill (sets status, records approver)
CREATE OR REPLACE FUNCTION public.approve_utility_bill(_bill_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bill RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO bill FROM public.utility_bills WHERE id = _bill_id;
  IF bill IS NULL THEN RAISE EXCEPTION 'Bill not found'; END IF;

  -- Must be owner or admin
  IF bill.owner_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.utility_bills
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = _bill_id;

  PERFORM public.write_audit_log(bill.owner_id, 'utility_bills', _bill_id, 'APPROVE',
    jsonb_build_object('status', bill.status),
    jsonb_build_object('status', 'approved')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_utility_bill TO authenticated;

-- =============================================================================
-- MODULE 1: POWER MANAGEMENT
-- =============================================================================

CREATE TABLE public.power_meter_readings (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL,
  property_id     UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id         UUID        REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id       UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  meter_number    TEXT,
  period_month    INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year     INTEGER     NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  previous_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_reading  NUMERIC(12,2) NOT NULL DEFAULT 0,
  units_consumed   NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(current_reading - previous_reading, 0)) STORED,
  read_by         UUID,               -- user who captured the reading
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_path      TEXT,               -- optional photo of meter
  notes           TEXT,
  utility_bill_id UUID        REFERENCES public.utility_bills(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_year, period_month)
);

ALTER TABLE public.power_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_power_readings_owner    ON public.power_meter_readings(owner_id);
CREATE INDEX idx_power_readings_property ON public.power_meter_readings(property_id);
CREATE INDEX idx_power_readings_period   ON public.power_meter_readings(period_year, period_month);
CREATE INDEX idx_power_readings_unit     ON public.power_meter_readings(unit_id);

CREATE POLICY "Owners view own power readings"   ON public.power_meter_readings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert power readings"     ON public.power_meter_readings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own power readings" ON public.power_meter_readings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own power readings" ON public.power_meter_readings FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Tenants view own power readings"  ON public.power_meter_readings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = power_meter_readings.tenant_id AND t.user_id = auth.uid())
);
CREATE POLICY "Admins view all power readings"   ON public.power_meter_readings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_power_readings_updated_at
  BEFORE UPDATE ON public.power_meter_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: capture meter reading + auto-generate utility bill
CREATE OR REPLACE FUNCTION public.capture_power_reading(
  _owner_id        UUID,
  _property_id     UUID,
  _unit_id         UUID,
  _tenant_id       UUID,
  _period_month    INTEGER,
  _period_year     INTEGER,
  _previous        NUMERIC,
  _current         NUMERIC,
  _meter_number    TEXT    DEFAULT NULL,
  _notes           TEXT    DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reading_id  UUID;
  bill_id     UUID;
  rate_rec    RECORD;
  consumed    NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  consumed := GREATEST(_current - _previous, 0);

  -- Upsert meter reading
  INSERT INTO public.power_meter_readings (
    owner_id, property_id, unit_id, tenant_id, meter_number,
    period_month, period_year, previous_reading, current_reading,
    read_by, notes
  ) VALUES (
    _owner_id, _property_id, _unit_id, _tenant_id, _meter_number,
    _period_month, _period_year, _previous, _current,
    auth.uid(), _notes
  )
  ON CONFLICT (unit_id, period_year, period_month)
  DO UPDATE SET
    previous_reading = EXCLUDED.previous_reading,
    current_reading  = EXCLUDED.current_reading,
    meter_number     = COALESCE(EXCLUDED.meter_number, power_meter_readings.meter_number),
    notes            = COALESCE(EXCLUDED.notes, power_meter_readings.notes),
    read_by          = EXCLUDED.read_by,
    read_at          = now()
  RETURNING id INTO reading_id;

  -- Get applicable rate (most recent effective_from <= today)
  SELECT * INTO rate_rec
  FROM public.utility_rates
  WHERE property_id = _property_id
    AND utility_type = 'power'
    AND effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC
  LIMIT 1;

  -- Upsert utility bill
  INSERT INTO public.utility_bills (
    owner_id, tenant_id, property_id, unit_id,
    utility_type, period_month, period_year,
    units_consumed, rate_per_unit, fixed_charge, due_date
  ) VALUES (
    _owner_id, _tenant_id, _property_id, _unit_id,
    'power', _period_month, _period_year,
    consumed,
    COALESCE(rate_rec.rate_per_unit, 0),
    COALESCE(rate_rec.fixed_charge, 0),
    make_date(_period_year, _period_month, 15)
  )
  ON CONFLICT (tenant_id, utility_type, period_year, period_month)
  DO UPDATE SET
    units_consumed = EXCLUDED.units_consumed,
    rate_per_unit  = EXCLUDED.rate_per_unit,
    fixed_charge   = EXCLUDED.fixed_charge,
    updated_at     = now()
  RETURNING id INTO bill_id;

  -- Link bill back to reading
  UPDATE public.power_meter_readings SET utility_bill_id = bill_id WHERE id = reading_id;

  PERFORM public.write_audit_log(_owner_id, 'power_meter_readings', reading_id, 'INSERT',
    NULL, jsonb_build_object('consumed', consumed, 'bill_id', bill_id));

  RETURN reading_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.capture_power_reading TO authenticated;

-- =============================================================================
-- MODULE 2: WATER MANAGEMENT
-- =============================================================================

CREATE TABLE public.water_meter_readings (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id         UUID        NOT NULL,
  property_id      UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id          UUID        REFERENCES public.units(id) ON DELETE SET NULL,
  tenant_id        UUID        REFERENCES public.tenants(id) ON DELETE SET NULL,
  meter_number     TEXT,
  period_month     INTEGER     NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year      INTEGER     NOT NULL CHECK (period_year BETWEEN 2000 AND 2100),
  previous_reading NUMERIC(12,2) NOT NULL DEFAULT 0,
  current_reading  NUMERIC(12,2) NOT NULL DEFAULT 0,
  units_consumed   NUMERIC(12,2) GENERATED ALWAYS AS (GREATEST(current_reading - previous_reading, 0)) STORED,
  read_by          UUID,
  read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  photo_path       TEXT,
  notes            TEXT,
  utility_bill_id  UUID        REFERENCES public.utility_bills(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (unit_id, period_year, period_month)
);

ALTER TABLE public.water_meter_readings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_water_readings_owner    ON public.water_meter_readings(owner_id);
CREATE INDEX idx_water_readings_property ON public.water_meter_readings(property_id);
CREATE INDEX idx_water_readings_period   ON public.water_meter_readings(period_year, period_month);
CREATE INDEX idx_water_readings_unit     ON public.water_meter_readings(unit_id);

CREATE POLICY "Owners view own water readings"   ON public.water_meter_readings FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert water readings"     ON public.water_meter_readings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own water readings" ON public.water_meter_readings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own water readings" ON public.water_meter_readings FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Tenants view own water readings"  ON public.water_meter_readings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = water_meter_readings.tenant_id AND t.user_id = auth.uid())
);
CREATE POLICY "Admins view all water readings"   ON public.water_meter_readings FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_water_readings_updated_at
  BEFORE UPDATE ON public.water_meter_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mirror of capture_power_reading but for water
CREATE OR REPLACE FUNCTION public.capture_water_reading(
  _owner_id        UUID,
  _property_id     UUID,
  _unit_id         UUID,
  _tenant_id       UUID,
  _period_month    INTEGER,
  _period_year     INTEGER,
  _previous        NUMERIC,
  _current         NUMERIC,
  _meter_number    TEXT    DEFAULT NULL,
  _notes           TEXT    DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reading_id  UUID;
  bill_id     UUID;
  rate_rec    RECORD;
  consumed    NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  consumed := GREATEST(_current - _previous, 0);

  INSERT INTO public.water_meter_readings (
    owner_id, property_id, unit_id, tenant_id, meter_number,
    period_month, period_year, previous_reading, current_reading, read_by, notes
  ) VALUES (
    _owner_id, _property_id, _unit_id, _tenant_id, _meter_number,
    _period_month, _period_year, _previous, _current, auth.uid(), _notes
  )
  ON CONFLICT (unit_id, period_year, period_month)
  DO UPDATE SET
    previous_reading = EXCLUDED.previous_reading,
    current_reading  = EXCLUDED.current_reading,
    read_by          = EXCLUDED.read_by,
    read_at          = now(),
    notes            = COALESCE(EXCLUDED.notes, water_meter_readings.notes)
  RETURNING id INTO reading_id;

  SELECT * INTO rate_rec FROM public.utility_rates
  WHERE property_id = _property_id AND utility_type = 'water' AND effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC LIMIT 1;

  INSERT INTO public.utility_bills (
    owner_id, tenant_id, property_id, unit_id,
    utility_type, period_month, period_year,
    units_consumed, rate_per_unit, fixed_charge, due_date
  ) VALUES (
    _owner_id, _tenant_id, _property_id, _unit_id,
    'water', _period_month, _period_year,
    consumed,
    COALESCE(rate_rec.rate_per_unit, 0),
    COALESCE(rate_rec.fixed_charge, 0),
    make_date(_period_year, _period_month, 15)
  )
  ON CONFLICT (tenant_id, utility_type, period_year, period_month)
  DO UPDATE SET
    units_consumed = EXCLUDED.units_consumed,
    rate_per_unit  = EXCLUDED.rate_per_unit,
    fixed_charge   = EXCLUDED.fixed_charge,
    updated_at     = now()
  RETURNING id INTO bill_id;

  UPDATE public.water_meter_readings SET utility_bill_id = bill_id WHERE id = reading_id;

  PERFORM public.write_audit_log(_owner_id, 'water_meter_readings', reading_id, 'INSERT', NULL,
    jsonb_build_object('consumed', consumed, 'bill_id', bill_id));

  RETURN reading_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.capture_water_reading TO authenticated;

-- =============================================================================
-- MODULE 3: WASTE MANAGEMENT
-- =============================================================================

CREATE TABLE public.waste_service_providers (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID        NOT NULL,
  name          TEXT        NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  monthly_fee   NUMERIC(12,2) NOT NULL DEFAULT 0,
  contract_start DATE,
  contract_end   DATE,
  rating        INTEGER     CHECK (rating BETWEEN 1 AND 5),
  notes         TEXT,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waste_service_providers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_providers_owner ON public.waste_service_providers(owner_id);

CREATE POLICY "Owners view own waste providers"   ON public.waste_service_providers FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert waste providers"     ON public.waste_service_providers FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own waste providers" ON public.waste_service_providers FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own waste providers" ON public.waste_service_providers FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all waste providers"   ON public.waste_service_providers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_waste_providers_updated_at
  BEFORE UPDATE ON public.waste_service_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Waste collection schedules
CREATE TYPE public.collection_frequency AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');
CREATE TYPE public.collection_status AS ENUM ('scheduled', 'completed', 'missed', 'cancelled');

CREATE TABLE public.waste_collection_schedules (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL,
  property_id     UUID        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider_id     UUID        REFERENCES public.waste_service_providers(id) ON DELETE SET NULL,
  frequency       public.collection_frequency NOT NULL DEFAULT 'weekly',
  scheduled_date  DATE        NOT NULL,
  actual_date     DATE,
  status          public.collection_status NOT NULL DEFAULT 'scheduled',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.waste_collection_schedules ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_waste_schedules_owner    ON public.waste_collection_schedules(owner_id);
CREATE INDEX idx_waste_schedules_property ON public.waste_collection_schedules(property_id);
CREATE INDEX idx_waste_schedules_date     ON public.waste_collection_schedules(scheduled_date);

CREATE POLICY "Owners view own waste schedules"   ON public.waste_collection_schedules FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert waste schedules"     ON public.waste_collection_schedules FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own waste schedules" ON public.waste_collection_schedules FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own waste schedules" ON public.waste_collection_schedules FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all waste schedules"   ON public.waste_collection_schedules FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_waste_schedules_updated_at
  BEFORE UPDATE ON public.waste_collection_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: generate monthly waste bills for all active tenants of a property
CREATE OR REPLACE FUNCTION public.generate_waste_bills_for_property(
  _owner_id    UUID,
  _property_id UUID,
  _month       INTEGER,
  _year        INTEGER
) RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rate_rec    RECORD;
  inserted    INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _owner_id AND NOT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO rate_rec FROM public.utility_rates
  WHERE property_id = _property_id AND utility_type = 'waste' AND effective_from <= CURRENT_DATE
  ORDER BY effective_from DESC LIMIT 1;

  INSERT INTO public.utility_bills (
    owner_id, tenant_id, property_id, unit_id,
    utility_type, period_month, period_year,
    units_consumed, rate_per_unit, fixed_charge, due_date
  )
  SELECT
    t.owner_id, t.id, t.property_id, t.unit_id,
    'waste', _month, _year,
    1,  -- waste is flat fee: 1 unit * rate
    0,
    COALESCE(rate_rec.fixed_charge, 0),
    make_date(_year, _month, 15)
  FROM public.tenants t
  WHERE t.property_id = _property_id
    AND t.owner_id = _owner_id
    AND t.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.utility_bills ub
      WHERE ub.tenant_id = t.id
        AND ub.utility_type = 'waste'
        AND ub.period_month = _month
        AND ub.period_year  = _year
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
GRANT EXECUTE ON FUNCTION public.generate_waste_bills_for_property TO authenticated;

-- =============================================================================
-- MODULE 4: INVENTORY & PROCUREMENT
-- =============================================================================

-- Suppliers
CREATE TABLE public.suppliers (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id      UUID        NOT NULL,
  name          TEXT        NOT NULL,
  contact_name  TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  payment_terms TEXT,        -- e.g. "Net 30"
  notes         TEXT,
  active        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_suppliers_owner ON public.suppliers(owner_id);

CREATE POLICY "Owners view own suppliers"   ON public.suppliers FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert suppliers"     ON public.suppliers FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own suppliers" ON public.suppliers FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own suppliers" ON public.suppliers FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all suppliers"   ON public.suppliers FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inventory items register
CREATE TABLE public.inventory_items (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id          UUID        NOT NULL,
  property_id       UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  name              TEXT        NOT NULL,
  sku               TEXT,
  category          TEXT        NOT NULL DEFAULT 'general',  -- plumbing, electrical, cleaning, furniture, other
  unit_of_measure   TEXT        NOT NULL DEFAULT 'units',    -- units, kg, litres, metres
  quantity_on_hand  NUMERIC(12,2) NOT NULL DEFAULT 0,
  reorder_level     NUMERIC(12,2) NOT NULL DEFAULT 0,        -- low-stock alert threshold
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  location          TEXT,       -- where the item is stored
  supplier_id       UUID        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inventory_items_owner    ON public.inventory_items(owner_id);
CREATE INDEX idx_inventory_items_property ON public.inventory_items(property_id);
CREATE INDEX idx_inventory_items_category ON public.inventory_items(category);

CREATE POLICY "Owners view own inventory"   ON public.inventory_items FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert inventory"     ON public.inventory_items FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own inventory" ON public.inventory_items FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own inventory" ON public.inventory_items FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all inventory"   ON public.inventory_items FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Stock movements (immutable audit trail of every quantity change)
CREATE TABLE public.stock_movements (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL,
  item_id         UUID        NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type   public.stock_movement_type NOT NULL,
  quantity        NUMERIC(12,2) NOT NULL,           -- positive = in, negative = out
  quantity_before NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_after  NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_cost       NUMERIC(12,2),
  reference       TEXT,         -- PO number, maintenance issue id, etc.
  performed_by    UUID,         -- auth.users.id
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_stock_movements_owner ON public.stock_movements(owner_id);
CREATE INDEX idx_stock_movements_item  ON public.stock_movements(item_id);

CREATE POLICY "Owners view own stock movements"   ON public.stock_movements FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert stock movements"     ON public.stock_movements FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view all stock movements"   ON public.stock_movements FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
-- No UPDATE / DELETE — movements are immutable

-- Trigger to auto-update inventory_items.quantity_on_hand and record before/after
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item RECORD;
BEGIN
  SELECT * INTO item FROM public.inventory_items WHERE id = NEW.item_id FOR UPDATE;
  NEW.quantity_before := item.quantity_on_hand;
  NEW.quantity_after  := item.quantity_on_hand + NEW.quantity;
  NEW.performed_by    := COALESCE(NEW.performed_by, auth.uid());

  UPDATE public.inventory_items
  SET quantity_on_hand = NEW.quantity_after,
      updated_at       = now()
  WHERE id = NEW.item_id;

  -- Low-stock notification if quantity drops below reorder level
  IF NEW.quantity_after <= item.reorder_level AND item.reorder_level > 0 AND NEW.quantity < 0 THEN
    INSERT INTO public.notifications (owner_id, recipient_id, title, body, type, related_table, related_id)
    VALUES (
      item.owner_id, item.owner_id,
      'Low Stock Alert: ' || item.name,
      'Stock for "' || item.name || '" has dropped to ' || NEW.quantity_after::text || ' ' || item.unit_of_measure || ' (reorder level: ' || item.reorder_level::text || ').',
      'warning', 'inventory_items', item.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER apply_stock_movement_trg
  BEFORE INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- Purchase Requests
CREATE TABLE public.purchase_requests (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id        UUID        NOT NULL,
  property_id     UUID        REFERENCES public.properties(id) ON DELETE SET NULL,
  supplier_id     UUID        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  pr_number       TEXT        NOT NULL,  -- auto-generated e.g. PR-2026-001
  title           TEXT        NOT NULL,
  status          public.pr_status NOT NULL DEFAULT 'draft',
  requested_by    UUID        NOT NULL,
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  rejection_note  TEXT,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,  -- sum of line items
  expected_date   DATE,
  received_date   DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_purchase_requests_owner  ON public.purchase_requests(owner_id);
CREATE INDEX idx_purchase_requests_status ON public.purchase_requests(status);

CREATE POLICY "Owners view own PRs"   ON public.purchase_requests FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert PRs"     ON public.purchase_requests FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own PRs" ON public.purchase_requests FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own PRs" ON public.purchase_requests FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins view all PRs"   ON public.purchase_requests FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all PRs" ON public.purchase_requests FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_purchase_requests_updated_at
  BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PR Line Items
CREATE TABLE public.purchase_request_items (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_id           UUID        NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_id         UUID        REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description     TEXT        NOT NULL,
  quantity        NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cost      NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  received_qty    NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_pr_items_pr ON public.purchase_request_items(pr_id);

-- Inherit access from PR via join
CREATE POLICY "Owners view own PR items" ON public.purchase_request_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.owner_id = auth.uid()));
CREATE POLICY "Owners insert PR items"   ON public.purchase_request_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.owner_id = auth.uid()));
CREATE POLICY "Owners update PR items"   ON public.purchase_request_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.owner_id = auth.uid()));
CREATE POLICY "Owners delete PR items"   ON public.purchase_request_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = pr_id AND pr.owner_id = auth.uid()));
CREATE POLICY "Admins view all PR items" ON public.purchase_request_items FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger: keep purchase_requests.total_amount in sync
CREATE OR REPLACE FUNCTION public.sync_pr_total()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.purchase_requests
  SET total_amount = (SELECT COALESCE(SUM(total_cost), 0) FROM public.purchase_request_items WHERE pr_id = COALESCE(NEW.pr_id, OLD.pr_id)),
      updated_at   = now()
  WHERE id = COALESCE(NEW.pr_id, OLD.pr_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_pr_total_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.purchase_request_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_pr_total();

-- Function: approve PR + auto-book stock movement
CREATE OR REPLACE FUNCTION public.approve_purchase_request(_pr_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr   RECORD;
  item RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO pr FROM public.purchase_requests WHERE id = _pr_id;
  IF pr IS NULL THEN RAISE EXCEPTION 'PR not found'; END IF;
  IF pr.owner_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF pr.status NOT IN ('pending_approval') THEN
    RAISE EXCEPTION 'PR is not in pending_approval status';
  END IF;

  UPDATE public.purchase_requests
  SET status = 'approved', approved_by = auth.uid(), approved_at = now()
  WHERE id = _pr_id;

  PERFORM public.write_audit_log(pr.owner_id, 'purchase_requests', _pr_id, 'APPROVE',
    jsonb_build_object('status', pr.status),
    jsonb_build_object('status', 'approved'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_purchase_request TO authenticated;

-- Function: mark PR received + book stock in
CREATE OR REPLACE FUNCTION public.receive_purchase_request(_pr_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pr       RECORD;
  pri      RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO pr FROM public.purchase_requests WHERE id = _pr_id;
  IF pr IS NULL THEN RAISE EXCEPTION 'PR not found'; END IF;
  IF pr.owner_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF pr.status NOT IN ('approved', 'ordered') THEN
    RAISE EXCEPTION 'PR must be approved or ordered before receiving';
  END IF;

  UPDATE public.purchase_requests
  SET status = 'received', received_date = CURRENT_DATE
  WHERE id = _pr_id;

  -- Book stock in for items linked to inventory
  FOR pri IN SELECT * FROM public.purchase_request_items WHERE pr_id = _pr_id AND item_id IS NOT NULL LOOP
    INSERT INTO public.stock_movements (owner_id, item_id, movement_type, quantity, unit_cost, reference)
    VALUES (pr.owner_id, pri.item_id, 'purchase', pri.quantity, pri.unit_cost, pr.pr_number);
  END LOOP;

  PERFORM public.write_audit_log(pr.owner_id, 'purchase_requests', _pr_id, 'RECEIVE', NULL,
    jsonb_build_object('status', 'received'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.receive_purchase_request TO authenticated;

-- PR number sequence helper
CREATE OR REPLACE FUNCTION public.next_pr_number(_owner_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  seq INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(pr_number, '-', 3) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.purchase_requests
  WHERE owner_id = _owner_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM now());

  RETURN 'PR-' || EXTRACT(YEAR FROM now())::TEXT || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;
GRANT EXECUTE ON FUNCTION public.next_pr_number TO authenticated;

-- =============================================================================
-- pg_cron: auto-generate monthly waste bills (1st of month at 03:00 UTC)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-waste-bills') THEN
    PERFORM cron.unschedule('generate-monthly-waste-bills');
  END IF;
  -- Note: property-level loop handled by application triggering the function for each property
  -- The cron job below is a no-op placeholder; real invocation comes via Edge Function or app
END $$;

-- =============================================================================
-- VIEWS for convenience reporting
-- =============================================================================

-- Monthly utility summary per tenant
CREATE OR REPLACE VIEW public.v_tenant_utility_summary AS
SELECT
  ub.tenant_id,
  t.full_name    AS tenant_name,
  t.unit_label,
  p.name         AS property_name,
  ub.utility_type,
  ub.period_year,
  ub.period_month,
  ub.units_consumed,
  ub.amount_due,
  ub.amount_paid,
  ub.status,
  ub.due_date,
  ub.notes
FROM public.utility_bills ub
JOIN public.tenants t   ON t.id = ub.tenant_id
JOIN public.properties p ON p.id = ub.property_id;

-- Low stock items view
CREATE OR REPLACE VIEW public.v_low_stock_items AS
SELECT
  i.id, i.owner_id, i.name, i.sku, i.category,
  i.quantity_on_hand, i.reorder_level, i.unit_of_measure,
  i.unit_cost, i.location,
  p.name AS property_name,
  s.name AS supplier_name
FROM public.inventory_items i
LEFT JOIN public.properties p ON p.id = i.property_id
LEFT JOIN public.suppliers   s ON s.id = i.supplier_id
WHERE i.quantity_on_hand <= i.reorder_level AND i.reorder_level > 0;

-- Grant view access
GRANT SELECT ON public.v_tenant_utility_summary TO authenticated;
GRANT SELECT ON public.v_low_stock_items TO authenticated;
