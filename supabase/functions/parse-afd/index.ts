// Edge Function: parse-afd
// Parses AFD (Arquivo Fonte de Dados) per Portaria MTE 671/2021
// Layout 605: NSR(9) + TIPO(1) + DATA(8 ddmmaaaa) + HORA(4 hhmm) + PIS(12)
// Layout 671 alt: NSR(5) + TIPO(1) + DATA(8) + HORA(4) + PIS(11)
// We auto-detect by line length and TIPO position.

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ParsedPunch {
  nsr: number;
  punch_date: string; // YYYY-MM-DD
  punch_time: string; // HH:MM:SS
  punch_at: string;   // ISO with -03:00
  pis: string;
  raw_line: string;
}

interface ParsedHeader {
  employer_id: string | null;
  employer_name: string | null;
  raw: string;
}

function detectAndParse(lines: string[]): { header: ParsedHeader | null; punches: ParsedPunch[] } {
  let header: ParsedHeader | null = null;
  const punches: ParsedPunch[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r/g, '').trimEnd();
    if (!line) continue;

    // Try to find TIPO at common positions: pos 9 (NSR=9 digits) or pos 5 (NSR=5)
    let tipo = '';
    let nsrLen = 0;

    if (/^\d{9}\d/.test(line)) {
      tipo = line[9];
      nsrLen = 9;
    } else if (/^\d{5}\d/.test(line)) {
      tipo = line[5];
      nsrLen = 5;
    } else {
      continue;
    }

    if (tipo === '1' && !header) {
      // Header — try to extract employer info (positions vary; keep raw)
      // Layout 671: after NSR+TIPO comes TIPO_ID(1) + ID(14 CNPJ or 11 CPF) + CEI(12) + RAZAO(150)...
      const after = line.substring(nsrLen + 1);
      const tipoId = after[0]; // 1=CNPJ, 2=CPF
      const idLen = tipoId === '1' ? 14 : 11;
      const employerId = after.substring(1, 1 + idLen).replace(/^0+/, '') || null;
      // Skip CEI(12), then RAZAO 150
      const employerName = after.substring(1 + idLen + 12, 1 + idLen + 12 + 150).trim() || null;
      header = { employer_id: employerId, employer_name: employerName, raw: line };
      continue;
    }

    if (tipo === '3') {
      // Punch record
      const nsrStr = line.substring(0, nsrLen);
      const after = line.substring(nsrLen + 1); // skip NSR + TIPO
      const dataStr = after.substring(0, 8); // ddmmaaaa
      const horaStr = after.substring(8, 12); // hhmm
      const pisRaw = after.substring(12).trim();
      const pis = pisRaw.replace(/\D/g, '').replace(/^0+/, '').padStart(11, '0');

      if (!/^\d{8}$/.test(dataStr) || !/^\d{4}$/.test(horaStr) || pis.length < 11) continue;

      const dd = dataStr.substring(0, 2);
      const mm = dataStr.substring(2, 4);
      const yyyy = dataStr.substring(4, 8);
      const hh = horaStr.substring(0, 2);
      const min = horaStr.substring(2, 4);

      const punch_date = `${yyyy}-${mm}-${dd}`;
      const punch_time = `${hh}:${min}:00`;
      const punch_at = `${punch_date}T${punch_time}-03:00`;

      punches.push({
        nsr: parseInt(nsrStr, 10),
        punch_date,
        punch_time,
        punch_at,
        pis,
        raw_line: line,
      });
    }
  }

  return { header, punches };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabaseUser.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { fileContent, fileName, companyId, siteId } = body as {
      fileContent: string;
      fileName: string;
      companyId: string;
      siteId?: string | null;
    };

    if (!fileContent || !fileName || !companyId) {
      return new Response(JSON.stringify({ error: 'Parâmetros obrigatórios ausentes' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (fileContent.length > 5_500_000) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande (>5MB)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lines = fileContent.split('\n');
    const { header, punches } = detectAndParse(lines);

    if (punches.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma batida (tipo 3) encontrada no arquivo' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Resolve PIS → profile_id mapping
    const distinctPis = [...new Set(punches.map((p) => p.pis))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, pis')
      .in('pis', distinctPis);

    const pisToProfile = new Map<string, string>();
    for (const p of profiles || []) {
      if (p.pis) pisToProfile.set(p.pis, p.id);
    }

    const unmappedPis = distinctPis.filter((p) => !pisToProfile.has(p));

    // Period range
    const dates = punches.map((p) => p.punch_date).sort();
    const period_start = dates[0];
    const period_end = dates[dates.length - 1];
    const nsrs = punches.map((p) => p.nsr);
    const nsr_inicial = Math.min(...nsrs);
    const nsr_final = Math.max(...nsrs);

    // Insert import record
    const { data: importRow, error: importErr } = await supabaseAdmin
      .from('time_clock_imports')
      .insert({
        company_id: companyId,
        site_id: siteId || null,
        file_name: fileName,
        employer_id: header?.employer_id || null,
        employer_name: header?.employer_name || null,
        nsr_inicial,
        nsr_final,
        period_start,
        period_end,
        total_records: punches.length,
        unique_pis_count: distinctPis.length,
        unmapped_pis_count: unmappedPis.length,
        uploaded_by: userData.user.id,
        raw_header: header?.raw || null,
      })
      .select('id')
      .single();

    if (importErr || !importRow) {
      return new Response(JSON.stringify({ error: importErr?.message || 'Falha ao gravar importação' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert punches in batches of 500
    const batchSize = 500;
    const records = punches.map((p) => ({
      import_id: importRow.id,
      company_id: companyId,
      nsr: p.nsr,
      punch_at: p.punch_at,
      punch_date: p.punch_date,
      punch_time: p.punch_time,
      pis: p.pis,
      profile_id: pisToProfile.get(p.pis) || null,
      raw_line: p.raw_line,
    }));

    for (let i = 0; i < records.length; i += batchSize) {
      const slice = records.slice(i, i + batchSize);
      const { error: insErr } = await supabaseAdmin.from('time_clock_records').insert(slice);
      if (insErr) {
        return new Response(JSON.stringify({ error: `Falha ao gravar batidas: ${insErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        importId: importRow.id,
        summary: {
          totalPunches: punches.length,
          uniquePis: distinctPis.length,
          unmappedPis: unmappedPis.length,
          period: { start: period_start, end: period_end },
          unmappedPisList: unmappedPis,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('parse-afd error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
