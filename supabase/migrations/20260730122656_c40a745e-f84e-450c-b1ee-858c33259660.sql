INSERT INTO public.whatsapp_group_projects (group_id, group_name, site_id, is_active)
SELECT '120363405308138203', 'RDO Portocel / WEES', '9105e564-648a-4e94-b57e-380852e6ba69', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_group_projects WHERE group_id = '120363405308138203'
);