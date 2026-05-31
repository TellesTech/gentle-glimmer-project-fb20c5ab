
-- Add slug column to sites
ALTER TABLE public.sites ADD COLUMN slug text;

-- Create unique index on slug scoped per company
CREATE UNIQUE INDEX idx_sites_slug_company ON public.sites (company_id, slug) WHERE slug IS NOT NULL;

-- Populate slugs for existing sites
UPDATE public.sites SET slug = generate_slug(name) WHERE slug IS NULL;
