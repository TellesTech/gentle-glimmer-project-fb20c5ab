import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BucketStats {
  count: number;
  size: number;
  formatted: string;
}

interface CategoryStats {
  records: number;
  tables: number;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // === Count records for each category ===
    const categories: Record<string, CategoryStats> = {};

    // Settings category
    const { count: systemSettingsCount } = await supabase.from('system_settings').select('*', { count: 'exact', head: true });
    categories.settings = { records: systemSettingsCount || 0, tables: 1 };

    // Companies category
    const { count: companiesCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
    const { count: sitesCount } = await supabase.from('sites').select('*', { count: 'exact', head: true });
    const { count: contactsCount } = await supabase.from('company_contacts').select('*', { count: 'exact', head: true });
    const { count: siteResponsiblesCount } = await supabase.from('site_responsibles').select('*', { count: 'exact', head: true });
    categories.companies = { 
      records: (companiesCount || 0) + (sitesCount || 0) + (contactsCount || 0) + (siteResponsiblesCount || 0), 
      tables: 4 
    };

    // Projects category
    const { count: projectsCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
    const { count: stagesCount } = await supabase.from('project_stages').select('*', { count: 'exact', head: true });
    const { count: tasksCount } = await supabase.from('project_tasks').select('*', { count: 'exact', head: true });
    const { count: equipmentCount } = await supabase.from('project_equipment').select('*', { count: 'exact', head: true });
    const { count: milestonesCount } = await supabase.from('project_milestones').select('*', { count: 'exact', head: true });
    const { count: membersCount } = await supabase.from('project_members').select('*', { count: 'exact', head: true });
    categories.projects = { 
      records: (projectsCount || 0) + (stagesCount || 0) + (tasksCount || 0) + (equipmentCount || 0) + (milestonesCount || 0) + (membersCount || 0), 
      tables: 6 
    };

    // Teams category
    const { count: profilesCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { count: rolesCount } = await supabase.from('user_roles').select('*', { count: 'exact', head: true });
    const { count: teamsCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
    const { count: teamMembersCount } = await supabase.from('team_members').select('*', { count: 'exact', head: true });
    categories.teams = { 
      records: (profilesCount || 0) + (rolesCount || 0) + (teamsCount || 0) + (teamMembersCount || 0), 
      tables: 4 
    };

    // Reports category
    const { count: reportsCount } = await supabase.from('reports').select('*', { count: 'exact', head: true });
    const { count: activitiesCount } = await supabase.from('report_activities').select('*', { count: 'exact', head: true });
    const { count: activityStepsCount } = await supabase.from('report_activity_steps').select('*', { count: 'exact', head: true });
    const { count: attendanceCount } = await supabase.from('report_attendance').select('*', { count: 'exact', head: true });
    const { count: deviationsCount } = await supabase.from('report_deviations').select('*', { count: 'exact', head: true });
    const { count: reportEquipmentCount } = await supabase.from('report_equipment').select('*', { count: 'exact', head: true });
    const { count: photosCount } = await supabase.from('report_photos').select('*', { count: 'exact', head: true });
    const { count: signaturesCount } = await supabase.from('report_signatures').select('*', { count: 'exact', head: true });
    categories.reports = { 
      records: (reportsCount || 0) + (activitiesCount || 0) + (activityStepsCount || 0) + (attendanceCount || 0) + (deviationsCount || 0) + (reportEquipmentCount || 0) + (photosCount || 0) + (signaturesCount || 0), 
      tables: 8 
    };

    // Reports PDF category - count only RDOs for PDF generation
    categories.reports_pdf = {
      records: reportsCount || 0,
      tables: 0
    };

    // Signed PDFs category - count reports with signed_pdf_url
    const { count: signedDocsCount } = await supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .not('signed_pdf_url', 'is', null);

    categories.signed_pdfs = {
      records: signedDocsCount || 0,
      tables: 0
    };

    // === Get storage stats ===
    const buckets = [
      { id: 'company-photos', label: 'Logos de Empresas' },
      { id: 'project-photos', label: 'Fotos de Projetos' },
      { id: 'avatars', label: 'Avatares' },
      { id: 'suggestion-screenshots', label: 'Screenshots de Sugestões' },
      { id: 'service-report-photos', label: 'Fotos de RDOs' },
    ];

    const breakdown: Record<string, BucketStats & { label: string }> = {};
    let totalFiles = 0;
    let totalSize = 0;

    for (const bucket of buckets) {
      try {
        const { data: files, error } = await supabase.storage
          .from(bucket.id)
          .list('', { limit: 10000 });

        if (error) {
          console.log(`Error listing ${bucket.id}:`, error.message);
          continue;
        }

        if (!files || files.length === 0) continue;

        let bucketSize = 0;
        let fileCount = 0;

        for (const file of files) {
          if (file.id === null) continue;
          const fileSize = file.metadata?.size || 0;
          bucketSize += fileSize;
          fileCount++;
        }

        if (fileCount > 0) {
          breakdown[bucket.id] = {
            label: bucket.label,
            count: fileCount,
            size: bucketSize,
            formatted: formatFileSize(bucketSize),
          };
          totalFiles += fileCount;
          totalSize += bucketSize;
        }
      } catch (err) {
        console.error(`Error processing bucket ${bucket.id}:`, err);
      }
    }

    const result = {
      categories,
      storage: {
        totalFiles,
        totalSize,
        totalSizeFormatted: formatFileSize(totalSize),
        breakdown,
      }
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
