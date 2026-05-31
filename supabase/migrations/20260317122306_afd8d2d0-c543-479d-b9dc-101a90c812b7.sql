-- Fix the specific report history entry
UPDATE report_history 
SET details = jsonb_set(details, '{sender_name}', '"Kennedy Souza de Oliveira"') 
WHERE id = '7e2ea656-f143-4556-b3a5-d660161afb09';

-- Fix the report created_by
UPDATE reports 
SET created_by = '1aae028e-0b6c-48b2-afec-c8a3bc029a1f' 
WHERE id = '804f90ec-6f78-471f-a5ee-f7aedd0111fd' AND created_by IS NULL;

-- Fix the whatsapp log
UPDATE whatsapp_rdo_logs 
SET sender_name = 'Kennedy Souza de Oliveira' 
WHERE id = '01a51c19-c78a-468e-b064-b549daa86bc7';

-- Update Kennedy's phone in profiles so future lookups work
UPDATE profiles 
SET phone = '5527995004084' 
WHERE id = '1aae028e-0b6c-48b2-afec-c8a3bc029a1f' AND phone IS NULL;