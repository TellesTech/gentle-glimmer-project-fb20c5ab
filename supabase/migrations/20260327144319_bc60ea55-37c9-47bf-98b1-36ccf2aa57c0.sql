DELETE FROM workforce_database wd1
WHERE wd1.report_id IS NULL
AND EXISTS (
  SELECT 1 FROM workforce_database wd2
  WHERE wd2.report_id IS NOT NULL
  AND UPPER(TRIM(wd2.worker_name)) = UPPER(TRIM(wd1.worker_name))
  AND wd2.date = wd1.date
  AND wd2.company_id = wd1.company_id
);