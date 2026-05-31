import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um assistente especializado em organizar dados de colaboradores de planilhas.

TAREFA:
Analise os dados brutos da planilha e identifique quais colunas correspondem a:
- NOME: Nome completo do colaborador
- EMAIL: Email (pode não existir ou estar vazio)
- CARGO: Cargo/Função do colaborador
- TELEFONE: Telefone (pode não existir ou estar vazio)
- ESTADO/FILIAL: Filial do colaborador (pode não existir ou estar vazio)

REGRAS DE FORMATAÇÃO:
1. Nomes: Capitalize corretamente (João da Silva Santos, não JOÃO DA SILVA SANTOS ou joao da silva santos)
2. Preserve partículas em minúsculo: da, de, do, dos, das
3. Remova espaços extras e caracteres estranhos
4. Padronize cargos: "Sold." → "Soldador", "Elet." → "Eletricista", "Mec." → "Mecânico", "Eng." → "Engenheiro", "Téc." → "Técnico"
5. FILIAL - Mapeie para uma das duas opções EXATAMENTE:
   - Se mencionar "João Neiva", "ES", "Espírito Santo" → use "joao-neiva-es"
   - Se mencionar "Pecém", "CE", "Ceará" → use "pecem-ce"
   - Se não identificar ou for outro valor, deixe vazio ""
6. Ignore linhas completamente vazias ou que parecem ser cabeçalhos repetidos
7. Detecte possíveis duplicatas comparando nomes similares (considerando erros de digitação e acentuação)

