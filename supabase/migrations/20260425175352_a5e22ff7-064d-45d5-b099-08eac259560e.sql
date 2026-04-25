-- Allow tenants to upload, view, update and delete their own lease documents
-- in the existing property-documents bucket, scoped to a tenant-uploads/{tenant_id}/ prefix.

CREATE POLICY "Tenants can view own lease documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-documents'
  AND (storage.foldername(name))[1] = 'tenant-uploads'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Landlords can view tenant lease documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'property-documents'
  AND (storage.foldername(name))[1] = 'tenant-uploads'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.owner_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Tenants can upload own lease documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-documents'
  AND (storage.foldername(name))[1] = 'tenant-uploads'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Tenants can update own lease documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'property-documents'
  AND (storage.foldername(name))[1] = 'tenant-uploads'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[2]
  )
);

CREATE POLICY "Tenants can delete own lease documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'property-documents'
  AND (storage.foldername(name))[1] = 'tenant-uploads'
  AND EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.user_id = auth.uid()
      AND t.id::text = (storage.foldername(name))[2]
  )
);
