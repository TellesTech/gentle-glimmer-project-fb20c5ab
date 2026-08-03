DO $$
DECLARE
    r RECORD;
    primary_id UUID;
    duplicate_id UUID;
    v_table_exists BOOLEAN;
BEGIN
    FOR r IN (
        SELECT project_id, date, shift, ARRAY_AGG(id ORDER BY created_at ASC) as ids
        FROM public.reports
        GROUP BY project_id, date, shift
        HAVING COUNT(*) > 1
    ) LOOP
        primary_id := r.ids[1];
        
        FOR i IN 2..ARRAY_LENGTH(r.ids, 1) LOOP
            duplicate_id := r.ids[i];
            
            -- Move records from related tables to primary report
            
            -- report_photos
            UPDATE public.report_photos SET report_id = primary_id WHERE report_id = duplicate_id;
            
            -- report_attendance
            UPDATE public.report_attendance SET report_id = primary_id WHERE report_id = duplicate_id;
            
            -- report_deviations
            UPDATE public.report_deviations SET report_id = primary_id WHERE report_id = duplicate_id;
            
            -- service_report_sections (if exists)
            SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_report_sections') INTO v_table_exists;
            IF v_table_exists THEN
                UPDATE public.service_report_sections SET report_id = primary_id WHERE report_id = duplicate_id;
            END IF;

            -- whatsapp_rdo_logs (links)
            UPDATE public.whatsapp_rdo_logs SET report_id = primary_id WHERE report_id = duplicate_id;

            -- Delete the duplicate report
            DELETE FROM public.reports WHERE id = duplicate_id;
        END LOOP;
    END LOOP;
END $$;