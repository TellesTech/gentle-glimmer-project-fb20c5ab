
-- Add slug column to companies
ALTER TABLE public.companies ADD COLUMN slug text;

-- Create unique index on slug
CREATE UNIQUE INDEX idx_companies_slug ON public.companies (slug) WHERE slug IS NOT NULL;

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        translate(
          input_text,
          'àáâãäåèéêëìíîïòóôõöùúûüýÿñçÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÑÇ',
          'aaaaaaeeeeiiiioooooouuuuyyncAAAAAAEEEEIIIIOOOOOUUUUYYNC'
        ),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
$$;

-- Populate slugs for existing companies
UPDATE public.companies SET slug = generate_slug(name) WHERE slug IS NULL;
