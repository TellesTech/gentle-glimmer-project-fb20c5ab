-- 1. Identify IDs for deletion
WITH ids_to_clean AS (
  SELECT id, 'profile' as type FROM public.profiles WHERE name = 'Lucas Rosa' AND email = 'lucasrosa.timenow@suzano.com.br'
  UNION ALL
  SELECT id, 'contact' as type FROM public.company_contacts WHERE name = 'Walace Rocha'
  UNION ALL
  SELECT id, 'client_profile' as type FROM public.client_profiles WHERE name = 'Walace Rocha'
)
SELECT * FROM ids_to_clean;

-- 2. Delete and fix roles (Lucas Rosa should be Client, Walace should be WEES)
-- We remove Lucas from internal profiles so he's only a client_profile/company_contact
DELETE FROM public.profiles WHERE name = 'Lucas Rosa' AND email = 'lucasrosa.timenow@suzano.com.br';

-- We remove Walace from client tables so he's only an internal profile
DELETE FROM public.company_contacts WHERE name = 'Walace Rocha';
DELETE FROM public.client_profiles WHERE name = 'Walace Rocha';

-- 3. Alex Manhães is an ad-hoc signer (no profile/contact found, only in report_signatures)
-- If he shouldn't be there, we'd remove him from future options by ensuring he's not in contacts.
-- Since he's not in contacts, he likely appeared because he signed once or was manually added.
-- The prompt says "Alex Manhães não deveria estar na assinatura", so we remove any pending approver record for him if any.
DELETE FROM public.report_client_approvers WHERE client_id IN (SELECT id FROM public.client_profiles WHERE name ILIKE '%Alex Manhaes%');
DELETE FROM public.report_company_approvers WHERE contact_id IN (SELECT id FROM public.company_contacts WHERE name ILIKE '%Alex Manhaes%');

-- 4. Verify results
SELECT name, email, 'profile' as source FROM public.profiles WHERE name IN ('Lucas Rosa', 'Walace Rocha', 'Alex Manhaes')
UNION ALL
SELECT name, email, 'contact' FROM public.company_contacts WHERE name IN ('Lucas Rosa', 'Walace Rocha', 'Alex Manhaes')
UNION ALL
SELECT name, email, 'client_profile' FROM public.client_profiles WHERE name IN ('Lucas Rosa', 'Walace Rocha', 'Alex Manhaes');
