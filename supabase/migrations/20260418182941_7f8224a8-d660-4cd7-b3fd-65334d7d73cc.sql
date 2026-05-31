UPDATE public.impact_settings
SET manual_time_per_rdo = 45,
    system_time_per_rdo = 8,
    document_search_time = 60,
    updated_at = now()
WHERE company_id IS NULL;