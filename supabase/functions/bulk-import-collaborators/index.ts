import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-import-token',
};

interface Row { name: string; job_title: string; state: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(url, key);

    const body = await req.json().catch(() => ({}));
    const rows: Row[] = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) {
      return new Response(JSON.stringify({ error: 'rows vazio' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load existing names to skip duplicates
    const { data: existing } = await admin.from('profiles').select('name');
    const existingNames = new Set((existing ?? []).map((r: any) => (r.name || '').trim().toLowerCase()));

    const created: string[] = [];
    const skipped: string[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const row of rows) {
      const name = (row.name || '').trim();
      if (!name) continue;
      if (existingNames.has(name.toLowerCase())) { skipped.push(name); continue; }

      try {
        const collaboratorId = crypto.randomUUID();
        const fakeEmail = `collaborator-${collaboratorId.slice(0, 8)}@internal.local`;
        const randomPassword = crypto.randomUUID() + crypto.randomUUID();

        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: fakeEmail,
          password: randomPassword,
          email_confirm: true,
          user_metadata: { name, is_collaborator: true },
        });
        if (authError || !authData?.user) throw new Error(authError?.message || 'auth.createUser falhou');

        const update: Record<string, string> = { name };
        if (row.job_title) update.job_title = row.job_title;
        if (row.state) update.state = row.state;

        const { error: profErr } = await admin.from('profiles').update(update).eq('id', authData.user.id);
        if (profErr) throw new Error(`profile: ${profErr.message}`);

        created.push(name);
        existingNames.add(name.toLowerCase());
      } catch (e: any) {
        errors.push({ name, error: e.message || String(e) });
      }
    }

    return new Response(JSON.stringify({
      total: rows.length, created: created.length, skipped: skipped.length, errors: errors.length,
      skippedNames: skipped, errorDetails: errors,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});