RETORNE EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "columnMapping": {
    "nome": <índice da coluna de nome ou null>,
    "email": <índice da coluna de email ou null>,
    "cargo": <índice da coluna de cargo ou null>,
    "telefone": <índice da coluna de telefone ou null>,
    "estado": <índice da coluna de estado ou null>
  },
  "collaborators": [
    {
      "nome": "Nome Formatado Corretamente",
      "email": "email@exemplo.com ou vazio",
      "cargo": "Cargo Padronizado",
      "telefone": "telefone ou vazio",
      "estado": "UF ou vazio",
      "isDuplicate": false,
      "duplicateOf": null,
      "warnings": []
    }
  ],
  "summary": {
    "total": <número total>,
    "duplicates": <quantidade de duplicatas>,
    "withEmail": <quantidade com email>,
    "withPhone": <quantidade com telefone>
  }
}`;

serve(async (req) => {
  // Log request info for debugging
  console.log('import-collaborators called:', { 
    method: req.method, 
    hasAuth: !!req.headers.get('Authorization'),
    url: req.url 
  });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Supabase client - use service role for all operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth - extract JWT from header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      console.error('Missing or invalid Authorization header');
      return new Response(JSON.stringify({ error: 'Não autenticado', reason: 'Token ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7).trim(); // Remove 'Bearer ' prefix
    
    if (!token) {
      console.error('Empty token after extraction');
      return new Response(JSON.stringify({ error: 'Não autenticado', reason: 'Token vazio' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth validation failed:', authError?.message || 'No user returned');
      return new Response(JSON.stringify({ 
        error: 'Não autenticado', 
        reason: authError?.message || 'Sessão inválida' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User authenticated:', user.id);

    // Parse body after auth is verified
    const { action, rawData, collaborators: collaboratorsToImport } = await req.json();

    // Check user role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const allowedRoles = ['super_admin', 'admin', 'director'];
    if (!roleData || !allowedRoles.includes(roleData.role)) {
      return new Response(JSON.stringify({ error: 'Permissão negada' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's company_id
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (action === 'analyze') {
      // Use Lovable AI to analyze the spreadsheet data
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      if (!LOVABLE_API_KEY) {
        return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('Analyzing spreadsheet data with AI...', { rowCount: rawData?.length });

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Analise estes dados da planilha e retorne o JSON formatado:\n\n${JSON.stringify(rawData)}` }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o suporte.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        
        throw new Error('Erro ao processar com IA');
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || '';
      
      // Clean markdown if present
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      console.log('AI response content:', content.substring(0, 500));

      let parsedResult;
      try {
        parsedResult = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError, content);
        return new Response(JSON.stringify({ error: 'Erro ao interpretar resposta da IA. Tente novamente.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check for existing emails in database
      const emails = parsedResult.collaborators
        ?.filter((c: any) => c.email && c.email.trim())
        .map((c: any) => c.email.toLowerCase().trim()) || [];

      if (emails.length > 0) {
        const { data: existingProfiles } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .in('email', emails);

        const existingEmails = new Set(existingProfiles?.map((p: { email: string }) => p.email.toLowerCase()) || []);

        // Mark existing emails as duplicates
        parsedResult.collaborators = parsedResult.collaborators.map((c: any) => {
          if (c.email && existingEmails.has(c.email.toLowerCase().trim())) {
            return { ...c, isDuplicate: true, duplicateOf: 'Já cadastrado no sistema' };
          }
          return c;
        });
      }

      return new Response(JSON.stringify({ success: true, data: parsedResult }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'import') {
      // Bulk import collaborators
      if (!collaboratorsToImport || !Array.isArray(collaboratorsToImport)) {
        return new Response(JSON.stringify({ error: 'Dados de colaboradores inválidos' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Importing ${collaboratorsToImport.length} collaborators...`);

      const results = { success: 0, errors: [] as string[] };

      for (const collab of collaboratorsToImport) {
        try {
          // Generate unique internal email for collaborator (they will never use it to login)
          const collaboratorId = crypto.randomUUID();
          const fakeEmail = collab.email?.trim() || `collaborator-${collaboratorId.slice(0, 8)}@internal.local`;
          
          // Check if email already exists in auth or profiles
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', fakeEmail.toLowerCase())
            .maybeSingle();
          
          if (existingProfile) {
            console.log('Email already exists, skipping:', fakeEmail);
            results.errors.push(`${collab.nome}: Email já cadastrado`);
            continue;
          }

          // Generate random password (collaborator will never know it - record only)
          const randomPassword = crypto.randomUUID() + crypto.randomUUID();

          // Create user in auth.users - this triggers handle_new_user() which creates profile
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: fakeEmail,
            password: randomPassword,
            email_confirm: true,
            user_metadata: { 
              name: collab.nome, 
              is_collaborator: true 
            }
          });

          if (authError) {
            console.error('Auth create error for:', collab.nome, authError.message);
            results.errors.push(`${collab.nome}: ${authError.message}`);
            continue;
          }

          console.log('Created auth user:', authData.user.id, 'for:', collab.nome);

          // Update the profile created by trigger with additional data
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
              name: collab.nome,
              job_title: collab.cargo || null,
              phone: collab.telefone || null,
              state: collab.estado || null,
              company_id: profileData?.company_id || null,
            })
            .eq('id', authData.user.id);

          if (updateError) {
            console.error('Profile update error:', updateError.message);
            // Don't fail - user was created successfully
          }

          // Ensure 'collaborator' role (trigger may already set it, but we ensure)
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .upsert({
              user_id: authData.user.id,
              role: 'collaborator',
            }, { onConflict: 'user_id' });

          if (roleError) {
            console.error('Role upsert error:', roleError.message);
          }

          results.success++;
          console.log('Successfully imported:', collab.nome);
          
        } catch (err) {
          console.error('Import error for collaborator:', collab.nome, err);
          results.errors.push(`${collab.nome}: Erro interno`);
        }
      }

      console.log('Import complete:', results);

      return new Response(JSON.stringify({ 
        success: true, 
        imported: results.success,
        errors: results.errors,
        message: `${results.success} colaborador(es) importado(s) com sucesso${results.errors.length > 0 ? `. ${results.errors.length} erro(s).` : '.'}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      return new Response(JSON.stringify({ error: 'Ação inválida' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Import collaborators error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
