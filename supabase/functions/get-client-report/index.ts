import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accessToken, reportId } = await req.json();
    
    if (!accessToken && !reportId) {
      return new Response(
        JSON.stringify({ error: 'Access token or report ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let targetReportId: string;
    let accessData: any = null;

    if (accessToken) {
      console.log('Fetching report for access token:', accessToken);

      // Validate the access token
      const { data: access, error: accessError } = await supabase
        .from('client_report_access')
        .select('*')
        .eq('access_token', accessToken)
        .single();

      if (accessError || !access) {
        console.error('Access token not found:', accessError);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired access link' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if link has expired
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        console.log('Access link expired');
        return new Response(
          JSON.stringify({ error: 'This access link has expired' }),
          { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      accessData = access;
      targetReportId = access.report_id;
    } else {
      console.log('Fetching report by ID:', reportId);
      targetReportId = reportId;
    }

    // Fetch the full report with all related data
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select(`
        *,
        project:projects(*, site:sites(*, company:companies(*))),
        team:teams(*),
        creator:profiles!created_by(id, name),
        approver:profiles!approved_by(id, name),
        activities:report_activities(*),
        deviations:report_deviations(*),
        attendance:report_attendance(*),
        photos:report_photos(*)
      `)
      .eq('id', targetReportId)
      .single();

    if (reportError || !report) {
      console.error('Report not found:', reportError);
      return new Response(
        JSON.stringify({ error: 'Report not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing signatures for this report
    const { data: signatures } = await supabase
      .from('report_signatures')
      .select('*')
      .eq('report_id', targetReportId)
      .order('signed_at', { ascending: false });

    // Try to find client profile by email
    let clientProfile = null;
    if (accessData?.client_email) {
      const { data: profile } = await supabase
        .from('client_profiles')
        .select('*')
        .eq('email', accessData.client_email.toLowerCase().trim())
        .maybeSingle();
      
      clientProfile = profile;
      console.log('Client profile found:', profile ? 'yes' : 'no');
    }

    console.log('Report fetched successfully');

    return new Response(
      JSON.stringify({
        report,
        accessInfo: accessData ? {
          id: accessData.id,
          clientName: accessData.client_name,
          clientCompany: accessData.client_company,
          clientEmail: accessData.client_email,
        } : null,
        signatures: signatures || [],
        clientProfile,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-client-report:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
