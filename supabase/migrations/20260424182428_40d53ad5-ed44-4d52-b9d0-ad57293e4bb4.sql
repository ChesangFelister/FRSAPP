CREATE TABLE public.receipt_settings (
  owner_id UUID NOT NULL PRIMARY KEY,
  business_name TEXT,
  address TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receipt_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own receipt settings" ON public.receipt_settings
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert own receipt settings" ON public.receipt_settings
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own receipt settings" ON public.receipt_settings
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own receipt settings" ON public.receipt_settings
  FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_receipt_settings_updated_at
  BEFORE UPDATE ON public.receipt_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public) VALUES ('receipt-logos', 'receipt-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Receipt logos publicly viewable" ON storage.objects
  FOR SELECT USING (bucket_id = 'receipt-logos');
CREATE POLICY "Owners upload own receipt logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'receipt-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners update own receipt logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'receipt-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Owners delete own receipt logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'receipt-logos' AND auth.uid()::text = (storage.foldername(name))[1]);