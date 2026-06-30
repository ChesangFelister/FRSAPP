
-- WASTE
CREATE TABLE public.waste_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  contact text,
  phone text,
  email text,
  rating numeric(3,2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_providers TO authenticated;
GRANT ALL ON public.waste_providers TO service_role;
ALTER TABLE public.waste_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own waste providers" ON public.waste_providers
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admin reads waste providers" ON public.waste_providers
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_waste_providers_updated_at BEFORE UPDATE ON public.waste_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.waste_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES public.waste_providers(id) ON DELETE SET NULL,
  schedule text NOT NULL DEFAULT 'weekly',
  monthly_fee numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_services TO authenticated;
GRANT ALL ON public.waste_services TO service_role;
ALTER TABLE public.waste_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own waste services" ON public.waste_services
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Tenant reads waste service for own property" ON public.waste_services
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.property_id = waste_services.property_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admin reads waste services" ON public.waste_services
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_waste_services_updated_at BEFORE UPDATE ON public.waste_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.waste_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.waste_services(id) ON DELETE CASCADE,
  collected_on date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'completed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.waste_collections TO authenticated;
GRANT ALL ON public.waste_collections TO service_role;
ALTER TABLE public.waste_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own collections" ON public.waste_collections
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Tenant reads collections for own property" ON public.waste_collections
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.waste_services ws
      JOIN public.tenants t ON t.property_id = ws.property_id
      WHERE ws.id = waste_collections.service_id AND t.user_id = auth.uid()
    )
  );
CREATE POLICY "Admin reads collections" ON public.waste_collections
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- INVENTORY
CREATE TABLE public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  sku text,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  qty_on_hand numeric(14,3) NOT NULL DEFAULT 0,
  reorder_level numeric(14,3) NOT NULL DEFAULT 0,
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  category text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT ALL ON public.inventory_items TO service_role;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own inventory" ON public.inventory_items
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admin reads inventory" ON public.inventory_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('in','out','adjust')),
  qty numeric(14,3) NOT NULL,
  reason text,
  ref_id uuid,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own movements" ON public.stock_movements
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta numeric(14,3);
BEGIN
  delta := CASE NEW.movement_type
    WHEN 'in' THEN NEW.qty
    WHEN 'out' THEN -NEW.qty
    ELSE NEW.qty
  END;
  IF NEW.movement_type = 'adjust' THEN
    UPDATE public.inventory_items SET qty_on_hand = NEW.qty WHERE id = NEW.item_id;
  ELSE
    UPDATE public.inventory_items SET qty_on_hand = qty_on_hand + delta WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.qty_on_hand <= NEW.reorder_level AND (OLD.qty_on_hand IS DISTINCT FROM NEW.qty_on_hand)
     AND NEW.qty_on_hand < OLD.qty_on_hand THEN
    INSERT INTO public.notifications (user_id, owner_id, type, title, body, link)
    VALUES (NEW.owner_id, NEW.owner_id, 'low_stock',
            'Low stock: ' || NEW.name,
            'Item "' || NEW.name || '" is at or below reorder level (' || NEW.qty_on_hand || ' ' || NEW.unit || ').',
            '/landlord/inventory');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_low_stock AFTER UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- SUPPLIERS & PROCUREMENT
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  contact text,
  phone text,
  email text,
  rating numeric(3,2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own suppliers" ON public.suppliers
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  requester_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','fulfilled','cancelled')),
  notes text,
  total_estimate numeric(14,2) NOT NULL DEFAULT 0,
  approved_at timestamptz,
  approved_by uuid,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own PRs" ON public.purchase_requests
  FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.purchase_request_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.purchase_requests(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  description text,
  qty numeric(14,3) NOT NULL DEFAULT 1,
  est_unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_request_items TO authenticated;
GRANT ALL ON public.purchase_request_items TO service_role;
ALTER TABLE public.purchase_request_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Landlord manages own PR items" ON public.purchase_request_items
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = purchase_request_items.request_id AND pr.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.purchase_requests pr WHERE pr.id = purchase_request_items.request_id AND pr.owner_id = auth.uid())
  );

-- Helper: monthly waste bills for an owner
CREATE OR REPLACE FUNCTION public.ensure_current_month_waste_for_owner(_owner_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m integer := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  y integer := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _owner_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.utility_bills (
    owner_id, tenant_id, utility_type, period_month, period_year,
    rate, amount_due, due_date, status
  )
  SELECT
    t.owner_id, t.id, 'waste'::public.utility_type, m, y,
    ws.monthly_fee, ws.monthly_fee,
    make_date(y, m, 5), 'pending'::public.payment_status
  FROM public.tenants t
  JOIN public.waste_services ws
    ON ws.property_id = t.property_id AND ws.owner_id = t.owner_id AND ws.active = true
  WHERE t.owner_id = _owner_id
    AND t.status = 'active'
    AND ws.monthly_fee > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.utility_bills ub
      WHERE ub.tenant_id = t.id
        AND ub.utility_type = 'waste'
        AND ub.period_month = m AND ub.period_year = y
    );
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
