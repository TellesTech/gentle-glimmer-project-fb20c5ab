
ALTER TABLE public.reports
ADD COLUMN is_emergency boolean DEFAULT false,
ADD COLUMN maintenance_order_number text,
ADD COLUMN maintenance_order_title text,
ADD COLUMN blockage_status text;
