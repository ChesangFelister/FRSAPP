-- Enable pg_cron + pg_net (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function: generate rent dues for a given month/year for ALL active tenants
CREATE OR REPLACE FUNCTION public.generate_monthly_rent_dues(
  _month integer DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::int,
  _year  integer DEFAULT EXTRACT(YEAR  FROM CURRENT_DATE)::int
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  INSERT INTO public.rent_payments (
    owner_id, tenant_id, property_id,
    period_month, period_year,
    amount_due, amount_paid, due_date, status
  )
  SELECT
    t.owner_id,
    t.id,
    t.property_id,
    _month,
    _year,
    COALESCE(t.monthly_rent_ksh, 0),
    0,
    make_date(_year, _month, 5),
    'pending'::payment_status
  FROM public.tenants t
  WHERE t.status = 'active'
    AND COALESCE(t.monthly_rent_ksh, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.rent_payments rp
      WHERE rp.tenant_id = t.id
        AND rp.period_month = _month
        AND rp.period_year  = _year
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Function: re-evaluate pending payments and flip to late if overdue
CREATE OR REPLACE FUNCTION public.refresh_overdue_rent_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.rent_payments
  SET status = 'late'
  WHERE status = 'pending'
    AND COALESCE(amount_paid, 0) = 0
    AND due_date < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Helper landlords can call to ensure THIS month's dues exist for their tenants
CREATE OR REPLACE FUNCTION public.ensure_current_month_dues_for_owner(_owner_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m integer := EXTRACT(MONTH FROM CURRENT_DATE)::int;
  y integer := EXTRACT(YEAR  FROM CURRENT_DATE)::int;
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _owner_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.rent_payments (
    owner_id, tenant_id, property_id,
    period_month, period_year,
    amount_due, amount_paid, due_date, status
  )
  SELECT
    t.owner_id, t.id, t.property_id,
    m, y,
    COALESCE(t.monthly_rent_ksh, 0),
    0,
    make_date(y, m, 5),
    'pending'::payment_status
  FROM public.tenants t
  WHERE t.owner_id = _owner_id
    AND t.status = 'active'
    AND COALESCE(t.monthly_rent_ksh, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.rent_payments rp
      WHERE rp.tenant_id = t.id
        AND rp.period_month = m
        AND rp.period_year  = y
    );

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

-- Allow authenticated users to call the owner-scoped helper
GRANT EXECUTE ON FUNCTION public.ensure_current_month_dues_for_owner(uuid) TO authenticated;

-- Schedule monthly dues generation: 1st of each month at 02:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-monthly-rent-dues') THEN
    PERFORM cron.unschedule('generate-monthly-rent-dues');
  END IF;
  PERFORM cron.schedule(
    'generate-monthly-rent-dues',
    '0 2 1 * *',
    $cron$ SELECT public.generate_monthly_rent_dues(); $cron$
  );

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-overdue-rent-payments') THEN
    PERFORM cron.unschedule('refresh-overdue-rent-payments');
  END IF;
  PERFORM cron.schedule(
    'refresh-overdue-rent-payments',
    '0 3 * * *',
    $cron$ SELECT public.refresh_overdue_rent_payments(); $cron$
  );
END $$;