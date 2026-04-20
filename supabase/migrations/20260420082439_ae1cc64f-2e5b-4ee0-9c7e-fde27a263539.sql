
-- Enums
CREATE TYPE public.property_type AS ENUM ('apartment', 'house', 'commercial', 'land', 'other');
CREATE TYPE public.property_status AS ENUM ('active', 'draft', 'archived');
CREATE TYPE public.tenant_status AS ENUM ('active', 'notice', 'ended');

-- Properties
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  property_type public.property_type NOT NULL DEFAULT 'apartment',
  units_count INTEGER NOT NULL DEFAULT 1,
  monthly_rent_ksh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status public.property_status NOT NULL DEFAULT 'active',
  description TEXT,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_properties_owner ON public.properties(owner_id);

CREATE POLICY "Owners view own properties" ON public.properties FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Active properties publicly viewable" ON public.properties FOR SELECT USING (status = 'active');
CREATE POLICY "Owners insert properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own properties" ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own properties" ON public.properties FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Property images (gallery)
CREATE TABLE public.property_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_property_images_property ON public.property_images(property_id);

CREATE POLICY "Property images publicly viewable" ON public.property_images FOR SELECT USING (true);
CREATE POLICY "Owners insert property images" ON public.property_images FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners update own property images" ON public.property_images FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY "Owners delete own property images" ON public.property_images FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

-- Tenants
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  unit_label TEXT,
  monthly_rent_ksh NUMERIC(12, 2) NOT NULL DEFAULT 0,
  lease_start DATE,
  lease_end DATE,
  status public.tenant_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tenants_owner ON public.tenants(owner_id);
CREATE INDEX idx_tenants_property ON public.tenants(property_id);

CREATE POLICY "Owners view own tenants" ON public.tenants FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert tenants" ON public.tenants FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own tenants" ON public.tenants FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own tenants" ON public.tenants FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for property images
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true);

CREATE POLICY "Property images publicly readable" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
CREATE POLICY "Authenticated can upload property images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own property images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own property images" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images' AND auth.uid()::text = (storage.foldername(name))[1]);
