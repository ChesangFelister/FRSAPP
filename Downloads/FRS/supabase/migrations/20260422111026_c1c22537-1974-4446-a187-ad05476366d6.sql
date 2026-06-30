-- Caretakers managed by a landlord (contacts), independent of auth users
CREATE TABLE public.caretakers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.caretakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own caretakers" ON public.caretakers
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert caretakers" ON public.caretakers
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update own caretakers" ON public.caretakers
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners delete own caretakers" ON public.caretakers
  FOR DELETE USING (auth.uid() = owner_id);

CREATE TRIGGER update_caretakers_updated_at
BEFORE UPDATE ON public.caretakers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Assign caretaker to property
ALTER TABLE public.properties
  ADD COLUMN caretaker_id UUID REFERENCES public.caretakers(id) ON DELETE SET NULL;

CREATE INDEX idx_properties_caretaker_id ON public.properties(caretaker_id);
CREATE INDEX idx_caretakers_owner_id ON public.caretakers(owner_id);