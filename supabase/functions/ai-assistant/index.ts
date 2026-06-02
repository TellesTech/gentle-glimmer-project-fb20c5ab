import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';
const MAX_TOOL_ROUNDS = 5;
const HARD_ROW_LIMIT = 200;
const DEFAULT_ROW_LIMIT = 50;

// ========== Tool definitions ==========
const tools = [
  {
    type: 'function',
    function: {
      name: 'query_reports',
      description: 'Busca RDOs (Relatórios Diários de Obra) por filtros. Use SEMPRE que o usuário perguntar sobre RDOs específicos, por data, projeto, unidade, fábrica, autor ou status. Retorna lista de RDOs com metadados.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string', description: 'UUID do projeto/atividade' },
          site_id: { type: 'string', description: 'UUID da unidade' },
          company_id: { type: 'string', description: 'UUID da fábrica' },
          date: { type: 'string', description: 'Data exata YYYY-MM-DD' },
          date_from: { type: 'string', description: 'Data inicial YYYY-MM-DD (inclusiva)' },
          date_to: { type: 'string', description: 'Data final YYYY-MM-DD (inclusiva)' },
          status: { type: 'string', description: 'draft, completed, sent, signed, finalized' },
          shift: { type: 'string', description: 'morning, afternoon, night' },
          created_by_name: { type: 'string', description: 'Nome (parcial) do autor do RDO' },
          location_contains: { type: 'string', description: 'Texto parcial no campo location' },
          limit: { type: 'number', description: 'Máximo de resultados (default 50, max 200)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_report_detail',
      description: 'Retorna detalhes COMPLETOS de um RDO específico: atividades, desvios, presença, fotos, assinaturas, equipamentos, observações.',
      parameters: {
        type: 'object',
        properties: { report_id: { type: 'string' } },
        required: ['report_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_attendance',
      description: 'Busca registros de presença de colaboradores em RDOs (quem esteve em qual obra, em qual data, horário).',
      parameters: {
        type: 'object',
        properties: {
          worker_name: { type: 'string', description: 'Nome parcial do colaborador (case-insensitive)' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          project_id: { type: 'string' },
          report_id: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_workforce_hours',
      description: 'Busca registros de horas trabalhadas (HN, HE75, HE100, ADN) por colaborador, data, projeto. Retorna detalhes E totais agregados.',
      parameters: {
        type: 'object',
        properties: {
          worker_name: { type: 'string' },
          date: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          project_id: { type: 'string' },
          function_role: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_activities',
      description: 'Busca atividades executadas (report_activities) por projeto, data ou nome de etapa.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          date: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          step_name: { type: 'string', description: 'Nome parcial da etapa' },
          report_id: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_deviations',
      description: 'Busca desvios/ocorrências por projeto, data, tipo ou impacto.',
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          impact: { type: 'string', description: 'low, medium, high, critical' },
          type: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_projects',
      description: 'Busca atividades/projetos com filtros.',
      parameters: {
        type: 'object',
        properties: {
          name_contains: { type: 'string' },
          status: { type: 'string' },
          company_id: { type: 'string' },
          site_id: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_collaborators',
      description: 'Busca colaboradores por nome, função ou empresa.',
      parameters: {
        type: 'object',
        properties: {
          name_contains: { type: 'string' },
          job_title_contains: { type: 'string' },
          company_id: { type: 'string' },
          limit: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'count_aggregate',
      description: 'Conta registros de uma entidade aplicando filtros opcionais. Use para perguntas como "quantos RDOs em outubro?".',
      parameters: {
        type: 'object',
        properties: {
          entity: { type: 'string', enum: ['reports', 'attendance', 'workforce_hours', 'deviations', 'activities', 'projects', 'collaborators'] },
          project_id: { type: 'string' },
          site_id: { type: 'string' },
          company_id: { type: 'string' },
          date_from: { type: 'string' },
          date_to: { type: 'string' },
          status: { type: 'string' },
        },
        required: ['entity'],
      },
    },
  },
];

interface Scope {
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isCollaborator: boolean;
  userCompanyId: string | null;
  allowedProjectIds: string[] | null; // null = no project filter
  allowedSiteIds: string[] | null;
}

function clampLimit(n: any): number {
  const v = Number(n) || DEFAULT_ROW_LIMIT;
  return Math.min(Math.max(1, v), HARD_ROW_LIMIT);
}

// Apply scope to a project_id filter. Returns array of allowed ids or null (no scope).
function intersectProjects(scope: Scope, requested?: string): string[] | null {
  if (scope.isSuperAdmin) return requested ? [requested] : null;
  if (scope.allowedProjectIds === null) return requested ? [requested] : null;
  if (requested) {
    return scope.allowedProjectIds.includes(requested) ? [requested] : ['00000000-0000-0000-0000-000000000000'];
  }
  return scope.allowedProjectIds.length > 0 ? scope.allowedProjectIds : ['00000000-0000-0000-0000-000000000000'];
}

async function buildScope(supabase: any, userId: string): Promise<Scope> {
  const { data: userProfile } = await supabase
    .from('profiles').select('id, company_id').eq('id', userId).maybeSingle();
  const { data: userRole } = await supabase
    .from('user_roles').select('role').eq('user_id', userId).maybeSingle();

  const isSuperAdmin = userRole?.role === 'super_admin';
  const isAdmin = userRole?.role === 'admin';
  const isCollaborator = userRole?.role === 'collaborator';
  const userCompanyId = userProfile?.company_id || null;

  let allowedProjectIds: string[] | null = null;
  let allowedSiteIds: string[] | null = null;

  if (isSuperAdmin) {
    return { isSuperAdmin, isAdmin, isCollaborator, userCompanyId, allowedProjectIds: null, allowedSiteIds: null };
  }

  if (isCollaborator) {
    const { data: projectIds } = await supabase.rpc('get_user_project_ids', { _user_id: userId });
    allowedProjectIds = (projectIds || []).map((id: any) => String(id));
    return { isSuperAdmin, isAdmin, isCollaborator, userCompanyId, allowedProjectIds, allowedSiteIds: null };
  }

  // admin: scope by company
  if (userCompanyId) {
    const { data: sitesData } = await supabase.from('sites').select('id').eq('company_id', userCompanyId);
    allowedSiteIds = (sitesData || []).map((s: any) => s.id);
    if (allowedSiteIds && allowedSiteIds.length > 0) {
      const { data: projData } = await supabase.from('projects').select('id').in('site_id', allowedSiteIds);
      allowedProjectIds = (projData || []).map((p: any) => p.id);
    } else {
      allowedProjectIds = [];
    }
  } else {
    allowedProjectIds = [];
    allowedSiteIds = [];
  }

  return { isSuperAdmin, isAdmin, isCollaborator, userCompanyId, allowedProjectIds, allowedSiteIds };
}

// ========== Tool implementations ==========
async function runTool(name: string, args: any, supabase: any, scope: Scope): Promise<any> {
  try {
    const limit = clampLimit(args.limit);
    switch (name) {
      case 'query_reports': {
        const projectFilter = intersectProjects(scope, args.project_id);
        let q = supabase.from('reports')
          .select('id, rdo_number, date, shift, status, location, comments, weather, actual_workforce, daily_progress, supervisor_name, project_id, created_by, created_at')
          .order('date', { ascending: false })
          .limit(limit);
        if (projectFilter) q = q.in('project_id', projectFilter);
        if (args.date) q = q.eq('date', args.date);
        if (args.date_from) q = q.gte('date', args.date_from);
        if (args.date_to) q = q.lte('date', args.date_to);
        if (args.status) q = q.eq('status', args.status);
        if (args.shift) q = q.eq('shift', args.shift);
        if (args.location_contains) q = q.ilike('location', `%${args.location_contains}%`);

        // company / site filters via project join
        if (args.site_id || args.company_id) {
          let pq = supabase.from('projects').select('id');
          if (args.site_id) pq = pq.eq('site_id', args.site_id);
          if (args.company_id) {
            const { data: csites } = await supabase.from('sites').select('id').eq('company_id', args.company_id);
            const ids = (csites || []).map((s: any) => s.id);
            if (ids.length === 0) return { rows: [], count: 0 };
            pq = pq.in('site_id', ids);
          }
          const { data: ps } = await pq;
          const pids = (ps || []).map((p: any) => p.id);
          if (pids.length === 0) return { rows: [], count: 0 };
          q = q.in('project_id', pids);
        }

        const { data, error } = await q;
        if (error) return { error: error.message };

        let rows = data || [];

        if (args.created_by_name) {
          const needle = String(args.created_by_name).toLowerCase();
          const creatorIds = Array.from(new Set(rows.map((r: any) => r.created_by).filter(Boolean)));
          if (creatorIds.length) {
            const { data: profs } = await supabase.from('profiles').select('id, name').in('id', creatorIds);
            const matchIds = new Set((profs || []).filter((p: any) => p.name?.toLowerCase().includes(needle)).map((p: any) => p.id));
            rows = rows.filter((r: any) => matchIds.has(r.created_by));
          } else rows = [];
        }

        // enrich with project name
        const pids = Array.from(new Set(rows.map((r: any) => r.project_id).filter(Boolean)));
        let projMap: Record<string, string> = {};
        if (pids.length) {
          const { data: pr } = await supabase.from('projects').select('id, name').in('id', pids);
          projMap = Object.fromEntries((pr || []).map((p: any) => [p.id, p.name]));
        }
        const enriched = rows.map((r: any) => ({ ...r, project_name: projMap[r.project_id] || null }));
        return { count: enriched.length, rows: enriched };
      }

      case 'get_report_detail': {
        if (!args.report_id) return { error: 'report_id obrigatório' };
        const { data: report } = await supabase.from('reports').select('*').eq('id', args.report_id).maybeSingle();
        if (!report) return { error: 'RDO não encontrado' };
        // scope check
        if (!scope.isSuperAdmin && scope.allowedProjectIds && !scope.allowedProjectIds.includes(report.project_id)) {
          return { error: 'Sem permissão para acessar este RDO' };
        }
        const [activities, deviations, attendance, photos, signatures, equip] = await Promise.all([
          supabase.from('report_activities').select('*').eq('report_id', args.report_id),
          supabase.from('report_deviations').select('*').eq('report_id', args.report_id),
          supabase.from('report_attendance').select('*').eq('report_id', args.report_id),
          supabase.from('report_photos').select('id, description, url').eq('report_id', args.report_id),
          supabase.from('report_signatures').select('signer_name, signer_role, signer_email, signed_at').eq('report_id', args.report_id),
          supabase.from('report_equipment').select('*').eq('report_id', args.report_id),
        ]);
        return {
          report,
          activities: activities.data || [],
          deviations: deviations.data || [],
          attendance: attendance.data || [],
          photos_count: photos.data?.length || 0,
          signatures: signatures.data || [],
          equipment: equip.data || [],
        };
      }

      case 'query_attendance': {
        const projectFilter = intersectProjects(scope, args.project_id);
        // attendance is via report_id — first filter reports
        let rq = supabase.from('reports').select('id, date, project_id');
        if (projectFilter) rq = rq.in('project_id', projectFilter);
        if (args.date) rq = rq.eq('date', args.date);
        if (args.date_from) rq = rq.gte('date', args.date_from);
        if (args.date_to) rq = rq.lte('date', args.date_to);
        rq = rq.limit(500);
        const { data: reps } = await rq;
        const reportIds = args.report_id ? [args.report_id] : (reps || []).map((r: any) => r.id);
        if (reportIds.length === 0) return { count: 0, rows: [] };

        let q = supabase.from('report_attendance')
          .select('id, user_name, function_role, arrival_time, departure_time, present, report_id')
          .in('report_id', reportIds)
          .eq('present', true)
          .limit(limit);
        if (args.worker_name) q = q.ilike('user_name', `%${args.worker_name}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        // attach date
        const dateMap = Object.fromEntries((reps || []).map((r: any) => [r.id, r.date]));
        const rows = (data || []).map((a: any) => ({ ...a, date: dateMap[a.report_id] || null }));
        return { count: rows.length, rows };
      }

      case 'query_workforce_hours': {
        const projectFilter = intersectProjects(scope, args.project_id);
        let q = supabase.from('workforce_database')
          .select('worker_name, function_role, date, start_time, end_time, normal_hours, overtime_75, overtime_100, night_bonus, activity_name, project_id')
          .order('date', { ascending: false })
          .limit(limit);
        if (projectFilter) q = q.in('project_id', projectFilter);
        if (args.worker_name) q = q.ilike('worker_name', `%${args.worker_name}%`);
        if (args.function_role) q = q.ilike('function_role', `%${args.function_role}%`);
        if (args.date) q = q.eq('date', args.date);
        if (args.date_from) q = q.gte('date', args.date_from);
        if (args.date_to) q = q.lte('date', args.date_to);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const rows = data || [];
        const totals = rows.reduce((acc: any, w: any) => ({
          HN: acc.HN + (w.normal_hours || 0),
          HE75: acc.HE75 + (w.overtime_75 || 0),
          HE100: acc.HE100 + (w.overtime_100 || 0),
          ADN: acc.ADN + (w.night_bonus || 0),
        }), { HN: 0, HE75: 0, HE100: 0, ADN: 0 });
        return { count: rows.length, totals, rows };
      }

      case 'query_activities': {
        const projectFilter = intersectProjects(scope, args.project_id);
        let rq = supabase.from('reports').select('id, date, project_id');
        if (projectFilter) rq = rq.in('project_id', projectFilter);
        if (args.date) rq = rq.eq('date', args.date);
        if (args.date_from) rq = rq.gte('date', args.date_from);
        if (args.date_to) rq = rq.lte('date', args.date_to);
        rq = rq.limit(500);
        const { data: reps } = await rq;
        const reportIds = args.report_id ? [args.report_id] : (reps || []).map((r: any) => r.id);
        if (reportIds.length === 0) return { count: 0, rows: [] };

        let q = supabase.from('report_activities')
          .select('*')
          .in('report_id', reportIds)
          .limit(limit);
        if (args.step_name) q = q.ilike('step_name', `%${args.step_name}%`);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const dateMap = Object.fromEntries((reps || []).map((r: any) => [r.id, r.date]));
        const rows = (data || []).map((a: any) => ({ ...a, date: dateMap[a.report_id] || null }));
        return { count: rows.length, rows };
      }

      case 'query_deviations': {
        const projectFilter = intersectProjects(scope, args.project_id);
        let rq = supabase.from('reports').select('id, date, project_id');
        if (projectFilter) rq = rq.in('project_id', projectFilter);
        if (args.date_from) rq = rq.gte('date', args.date_from);
        if (args.date_to) rq = rq.lte('date', args.date_to);
        rq = rq.limit(1000);
        const { data: reps } = await rq;
        const reportIds = (reps || []).map((r: any) => r.id);
        if (reportIds.length === 0) return { count: 0, rows: [] };
        let q = supabase.from('report_deviations')
          .select('id, type, description, impact, action_taken, report_id, created_at')
          .in('report_id', reportIds)
          .order('created_at', { ascending: false })
          .limit(limit);
        if (args.impact) q = q.eq('impact', args.impact);
        if (args.type) q = q.eq('type', args.type);
        const { data, error } = await q;
        if (error) return { error: error.message };
        const dateMap = Object.fromEntries((reps || []).map((r: any) => [r.id, r.date]));
        const rows = (data || []).map((d: any) => ({ ...d, date: dateMap[d.report_id] || null }));
        return { count: rows.length, rows };
      }

      case 'query_projects': {
        let q = supabase.from('projects')
          .select('id, name, code, status, progress, supervisor_name, client_responsible_name, company_id, site_id, start_date, end_date')
          .order('name')
          .limit(limit);
        if (!scope.isSuperAdmin && scope.allowedProjectIds !== null) {
          if (scope.allowedProjectIds.length === 0) return { count: 0, rows: [] };
          q = q.in('id', scope.allowedProjectIds);
        }
        if (args.name_contains) q = q.ilike('name', `%${args.name_contains}%`);
        if (args.status) q = q.eq('status', args.status);
        if (args.company_id) q = q.eq('company_id', args.company_id);
        if (args.site_id) q = q.eq('site_id', args.site_id);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length || 0, rows: data || [] };
      }

      case 'query_collaborators': {
        let q = supabase.from('profiles')
          .select('id, name, email, job_title, phone, company_id')
          .order('name').limit(limit);
        if (!scope.isSuperAdmin && scope.userCompanyId) q = q.eq('company_id', scope.userCompanyId);
        if (args.name_contains) q = q.ilike('name', `%${args.name_contains}%`);
        if (args.job_title_contains) q = q.ilike('job_title', `%${args.job_title_contains}%`);
        if (args.company_id) q = q.eq('company_id', args.company_id);
        const { data, error } = await q;
        if (error) return { error: error.message };
        return { count: data?.length || 0, rows: data || [] };
      }

      case 'count_aggregate': {
        const projectFilter = intersectProjects(scope, args.project_id);
        const entity = args.entity;
        if (entity === 'reports') {
          let q = supabase.from('reports').select('*', { count: 'exact', head: true });
          if (projectFilter) q = q.in('project_id', projectFilter);
          if (args.date_from) q = q.gte('date', args.date_from);
          if (args.date_to) q = q.lte('date', args.date_to);
          if (args.status) q = q.eq('status', args.status);
          const { count, error } = await q;
          if (error) return { error: error.message };
          return { entity, count: count || 0 };
        }
        if (entity === 'projects') {
          let q = supabase.from('projects').select('*', { count: 'exact', head: true });
          if (!scope.isSuperAdmin && scope.allowedProjectIds !== null) {
            if (scope.allowedProjectIds.length === 0) return { entity, count: 0 };
            q = q.in('id', scope.allowedProjectIds);
          }
          if (args.status) q = q.eq('status', args.status);
          if (args.company_id) q = q.eq('company_id', args.company_id);
          if (args.site_id) q = q.eq('site_id', args.site_id);
          const { count, error } = await q;
          if (error) return { error: error.message };
          return { entity, count: count || 0 };
        }
        if (entity === 'collaborators') {
          let q = supabase.from('profiles').select('*', { count: 'exact', head: true });
          if (!scope.isSuperAdmin && scope.userCompanyId) q = q.eq('company_id', scope.userCompanyId);
          const { count, error } = await q;
          if (error) return { error: error.message };
          return { entity, count: count || 0 };
        }
        if (entity === 'workforce_hours') {
          let q = supabase.from('workforce_database').select('*', { count: 'exact', head: true });
          if (projectFilter) q = q.in('project_id', projectFilter);
          if (args.date_from) q = q.gte('date', args.date_from);
          if (args.date_to) q = q.lte('date', args.date_to);
          const { count, error } = await q;
          if (error) return { error: error.message };
          return { entity, count: count || 0 };
        }
        // attendance/deviations/activities need report_id scoping
        let rq = supabase.from('reports').select('id');
        if (projectFilter) rq = rq.in('project_id', projectFilter);
        if (args.date_from) rq = rq.gte('date', args.date_from);
        if (args.date_to) rq = rq.lte('date', args.date_to);
        const { data: reps } = await rq.limit(5000);
        const reportIds = (reps || []).map((r: any) => r.id);
        if (reportIds.length === 0) return { entity, count: 0 };
        const table = entity === 'attendance' ? 'report_attendance'
          : entity === 'deviations' ? 'report_deviations'
          : 'report_activities';
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true }).in('report_id', reportIds);
        if (error) return { error: error.message };
        return { entity, count: count || 0 };
      }

      default:
        return { error: `Tool desconhecida: ${name}` };
    }
  } catch (e: any) {
    return { error: e?.message || String(e) };
  }
}

// ========== Thin overview context ==========
async function buildOverview(supabase: any, scope: Scope, systemName: string): Promise<string> {
  const companyFilter = !scope.isSuperAdmin && scope.userCompanyId ? scope.userCompanyId : null;

  const [companiesRes, sitesRes, projectsCntRes, reportsCntRes, profilesCntRes] = await Promise.all([
    (() => {
      let q = supabase.from('companies').select('id, name, cnpj, city, state').order('name').limit(50);
      if (companyFilter) q = q.eq('id', companyFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('sites').select('id, name, city, state, company_id').order('name').limit(100);
      if (companyFilter) q = q.eq('company_id', companyFilter);
      return q;
    })(),
    (() => {
      let q = supabase.from('projects').select('*', { count: 'exact', head: true });
      if (!scope.isSuperAdmin && scope.allowedProjectIds !== null) {
        if (scope.allowedProjectIds.length === 0) return Promise.resolve({ count: 0 });
        q = q.in('id', scope.allowedProjectIds);
      }
      return q;
    })(),
    (() => {
      let q = supabase.from('reports').select('*', { count: 'exact', head: true });
      if (!scope.isSuperAdmin && scope.allowedProjectIds !== null) {
        if (scope.allowedProjectIds.length === 0) return Promise.resolve({ count: 0 });
        q = q.in('project_id', scope.allowedProjectIds);
      }
      return q;
    })(),
    (() => {
      let q = supabase.from('profiles').select('*', { count: 'exact', head: true });
      if (companyFilter) q = q.eq('company_id', companyFilter);
      return q;
    })(),
  ]);

  const companies = companiesRes.data || [];
  const sites = sitesRes.data || [];

  return `=== VISÃO GERAL DO ${systemName.toUpperCase()} ===
Totais (escopo do usuário):
- RDOs: ${reportsCntRes.count || 0}
- Atividades/Projetos: ${projectsCntRes.count || 0}
- Colaboradores: ${profilesCntRes.count || 0}
- Fábricas: ${companies.length}
- Unidades: ${sites.length}

FÁBRICAS:
${companies.map((c: any) => `- [${c.id}] ${c.name}${c.city ? ` (${c.city}/${c.state})` : ''}`).join('\n') || '(nenhuma)'}

UNIDADES:
${sites.map((s: any) => {
  const c = companies.find((x: any) => x.id === s.company_id);
  return `- [${s.id}] ${s.name}${s.city ? ` (${s.city}/${s.state})` : ''}${c ? ` | Fábrica: ${c.name}` : ''}`;
}).join('\n') || '(nenhuma)'}

Para consultar QUALQUER dado específico (RDOs por data, presença, horas, atividades, desvios, projetos, colaboradores) — USE AS TOOLS. Os IDs acima podem ser passados como parâmetro nas tools.
=== FIM DA VISÃO GERAL ===`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userId, userName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const scope = await buildScope(supabase, userId);
    const { data: systemSettings } = await supabase.from('system_settings').select('system_name').limit(1).maybeSingle();
    const systemName = systemSettings?.system_name || 'Sistema RDO';
    const overview = await buildOverview(supabase, scope, systemName);

    const userFirstName = userName?.split(' ')[0] || 'usuário';
    const roleLabel = scope.isSuperAdmin ? 'Super Administrador' : scope.isAdmin ? 'Administrador' : 'Operacional';
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = `Você é WESLEY, assistente IA do sistema ${systemName}.
USUÁRIO: ${userName || 'Usuário'} (${roleLabel}) — trate por "${userFirstName}".
DATA DE HOJE: ${today}

=== SEGURANÇA ===
- Acesso é limitado ao escopo do usuário (já aplicado nas tools — não tente burlar).
- Nunca invente dados. Se uma tool retornar vazio, diga que não encontrou.
${scope.isCollaborator ? '- Operacional: só vê projetos das próprias equipes.' : ''}

=== USO DE TOOLS (CRÍTICO) ===
Você tem ferramentas para consultar QUALQUER data, projeto, colaborador. SEMPRE use-as quando o usuário perguntar sobre dados específicos.
NÃO diga "não tenho acesso a dados antigos" — CHAME as tools com os filtros de data corretos.
NÃO se restrinja à visão geral abaixo — ela é só um índice. Os dados completos estão nas tools.

Exemplos:
- "RDOs de outubro/2025" → query_reports(date_from=2025-10-01, date_to=2025-10-31)
- "Horas do João em novembro" → query_workforce_hours(worker_name="João", date_from=...)
- "Quem trabalhou no dia 15/05?" → query_attendance(date="2025-05-15")
- "Detalhes do RDO X" → primeiro query_reports para achar o id, depois get_report_detail
- "Quantos RDOs em 2025?" → count_aggregate(entity="reports", date_from="2025-01-01", date_to="2025-12-31")

Datas no formato YYYY-MM-DD. Mostre datas para o usuário no formato dd/mm/yyyy.

=== ESTILO ===
- Português brasileiro, objetivo, profissional.
- Traduza status: draft=Rascunho, completed=Concluído, sent=Enviado, signed=Assinado, in_progress=Em Progresso, morning=Manhã, afternoon=Tarde, night=Noite, low=Baixo, medium=Médio, high=Alto, critical=Crítico.
- Use **negrito** para destaques. Listas/tabelas para dados.
- Sem cumprimentos genéricos. Vá direto ao ponto.

${overview}`;

    let workingMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // ===== Tool-calling loop (non-streaming) =====
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const resp = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: workingMessages,
          tools,
          tool_choice: 'auto',
        }),
      });

      if (!resp.ok) {
        if (resp.status === 429) {
          return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        if (resp.status === 402) {
          return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o suporte.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const errorText = await resp.text();
        console.error('AI tool round error:', resp.status, errorText);
        return new Response(JSON.stringify({ error: 'Erro ao processar sua mensagem.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const json = await resp.json();
      const msg = json?.choices?.[0]?.message;
      if (!msg) break;

      const toolCalls = msg.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // Final assistant content — stream it to client via SSE
        const finalText: string = msg.content || '';
        const stream = new ReadableStream({
          start(controller) {
            const enc = new TextEncoder();
            // chunk into pieces for nicer UX
            const chunkSize = 40;
            for (let i = 0; i < finalText.length; i += chunkSize) {
              const chunk = finalText.slice(i, i + chunkSize);
              const payload = { choices: [{ delta: { content: chunk } }] };
              controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
            }
            controller.enqueue(enc.encode(`data: [DONE]\n\n`));
            controller.close();
          },
        });
        return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
      }

      // Append assistant message with tool_calls
      workingMessages.push({
        role: 'assistant',
        content: msg.content ?? '',
        tool_calls: toolCalls,
      });

      // Execute each tool call
      for (const call of toolCalls) {
        let args: any = {};
        try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
        const result = await runTool(call.function?.name, args, supabase, scope);
        workingMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result).slice(0, 60000),
        });
      }
    }

    // Loop limit hit
    const fallback = 'Não consegui finalizar a consulta dentro do limite de iterações. Tente reformular com filtros mais específicos.';
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: fallback } }] })}\n\n`));
        controller.enqueue(enc.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
  } catch (error) {
    console.error('Error in ai-assistant function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
