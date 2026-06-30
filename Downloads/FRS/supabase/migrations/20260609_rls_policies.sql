-- RLS policies for properties, tenants, and leases
-- Generated: 2026-06-09
-- Note: adjust column names if your schema differs (owner_id, property_id, user_id)

-- PROPERTIES
ALTER TABLE IF EXISTS public.properties ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY IF NOT EXISTS properties_admin_all ON public.properties
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Landlord: select/insert/update/delete only on properties they own
CREATE POLICY IF NOT EXISTS properties_landlord_select ON public.properties
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS properties_landlord_insert ON public.properties
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS properties_landlord_update ON public.properties
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS properties_landlord_delete ON public.properties
  FOR DELETE
  USING (owner_id = auth.uid());

-- Tenant: allow tenants to view their assigned property
CREATE POLICY IF NOT EXISTS properties_tenant_self_select ON public.properties
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.property_id = public.properties.id AND t.user_id = auth.uid()
    )
  );

-- TENANTS
ALTER TABLE IF EXISTS public.tenants ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY IF NOT EXISTS tenants_admin_all ON public.tenants
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Landlord: access to tenants for properties they own
-- Assumes tenants.property_id references properties.id
CREATE POLICY IF NOT EXISTS tenants_landlord_property_owner_select ON public.tenants
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.tenants.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS tenants_landlord_property_owner_insert ON public.tenants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS tenants_landlord_property_owner_update ON public.tenants
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.tenants.property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS tenants_landlord_property_owner_delete ON public.tenants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.tenants.property_id AND p.owner_id = auth.uid()
    )
  );

-- Tenant: allow tenants to see/modify their own tenant row (by user_id)
CREATE POLICY IF NOT EXISTS tenants_self_select ON public.tenants
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS tenants_self_update ON public.tenants
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- LEASES (assumed table name: leases)
ALTER TABLE IF EXISTS public.leases ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS leases_admin_all ON public.leases
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

-- Landlord: access to leases for properties they own (assumes leases.property_id)
CREATE POLICY IF NOT EXISTS leases_landlord_property_owner_select ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.leases.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS leases_landlord_property_owner_insert ON public.leases
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS leases_landlord_property_owner_update ON public.leases
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.leases.property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS leases_landlord_property_owner_delete ON public.leases
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.leases.property_id AND p.owner_id = auth.uid()
    )
  );

-- Tenant: allow tenants to see their own lease (assumes leases.tenant_id -> tenants.id and tenants.user_id)
CREATE POLICY IF NOT EXISTS leases_tenant_self_select ON public.leases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.id = public.leases.tenant_id AND t.user_id = auth.uid()
    )
  );

-- UNITS
ALTER TABLE IF EXISTS public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS units_admin_all ON public.units
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY IF NOT EXISTS units_landlord_property_owner_select ON public.units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.units.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS units_landlord_property_owner_insert ON public.units
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS units_landlord_property_owner_update ON public.units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.units.property_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = new.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS units_landlord_property_owner_delete ON public.units
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p WHERE p.id = public.units.property_id AND p.owner_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS units_tenant_self_select ON public.units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants t WHERE t.unit_id = public.units.id AND t.user_id = auth.uid()
    )
  );

-- RENT PAYMENTS
ALTER TABLE IF EXISTS public.rent_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS rent_payments_admin_all ON public.rent_payments
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY IF NOT EXISTS rent_payments_landlord_owner_select ON public.rent_payments
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS rent_payments_landlord_owner_insert ON public.rent_payments
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS rent_payments_landlord_owner_update ON public.rent_payments
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS rent_payments_landlord_owner_delete ON public.rent_payments
  FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS rent_payments_tenant_self_select ON public.rent_payments
  FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM public.tenants t WHERE t.user_id = auth.uid()
    )
  );

-- MAINTENANCE ISSUES
ALTER TABLE IF EXISTS public.maintenance_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS maintenance_issues_admin_all ON public.maintenance_issues
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY IF NOT EXISTS maintenance_issues_landlord_owner_select ON public.maintenance_issues
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS maintenance_issues_landlord_owner_insert ON public.maintenance_issues
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS maintenance_issues_landlord_owner_update ON public.maintenance_issues
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS maintenance_issues_landlord_owner_delete ON public.maintenance_issues
  FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS maintenance_issues_tenant_self_select ON public.maintenance_issues
  FOR SELECT
  USING (
    tenant_id = (
      SELECT id FROM public.tenants t WHERE t.user_id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS maintenance_issues_tenant_insert ON public.maintenance_issues
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = new.tenant_id
        AND t.user_id = auth.uid()
        AND t.owner_id = new.owner_id
    )
  );

-- CARETAKERS
ALTER TABLE IF EXISTS public.caretakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS caretakers_admin_all ON public.caretakers
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY IF NOT EXISTS caretakers_landlord_owner_select ON public.caretakers
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS caretakers_landlord_owner_insert ON public.caretakers
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS caretakers_landlord_owner_update ON public.caretakers
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS caretakers_landlord_owner_delete ON public.caretakers
  FOR DELETE
  USING (owner_id = auth.uid());

-- RECEIPT SETTINGS
ALTER TABLE IF EXISTS public.receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS receipt_settings_admin_all ON public.receipt_settings
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE POLICY IF NOT EXISTS receipt_settings_landlord_owner_select ON public.receipt_settings
  FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY IF NOT EXISTS receipt_settings_landlord_owner_upsert ON public.receipt_settings
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Prevent non-admins from modifying owner_id on properties
-- This policy ensures checks on updates/inserts already enforce owner_id = auth.uid() for landlords.

-- Notes:
-- 1) If your column names differ (e.g. `landlord_id` instead of `owner_id`), update the SQL accordingly.
-- 2) Review `user_roles` table shape: this SQL expects `user_roles(user_id, role)`.
-- 3) Apply via the Supabase SQL editor or `supabase db push` / `psql` against your DB.
