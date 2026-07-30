UPDATE public.reports
SET maintenance_order_title = NULL
WHERE maintenance_order_title IS NOT NULL
  AND location IS NOT NULL
  AND lower(trim(maintenance_order_title)) = lower(trim(location));