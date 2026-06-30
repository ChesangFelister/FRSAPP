-- Issue status enum
CREATE TYPE public.issue_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE public.issue_priority AS ENUM ('low', 'medium', 'high');

CREATE TABLE public.maintenance_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  property_id UUID,
  unit_id UUID,
  caretaker_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority issue_priority NOT NULL DEFAULT 'medium',
  status issue_status NOT NULL DEFAULT 'open',
  photo_paths TEXT[] NOT NULL DEFAULT '{}',
  resolution_note TEXT,
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_issues ENABLE ROW LEVEL SECURITY;

-- Owners (landlords) full control
CREATE POLICY "Owners view own issues" ON public.maintenance_issues
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners update own issues" ON public.maintenance_issues
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own issues" ON public.maintenance_issues
  FOR DELETE USING (auth.uid() = owner_id);

-- Tenants can insert issues for their own tenant record + view + update (e.g. add notes) their own
CREATE POLICY "Tenants insert own issues" ON public.maintenance_issues
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid() AND t.owner_id = maintenance_issues.owner_id)
  );
CREATE POLICY "Tenants view own issues" ON public.maintenance_issues
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.user_id = auth.uid())
  );

-- Caretakers view & update issues assigned to them (caretaker linkage via caretakers.email = auth user email — keep simple: owner-only updates for now; caretakers read-only via owner UI)
-- Skipping caretaker auth role; landlord manages on caretaker's behalf.

CREATE INDEX idx_maintenance_issues_owner ON public.maintenance_issues(owner_id);
CREATE INDEX idx_maintenance_issues_tenant ON public.maintenance_issues(tenant_id);
CREATE INDEX idx_maintenance_issues_status ON public.maintenance_issues(status);

CREATE TRIGGER update_maintenance_issues_updated_at
  BEFORE UPDATE ON public.maintenance_issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for issue photos (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-photos', 'issue-photos', false)
  ON CONFLICT (id) DO NOTHING;

-- Path convention: {owner_id}/{tenant_id}/{filename}
CREATE POLICY "Owners read issue photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'issue-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Tenants read own issue photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'issue-photos'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.user_id = auth.uid() AND t.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Tenants upload own issue photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'issue-photos'
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.user_id = auth.uid() AND t.id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "Owners delete issue photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'issue-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
