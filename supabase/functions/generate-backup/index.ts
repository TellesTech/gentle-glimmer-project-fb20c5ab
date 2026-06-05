import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tables in order of dependency (parents first)
const TABLE_ORDER = [
  'system_settings',
  'tenant_settings',
  'client_portal_settings',
  'companies',
  'company_contacts',
  'contact_sites',
  'sites',
  'site_responsibles',
  'portal_admin_access',
  'profiles',
  'user_roles',
  'client_profiles',
  'client_companies',
  'client_sites',
  'client_user_roles',
  'teams',
  'team_members',
  'projects',
  'project_stages',
  'project_tasks',
  'project_equipment',
  'project_milestones',
  'project_members',
  'reports',
  'report_activities',
  'report_activity_steps',
  'report_attendance',
  'report_deviations',
  'report_equipment',
  'report_photos',
  'report_signatures',
  'report_company_approvers',
  'report_client_approvers',
  'service_reports',
  'service_report_sections',
  'service_report_photos',
  'notifications',
  'feature_suggestions',
  'suggestion_votes',
  'delay_reason_options'
];

// File sources mapping for downloading actual files
const FILE_SOURCES = [
  { table: 'companies', column: 'logo_url', bucket: 'company-photos', folder: 'company-photos' },
  { table: 'companies', column: 'photo_url', bucket: 'company-photos', folder: 'company-photos' },
  { table: 'sites', column: 'photo_url', bucket: 'company-photos', folder: 'company-photos' },
  { table: 'projects', column: 'photo_url', bucket: 'project-photos', folder: 'project-photos' },
  { table: 'profiles', column: 'avatar_url', bucket: 'avatars', folder: 'avatars' },
  { table: 'feature_suggestions', column: 'screenshot_url', bucket: 'suggestion-screenshots', folder: 'suggestion-screenshots' },
  { table: 'service_report_photos', column: 'url', bucket: 'service-report-photos', folder: 'service-report-photos' },
  { table: 'reports', column: 'signed_pdf_url', bucket: 'service-report-photos', folder: 'signed-report-pdfs' },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Não autorizado');

    const token = authHeader.replace('Bearer ', '');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const isServiceCall = token === serviceRoleKey;

    let targetCompanyId: string | null = null;
    let userEmail: string | null = null;
    let isSuperAdmin = false;

    if (isServiceCall) {
      isSuperAdmin = true;
      userEmail = 'system@scheduled-backup';
    } else {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) throw new Error('Usuário não autenticado');

      userEmail = user.email;
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single();
      const { data: userRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();

      const allowedRoles = ['admin', 'director', 'super_admin'];
      if (!userRole || !allowedRoles.includes(userRole.role)) throw new Error('Sem permissão');

      isSuperAdmin = userRole.role === 'super_admin';
      targetCompanyId = isSuperAdmin && !profile?.company_id ? null : profile?.company_id;
    }

    const { tables, categories, includePhotos, startDate, endDate } = await req.json();
    const zip = new JSZip();
    const dataFolder = zip.folder('data');
    
    const manifest: Record<string, any> = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      createdBy: userEmail,
      companyId: targetCompanyId || 'all',
      tables: [],
      recordCounts: {},
    };

    const orderedTables = TABLE_ORDER.filter(t => tables.includes(t));
    
    async function fetchAllRows(baseQuery: any): Promise<any[]> {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await baseQuery.range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return allData;
    }

    for (const tableName of orderedTables) {
      try {
        let buildQuery = () => supabase.from(tableName).select('*');

        if (targetCompanyId) {
          if (['companies'].includes(tableName)) {
            buildQuery = () => supabase.from(tableName).select('*').eq('id', targetCompanyId);
          } else if (['sites', 'projects', 'profiles', 'company_contacts'].includes(tableName)) {
            buildQuery = () => supabase.from(tableName).select('*').eq('company_id', targetCompanyId);
          } else if (['teams'].includes(tableName)) {
            const { data: projectIds } = await supabase.from('projects').select('id').eq('company_id', targetCompanyId);
            if (projectIds && projectIds.length > 0) {
              buildQuery = () => supabase.from(tableName).select('*').in('project_id', projectIds.map(p => p.id));
            } else continue;
          } else if (['reports'].includes(tableName)) {
            const { data: projectIds } = await supabase.from('projects').select('id').eq('company_id', targetCompanyId);
            if (projectIds && projectIds.length > 0) {
              buildQuery = () => {
                let q = supabase.from(tableName).select('*').in('project_id', projectIds.map(p => p.id));
                if (startDate) q = q.gte('date', startDate);
                if (endDate) q = q.lte('date', endDate);
                return q;
              };
            } else continue;
          }
        }

        if (!targetCompanyId && tableName === 'reports') {
          const origBuild = buildQuery;
          buildQuery = () => {
            let q = origBuild();
            if (startDate) q = q.gte('date', startDate);
            if (endDate) q = q.lte('date', endDate);
            return q;
          };
        }

        const data = await fetchAllRows(buildQuery());
        if (data && data.length > 0) {
          dataFolder?.file(`${tableName}.json`, JSON.stringify(data, null, 2));
          manifest.tables.push(tableName);
          manifest.recordCounts[tableName] = data.length;
        }
      } catch (tableError) {
        console.error(`Error processing ${tableName}:`, tableError);
      }
    }

    const fileMetadata: Record<string, Array<{id: string, url: string, bucket: string, folder: string}>> = {};
    if (includePhotos) {
      for (const source of FILE_SOURCES) {
        try {
          let query = supabase.from(source.table).select(`id, ${source.column}`);
          if (targetCompanyId) {
            if (source.table === 'companies') query = query.eq('id', targetCompanyId);
            else if (['sites', 'projects', 'profiles'].includes(source.table)) query = query.eq('company_id', targetCompanyId);
            else if (source.table === 'report_photos') {
              const { data: projectIds } = await supabase.from('projects').select('id').eq('company_id', targetCompanyId);
              if (projectIds && projectIds.length > 0) {
                const { data: reportIds } = await supabase.from('reports').select('id').in('project_id', projectIds.map(p => p.id));
                if (reportIds && reportIds.length > 0) query = query.in('report_id', reportIds.map(r => r.id));
                else continue;
              } else continue;
            }
          }
          const { data: records } = await query;
          if (records && records.length > 0) {
            if (!fileMetadata[source.folder]) fileMetadata[source.folder] = [];
            for (const record of records as any[]) {
              const url = record[source.column as keyof typeof record];
              if (url) fileMetadata[source.folder].push({ id: record.id, url, bucket: source.bucket, folder: source.folder });
            }
          }
        } catch (e) { console.error(e); }
      }
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    const zipContent = await zip.generateAsync({ type: 'base64' });
    
    return new Response(JSON.stringify({
      success: true,
      fileContent: zipContent,
      manifest,
      fileMetadata: includePhotos ? fileMetadata : null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
