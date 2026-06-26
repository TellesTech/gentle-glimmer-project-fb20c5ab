CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('uazapi-health-check-5min');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'uazapi-health-check-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jujzmxbexukxljljpefu.supabase.co/functions/v1/uazapi-health-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1anpteGJleHVreGxqbGpwZWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMzUyMTcsImV4cCI6MjA5NTgxMTIxN30.IhfZRgr7Xuex6w7Uz5gNKSV8mcNxYntufOefwiFj4kc'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);