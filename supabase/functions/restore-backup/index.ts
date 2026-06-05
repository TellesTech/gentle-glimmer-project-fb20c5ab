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
];

const ALLOWED_TABLES = new Set(TABLE_ORDER);

// Map old IDs to new IDs
const idMapping: Record<string, Record<string, string>> = {};

function generateNewId(): string {
  return crypto.randomUUID();
}

function mapId(table: string, oldId: string): string {
  if (!idMapping[table]) {
    idMapping[table] = {};
  }
  if (!idMapping[table][oldId]) {
    idMapping[table][oldId] = generateNewId();
  }
  return idMapping[table][oldId];
}

function getNewId(table: string, oldId: string | null): string | null {
  if (!oldId) return null;
  return idMapping[table]?.[oldId] || null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autorizado');
    }

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado');
    }

    // Check permissions FIRST (super_admin doesn't need a company_id)
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const allowedRoles = ['admin', 'director', 'super_admin'];
    const userRoleList = (roles || []).map((r: any) => r.role);
    const hasAccess = userRoleList.some((r: string) => allowedRoles.includes(r));
    const isSuperAdmin = userRoleList.includes('super_admin');

    if (!hasAccess) {
      console.error('Restore denied. User roles:', userRoleList);
      return new Response(
        JSON.stringify({ error: 'Sem permissão para restaurar backup' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Profile is optional for super_admin; load if exists for logging
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!isSuperAdmin && !profile?.company_id) {
      throw new Error('Perfil não encontrado');
    }

    if (false) {
      throw new Error('Sem permissão para restaurar backup');
    }

    const body = await req.json().catch(() => ({}));
    const { fileContent, storagePath, mode, phase, bucket, action, table, records } = body || {};

    // ============= Lightweight batch insert mode (no ZIP) =============
    if (action === 'batch') {
      if (!table || typeof table !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Parâmetro "table" obrigatório no modo batch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!ALLOWED_TABLES.has(table)) {
        return new Response(
          JSON.stringify({ error: `Tabela "${table}" não é restaurável (não existe ou não está na allowlist)` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (!Array.isArray(records) || records.length === 0) {
        return new Response(
          JSON.stringify({ success: true, recordsImported: 0, table }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Skip current admin profile to avoid self-lockout
      const sanitized = table === 'profiles'
        ? records.filter((r: any) => r?.id !== user.id)
        : records;

      if (sanitized.length === 0) {
        return new Response(
          JSON.stringify({ success: true, recordsImported: 0, table, skipped: 'all records filtered (self-protection)' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from(table)
        .upsert(sanitized, { onConflict: 'id' });

      if (error) {
        console.error(`Batch upsert error on ${table}:`, error);
        const detail = [error.message, (error as any).hint, (error as any).details]
          .filter(Boolean)
          .join(' — ');
        return new Response(
          JSON.stringify({ error: `Erro na tabela ${table}: ${detail}`, table, code: (error as any).code }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, recordsImported: sanitized.length, table }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============= File upload proxy (single file, base64) =============
    if (action === 'upload-file') {
      const { bucket: tgtBucket, path, contentBase64, contentType } = body || {};
      if (!tgtBucket || !path || !contentBase64) {
        return new Response(
          JSON.stringify({ error: 'upload-file requer bucket, path e contentBase64' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      try {
        const bin = atob(contentBase64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        const { error: upErr } = await supabase.storage
          .from(tgtBucket)
          .upload(path, buf, { upsert: true, contentType: contentType || 'application/octet-stream' });
        if (upErr) {
          return new Response(
            JSON.stringify({ error: `Falha ao subir ${path}: ${upErr.message}` }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: `Conteúdo inválido: ${e.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`Starting restore, mode: ${mode}, phase: ${phase || 'full'}, storagePath: ${storagePath || 'inline'}`);

    // Load ZIP bytes either from Storage (preferred) or from inline base64
    let bytes: Uint8Array;
    if (storagePath && typeof storagePath === 'string') {
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from('temp-backups')
        .download(storagePath);
      if (dlErr || !fileBlob) {
        return new Response(
          JSON.stringify({ error: `Não foi possível baixar o backup do storage: ${dlErr?.message || 'arquivo não encontrado'}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      bytes = new Uint8Array(await fileBlob.arrayBuffer());
    } else {
      if (!fileContent || typeof fileContent !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Arquivo de backup não enviado (fileContent/storagePath ausente)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      // Accept either raw base64 or a data URL
      const base64 = fileContent.includes(',') ? fileContent.split(',')[1] : fileContent;
      try {
        const binaryString = atob(base64);
        bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
      } catch (e: any) {
        return new Response(
          JSON.stringify({ error: `Conteúdo do backup inválido (base64): ${e.message}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const zip = await JSZip.loadAsync(bytes);
    
    // Read manifest
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Arquivo de backup inválido: manifest.json não encontrado');
    }
    
    const manifestContent = await manifestFile.async('string');
    const manifest = JSON.parse(manifestContent);
    
    console.log('Manifest:', manifest);

    let totalRecords = 0;
    let filesRestored = 0;
    const importResults: Record<string, number> = {};
    const errors: string[] = [];

    // Phase: DATA (or full)
    if (!phase || phase === 'data') {
      // Process tables in order
      for (const tableName of TABLE_ORDER) {
        const dataFile = zip.file(`data/${tableName}.json`);
        if (!dataFile) continue;

        try {
          const content = await dataFile.async('string');
          const records = JSON.parse(content);

          if (!records || records.length === 0) continue;

          console.log(`Processing ${tableName}: ${records.length} records`);

          // In "full" mode or migration mode, we preserve original IDs
          // We only skip certain sensitive records like the current admin's profile to avoid lockout
          const transformedRecords = records.map((record: any) => {
            if (tableName === 'profiles' && record.id === user.id) return null;
            return record;
          }).filter(Boolean);

          if (transformedRecords.length === 0) continue;

          // Insert records with UPSERT to preserve IDs and handle conflicts
          const { error } = await supabase
            .from(tableName)
            .upsert(transformedRecords, { onConflict: 'id' });

          if (error) {
            console.error(`Error inserting ${tableName}:`, error);
            errors.push(`Erro na tabela ${tableName}: ${error.message}`);
          } else {
            importResults[tableName] = transformedRecords.length;
            totalRecords += transformedRecords.length;
          }

        } catch (tableError: any) {
          console.error(`Error processing ${tableName}:`, tableError);
          errors.push(`Erro fatal na tabela ${tableName}: ${tableError.message}`);
        }
      }
    }

    // Phase: FILES (restoring from /files/{bucket}/...)
    if (!phase || phase === 'files') {
      const filesFolder = zip.folder('files');
      if (filesFolder) {
        // We iterate through buckets we know
        const bucketsToRestore = bucket ? [bucket] : [
          'company-photos', 'project-photos',
          'avatars', 'suggestion-screenshots', 'service-report-photos'
        ];

        for (const b of bucketsToRestore) {
          const bucketFolder = filesFolder.folder(b);
          if (!bucketFolder) continue;

          const filePaths: string[] = [];
          bucketFolder.forEach((relativePath) => {
            if (!bucketFolder.file(relativePath)) return; // skip folders
            filePaths.push(relativePath);
          });

          console.log(`Restoring ${filePaths.length} files to bucket ${b}`);

          for (const path of filePaths) {
            try {
              const fileData = await bucketFolder.file(path)?.async('blob');
              if (fileData) {
                const { error: uploadError } = await supabase.storage
                  .from(b)
                  .upload(path, fileData, { upsert: true });

                if (uploadError) {
                  console.warn(`Error restoring file ${path} to ${b}:`, uploadError);
                } else {
                  filesRestored++;
                }
              }
            } catch (err: any) {
              console.warn(`Failed to process file ${path}:`, err);
            }
          }
        }
      }
    }

    console.log('Restore completed.', { totalRecords, filesRestored });

    return new Response(
      JSON.stringify({
        success: true,
        recordsImported: totalRecords,
        filesRestored: filesRestored,
        details: importResults,
        errors: errors.length > 0 ? errors : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('Restore error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
