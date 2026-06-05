import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: authError } = await supabase.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (authError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // Use service role for aggregate queries
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parallel count queries
    const [
      reportsRes,
      projectsRes,
      profilesRes,
      companiesRes,
      activitiesRes,
      photosRes,
      deviationsRes,
      sitesRes,
    ] = await Promise.all([
      adminClient.from('reports').select('id', { count: 'exact', head: true }),
      adminClient.from('projects').select('id', { count: 'exact', head: true }),
      adminClient.from('profiles').select('id', { count: 'exact', head: true }),
      adminClient.from('companies').select('id', { count: 'exact', head: true }),
      adminClient.from('report_activities').select('id', { count: 'exact', head: true }),
      adminClient.from('report_photos').select('id', { count: 'exact', head: true }),
      adminClient.from('report_deviations').select('id', { count: 'exact', head: true }),
      adminClient.from('sites').select('id', { count: 'exact', head: true }),
    ]);

    // DQ Score: check completeness of key fields
    const { data: projectsDQ } = await adminClient
      .from('projects')
      .select('start_date, end_date, description, progress, code, status');

    const { data: profilesDQ } = await adminClient
      .from('profiles')
      .select('name, email, company_id, phone, job_title');

    const { data: companiesDQ } = await adminClient
      .from('companies')
      .select('name, cnpj, email, phone, address');

    const calculateDQ = (rows: any[] | null, fields: string[]) => {
      if (!rows || rows.length === 0) return 100;
      let filled = 0;
      const total = rows.length * fields.length;
      for (const row of rows) {
        for (const f of fields) {
          if (row[f] !== null && row[f] !== '' && row[f] !== undefined) filled++;
        }
      }
      return Math.round((filled / total) * 100);
    };

    const dqScores = {
      projects: calculateDQ(projectsDQ, ['start_date', 'end_date', 'description', 'progress', 'code', 'status']),
      profiles: calculateDQ(profilesDQ, ['name', 'email', 'company_id', 'phone', 'job_title']),
      companies: calculateDQ(companiesDQ, ['name', 'cnpj', 'email', 'phone', 'address']),
    };

    const globalDQ = Math.round(
      (dqScores.projects + dqScores.profiles + dqScores.companies) / 3
    );

    // Anomalies
    const { data: anomalies } = await adminClient
      .from('projects')
      .select('id, name, progress')
      .eq('status', 'in_progress')
      .lte('progress', 0);

    // Reports per day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentReports } = await adminClient
      .from('reports')
      .select('date')
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    const reportsPerDay: Record<string, number> = {};
    if (recentReports) {
      for (const r of recentReports) {
        reportsPerDay[r.date] = (reportsPerDay[r.date] || 0) + 1;
      }
    }

    // Corrections log table was removed from schema; report 0.
    const correctionsCount = 0;

    return new Response(JSON.stringify({
      counts: {
        reports: reportsRes.count || 0,
        projects: projectsRes.count || 0,
        profiles: profilesRes.count || 0,
        companies: companiesRes.count || 0,
        activities: activitiesRes.count || 0,
        photos: photosRes.count || 0,
        deviations: deviationsRes.count || 0,
        sites: sitesRes.count || 0,
      },
      dqScores,
      globalDQ,
      anomalies: anomalies || [],
      reportsPerDay,
      correctionsCount: correctionsCount || 0,
      timestamp: new Date().toISOString(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
