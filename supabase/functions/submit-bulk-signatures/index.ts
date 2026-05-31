import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkItem {
  reportId: string;
  accessId?: string | null;
  documentHash?: string | null;
  documentVersion?: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      items,
      signatureData,
      signerName,
      signerRole,
      signerEmail,
      signerUserId,
      geolocation,
    }: {
      items: BulkItem[];
      signatureData: string;
      signerName: string;
      signerRole?: string;
      signerEmail?: string;
      signerUserId?: string;
      geolocation?: any;
    } = await req.json();

    if (!Array.isArray(items) || items.length === 0 || !signatureData || !signerName) {
      return new Response(
        JSON.stringify({ error: 'items[], signatureData and signerName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const results: Array<{ reportId: string; ok: boolean; signatureId?: string; error?: string }> = [];
    let totalCoins = 0;

    for (const item of items) {
      try {
        // Resolve or create access record if not provided
        let accessId = item.accessId ?? null;
        if (!accessId) {
          const { data: access, error: accessErr } = await supabase
            .from('client_report_access')
            .insert({
              report_id: item.reportId,
              client_name: signerName,
              client_email: signerEmail ?? null,
              created_by: signerUserId ?? null,
            })
            .select('id')
            .single();
          if (accessErr || !access) {
            results.push({ reportId: item.reportId, ok: false, error: accessErr?.message ?? 'access creation failed' });
            continue;
          }
          accessId = access.id;
        }

        // Skip if already signed for this access
        const { data: existing } = await supabase
          .from('report_signatures')
          .select('id')
          .eq('access_id', accessId)
          .maybeSingle();
        if (existing) {
          results.push({ reportId: item.reportId, ok: false, error: 'already signed' });
          continue;
        }

        const { data: sig, error: sigErr } = await supabase
          .from('report_signatures')
          .insert({
            report_id: item.reportId,
            access_id: accessId,
            signature_data: signatureData,
            signer_name: signerName,
            signer_role: signerRole || null,
            signer_email: signerEmail || null,
            signer_user_id: signerUserId || null,
            document_hash: item.documentHash || null,
            document_version: item.documentVersion || null,
            geolocation: geolocation || null,
            ip_address: ipAddress,
            user_agent: userAgent,
            legal_basis: 'MP 2.200-2/2001',
          })
          .select('id')
          .single();

        if (sigErr || !sig) {
          results.push({ reportId: item.reportId, ok: false, error: sigErr?.message ?? 'insert failed' });
          continue;
        }

        // Coin amount is determined by the DB trigger; we estimate for the toast
        const { data: report } = await supabase
          .from('reports')
          .select('date')
          .eq('id', item.reportId)
          .maybeSingle();
        const isLate = report?.date && (Date.now() - new Date(report.date).getTime()) > 7 * 24 * 60 * 60 * 1000;
        totalCoins += isLate ? 15 : 10;

        results.push({ reportId: item.reportId, ok: true, signatureId: sig.id });
      } catch (e: any) {
        results.push({ reportId: item.reportId, ok: false, error: e?.message ?? 'unknown error' });
      }
    }

    const successCount = results.filter(r => r.ok).length;

    return new Response(
      JSON.stringify({ success: true, successCount, totalCoins, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('submit-bulk-signatures error:', error);
    return new Response(
      JSON.stringify({ error: error?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
