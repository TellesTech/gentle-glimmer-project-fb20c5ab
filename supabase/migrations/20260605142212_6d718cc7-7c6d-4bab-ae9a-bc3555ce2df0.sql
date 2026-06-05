CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.link_workforce_to_profiles()
RETURNS TABLE(
  source text,
  record_id uuid,
  nome_original text,
  nome_match text,
  profile_id uuid,
  nivel_match text,
  acao text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_match_id uuid;
  v_match_name text;
  v_match_count int;
  v_nivel text;
  v_norm text;
  v_first text;
  v_last text;
BEGIN
  -- Tabela temporária com profiles normalizados
  CREATE TEMP TABLE IF NOT EXISTS _profiles_norm ON COMMIT DROP AS
  SELECT
    p.id,
    p.name AS original_name,
    regexp_replace(lower(unaccent(coalesce(p.name,''))), '\s+', ' ', 'g') AS norm
  FROM public.profiles p
  WHERE p.name IS NOT NULL AND length(trim(p.name)) > 0;

  CREATE INDEX IF NOT EXISTS _profiles_norm_trgm ON _profiles_norm USING gin (norm gin_trgm_ops);

  FOR r IN
    SELECT ra.id, ra.user_name
    FROM public.report_attendance ra
    WHERE ra.user_id IS NULL
      AND ra.user_name IS NOT NULL
      AND length(trim(ra.user_name)) > 0
  LOOP
    v_norm := regexp_replace(lower(unaccent(trim(r.user_name))), '\s+', ' ', 'g');
    v_match_id := NULL;
    v_match_name := NULL;
    v_nivel := NULL;

    -- Nivel 1: exato
    SELECT count(*), max(pn.id), max(pn.original_name)
      INTO v_match_count, v_match_id, v_match_name
    FROM _profiles_norm pn
    WHERE pn.norm = v_norm;

    IF v_match_count = 1 THEN
      v_nivel := 'exato';
    ELSIF v_match_count > 1 THEN
      source := 'report_attendance'; record_id := r.id; nome_original := r.user_name;
      nome_match := NULL; profile_id := NULL; nivel_match := 'exato_multiplo'; acao := 'ambiguo';
      RETURN NEXT;
      CONTINUE;
    ELSE
      -- Nivel 2: primeiro + ultimo nome
      v_first := split_part(v_norm, ' ', 1);
      v_last := split_part(v_norm, ' ', greatest(array_length(string_to_array(v_norm,' '),1),1));

      IF v_first IS NOT NULL AND v_last IS NOT NULL AND v_first <> '' AND v_last <> '' AND v_first <> v_last THEN
        SELECT count(*), max(pn.id), max(pn.original_name)
          INTO v_match_count, v_match_id, v_match_name
        FROM _profiles_norm pn
        WHERE split_part(pn.norm,' ',1) = v_first
          AND split_part(pn.norm,' ', greatest(array_length(string_to_array(pn.norm,' '),1),1)) = v_last;

        IF v_match_count = 1 THEN
          v_nivel := 'primeiro_ultimo';
        ELSIF v_match_count > 1 THEN
          source := 'report_attendance'; record_id := r.id; nome_original := r.user_name;
          nome_match := NULL; profile_id := NULL; nivel_match := 'primeiro_ultimo_multiplo'; acao := 'ambiguo';
          RETURN NEXT;
          CONTINUE;
        END IF;
      END IF;

      -- Nivel 3: similaridade trigram >= 0.85
      IF v_nivel IS NULL THEN
        SELECT count(*) FILTER (WHERE similarity(pn.norm, v_norm) >= 0.85)
          INTO v_match_count
        FROM _profiles_norm pn;

        IF v_match_count = 1 THEN
          SELECT pn.id, pn.original_name INTO v_match_id, v_match_name
          FROM _profiles_norm pn
          WHERE similarity(pn.norm, v_norm) >= 0.85
          LIMIT 1;
          v_nivel := 'similaridade';
        ELSIF v_match_count > 1 THEN
          source := 'report_attendance'; record_id := r.id; nome_original := r.user_name;
          nome_match := NULL; profile_id := NULL; nivel_match := 'similaridade_multiplo'; acao := 'ambiguo';
          RETURN NEXT;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    IF v_nivel IS NOT NULL AND v_match_id IS NOT NULL THEN
      UPDATE public.report_attendance SET user_id = v_match_id WHERE id = r.id;
      source := 'report_attendance'; record_id := r.id; nome_original := r.user_name;
      nome_match := v_match_name; profile_id := v_match_id; nivel_match := v_nivel; acao := 'vinculado';
      RETURN NEXT;
    ELSE
      source := 'report_attendance'; record_id := r.id; nome_original := r.user_name;
      nome_match := NULL; profile_id := NULL; nivel_match := 'nenhum'; acao := 'sem_match';
      RETURN NEXT;
    END IF;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.link_workforce_to_profiles() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_workforce_to_profiles() TO service_role;