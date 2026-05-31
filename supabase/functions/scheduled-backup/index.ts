import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, scheduleId, filePath } = body;

    if (action === 'check_drive') {
      const hasCredentials = !!Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
      return new Response(
        JSON.stringify({ hasDriveCredentials: hasCredentials }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auth check for manual triggers
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
      
      if (userId) {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();
        
        const allowedRoles = ['admin', 'director', 'super_admin'];
        if (!userRole || !allowedRoles.includes(userRole.role)) {
          throw new Error('Sem permissão');
        }
      }
    }

    if (action === 'run_now') {
      // Manual trigger of a scheduled backup
      const { data: schedule, error: scheduleError } = await supabase
        .from('backup_schedules')
        .select('*')
        .eq('id', scheduleId)
        .single();

      if (scheduleError || !schedule) {
        throw new Error('Agendamento não encontrado');
      }

      // Create history entry
      const { data: history, error: historyError } = await supabase
        .from('backup_history')
        .insert({
          schedule_id: schedule.id,
          status: 'running',
          company_id: schedule.company_id,
          created_by: userId,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (historyError) throw historyError;

      try {
        // Calculate date range based on custom dates or period_days
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (schedule.period_start_date && schedule.period_end_date) {
          startDate = schedule.period_start_date;
          endDate = schedule.period_end_date;
        } else {
          endDate = new Date().toISOString().split('T')[0];
          startDate = schedule.period_days 
            ? new Date(Date.now() - schedule.period_days * 86400000).toISOString().split('T')[0]
            : undefined;
        }

        // Call generate-backup internally
        const categories = schedule.categories || [];
        const allTables = getTablesForCategories(categories);

        const backupResponse = await fetch(`${supabaseUrl}/functions/v1/generate-backup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            tables: allTables,
            categories,
            includePhotos: schedule.include_photos,
            startDate,
            endDate,
          }),
        });

        if (!backupResponse.ok) {
          throw new Error(`Backup generation failed: ${backupResponse.status}`);
        }

        const backupData = await backupResponse.json();
        
        if (backupData.error) {
          throw new Error(backupData.error);
        }

        // Save backup to storage
        const fileName = `scheduled/${schedule.company_id || 'all'}/${backupData.fileName}`;
        const byteCharacters = atob(backupData.fileContent);
        const byteArray = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteArray[i] = byteCharacters.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from('admin-exports')
          .upload(fileName, byteArray, {
            contentType: 'application/zip',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw new Error('Falha ao salvar no storage');
        }

        // Try Google Drive upload if credentials are configured
        let driveFileId: string | null = null;
        let driveFileUrl: string | null = null;
        
        const driveCredentials = Deno.env.get('GOOGLE_DRIVE_CREDENTIALS');
        if (driveCredentials) {
          try {
            const result = await uploadToGoogleDrive(driveCredentials, byteArray, backupData.fileName);
            driveFileId = result.fileId;
            driveFileUrl = result.fileUrl;
            console.log('Uploaded to Google Drive:', driveFileId);
          } catch (driveError) {
            console.error('Google Drive upload failed:', driveError);
            // Don't fail the backup if Drive upload fails
          }
        }

        // Update history as completed
        await supabase
          .from('backup_history')
          .update({
            status: 'completed',
            file_path: fileName,
            file_size: byteArray.length,
            completed_at: new Date().toISOString(),
            drive_file_id: driveFileId,
            drive_file_url: driveFileUrl,
          })
          .eq('id', history.id);

        // Update schedule last_run_at and calculate next_run_at
        const nextRun = calculateNextRun(schedule.frequency, schedule.preferred_time);
        await supabase
          .from('backup_schedules')
          .update({
            last_run_at: new Date().toISOString(),
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', schedule.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            historyId: history.id,
            driveFileId,
            driveFileUrl,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (backupError: any) {
        // Update history as failed
        await supabase
          .from('backup_history')
          .update({
            status: 'failed',
            error: backupError.message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', history.id);

        throw backupError;
      }
    }

    if (action === 'check_schedules') {
      // Called by pg_cron to check and run due schedules
      const { data: dueSchedules } = await supabase
        .from('backup_schedules')
        .select('*')
        .eq('is_active', true)
        .lte('next_run_at', new Date().toISOString());

      if (!dueSchedules || dueSchedules.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No schedules due' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const results = [];
      for (const schedule of dueSchedules) {
        try {
          // Recursively call ourselves with run_now
          const response = await fetch(`${supabaseUrl}/functions/v1/scheduled-backup`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({ action: 'run_now', scheduleId: schedule.id }),
          });
          
          const result = await response.json();
          results.push({ scheduleId: schedule.id, success: true, result });
        } catch (err: any) {
          results.push({ scheduleId: schedule.id, success: false, error: err.message });
        }
      }

      return new Response(
        JSON.stringify({ results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'download') {
      if (!filePath) throw new Error('filePath required');

      const { data, error } = await supabase.storage
        .from('admin-exports')
        .createSignedUrl(filePath, 3600);

      if (error) throw error;

      return new Response(
        JSON.stringify({ url: data.signedUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: any) {
    console.error('Scheduled backup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getTablesForCategories(categories: string[]): string[] {
  const categoryTables: Record<string, string[]> = {
    settings: ['tenant_settings', 'system_settings'],
    companies: ['companies', 'company_contacts', 'sites', 'site_responsibles'],
    projects: ['projects', 'project_stages', 'project_tasks', 'project_equipment', 'project_members'],
    teams: ['profiles', 'user_roles', 'teams', 'team_members'],
    reports: ['reports', 'report_activities', 'report_attendance', 'report_deviations', 'report_equipment', 'report_signatures'],
    photos: ['report_photos'],
  };

  const tables: string[] = [];
  for (const cat of categories) {
    if (categoryTables[cat]) {
      tables.push(...categoryTables[cat]);
    }
  }
  return [...new Set(tables)];
}

function calculateNextRun(frequency: string, preferredTime?: string): Date {
  const now = new Date();
  let next: Date;
  switch (frequency) {
    case 'daily':
      next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      break;
    case 'weekly':
      next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      break;
    case 'monthly':
      next = new Date(now);
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  if (preferredTime) {
    const [hours, minutes] = preferredTime.split(':').map(Number);
    next.setUTCHours(hours, minutes, 0, 0);
  }
  return next;
}

async function uploadToGoogleDrive(
  credentialsJson: string,
  fileData: Uint8Array,
  fileName: string
): Promise<{ fileId: string; fileUrl: string }> {
  const credentials = JSON.parse(credentialsJson);
  
  // Generate JWT for service account
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }));

  // Import the private key
  const pemKey = credentials.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signatureInput);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const jwt = `${header}.${payload}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get Google access token');
  }

  // Upload file to Google Drive
  const metadata = {
    name: fileName,
    mimeType: 'application/zip',
    parents: credentials.folder_id ? [credentials.folder_id] : [],
  };

  const boundary = '---backup-boundary---';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/zip',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(String.fromCharCode(...fileData)),
    `--${boundary}--`,
  ].join('\r\n');

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  const uploadResult = await uploadResponse.json();
  
  if (!uploadResult.id) {
    throw new Error('Failed to upload to Google Drive');
  }

  return {
    fileId: uploadResult.id,
    fileUrl: `https://drive.google.com/file/d/${uploadResult.id}/view`,
  };
}
