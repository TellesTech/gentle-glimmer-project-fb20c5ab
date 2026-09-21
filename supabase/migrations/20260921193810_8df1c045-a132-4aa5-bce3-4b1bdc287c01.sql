delete from public.client_user_roles where client_id in (select id from public.client_profiles where email='lucasrosa.timenow@suzano.com.br');
delete from public.client_sites where client_id in (select id from public.client_profiles where email='lucasrosa.timenow@suzano.com.br');
delete from public.client_companies where client_id in (select id from public.client_profiles where email='lucasrosa.timenow@suzano.com.br');
delete from public.client_profiles where email='lucasrosa.timenow@suzano.com.br';