-- Document category enum
CREATE TYPE public.document_category AS ENUM ('lease', 'inspection', 'certificate', 'other');

-- Documents table
CREATE TABLE public.property_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  category public.document_category NOT NULL DEFAULT 'other',
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_documents_property ON public.property_documents(property_id);

ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own property documents"
ON public.property_documents FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert property documents"
ON public.property_documents FOR INSERT
WITH CHECK (auth.uid() = owner_id AND EXISTS (
  SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()
));

CREATE POLICY "Owners update own property documents"
ON public.property_documents FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete own property documents"
ON public.property_documents FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER update_property_documents_updated_at
BEFORE UPDATE ON public.property_documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('property-documents', 'property-documents', false);

-- Storage policies: files stored under {owner_id}/{property_id}/{filename}
CREATE POLICY "Owners view own property document files"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners upload property document files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners update own property document files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete own property document files"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-documents' AND auth.uid()::text = (storage.foldername(name))[1]);