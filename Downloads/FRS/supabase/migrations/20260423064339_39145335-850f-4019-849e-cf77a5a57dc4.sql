-- Ensure caretaker assigned to a property belongs to the same owner
CREATE OR REPLACE FUNCTION public.validate_property_caretaker_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.caretaker_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.caretakers c
      WHERE c.id = NEW.caretaker_id
        AND c.owner_id = NEW.owner_id
    ) THEN
      RAISE EXCEPTION 'Caretaker does not belong to this landlord account'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_property_caretaker_owner_trg ON public.properties;
CREATE TRIGGER validate_property_caretaker_owner_trg
BEFORE INSERT OR UPDATE OF caretaker_id, owner_id ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.validate_property_caretaker_owner();