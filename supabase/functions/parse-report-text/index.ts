import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `Você é um assistente especializado em extrair informações de relatórios diários de obra brasileiros.

IMPORTANTE - FORMATAÇÃO DE TEXTO:
Antes de retornar os dados, você DEVE formatar todos os textos seguindo estas regras:

1. CAPITALIZAÇÃO:
   - Nomes próprios de pessoas: primeira letra de cada nome em maiúscula (ex: "RONIERI" → "Ronieri", "anacleto" → "Anacleto", "JOSÉ SILVA" → "José Silva")
   - Nomes de locais/áreas: primeira letra maiúscula (ex: "convertedores 2 (aciaria)" → "Convertedores 2 (Aciaria)")
   - Início de frases/atividades: primeira letra maiúscula
   - Siglas mantêm maiúsculas (ex: OM, NA, PT, EPI, DDS)
   - NÃO use ALL CAPS para nomes de pessoas ou locais

2. ACENTUAÇÃO (corrija SEMPRE):
   - instalacao → instalação
   - manutencao → manutenção
   - inspecao → inspeção
   - liberacao → liberação
   - operacao → operação
   - conclusao → conclusão
   - montagem → montagem
   - soldagem → soldagem
   - verificacao → verificação
   - area → área
   - inicio → início
   - termino → término
   - horario → horário
   - servico → serviço
   - tecnico → técnico
   - eletrica → elétrica
   - mecanica → mecânica
   - hidraulica → hidráulica

3. PONTUAÇÃO:
   - Adicione vírgulas onde necessário para clareza
   - Finalize atividades com ponto final quando for frase completa
   - Use ponto e vírgula para separar itens em listas longas

4. LIMPEZA:
   - Remova marcadores duplicados (-, •, *, ✅)
   - Normalize espaços extras
   - Remova quebras de linha desnecessárias dentro de um mesmo campo
   - NÃO remova emojis ✅ e ❌ ANTES de extrair presença/ausência (veja regra de presença abaixo)

RECONHECIMENTO DE FUNÇÕES E ABREVIAÇÕES:
IMPORTANTE: As funções devem ser normalizadas para a lista padronizada abaixo. Use EXATAMENTE estes nomes:

FUNÇÕES PADRONIZADAS (use exatamente estes valores no campo "funcao"):
- Soldador Convencional
- Soldador Escalador N1
- Soldador Escalador N2
- Soldador Escalador N3
- Mecânico Convencional
- Mecânico Escalador N1
- Mecânico Escalador N2
- Mecânico Escalador N3
- Caldeireiro Convencional
- Caldeireiro Escalador N1
- Caldeireiro Escalador N2
- Caldeireiro Escalador N3
- Pintor Convencional
- Pintor Escalador N1
- Pintor Escalador N2
- Pintor Escalador N3
- Meio Oficial
- Programador
- Projetista
- Supervisor Escalador N3

MAPEAMENTO DE ABREVIAÇÕES E SINÔNIMOS:
- "Mec.", "Mec", "Mecânico", "mecanico", "Mecânico Convencional" → "Mecânico Convencional"
- "Mecânico N1", "Mec. N1", "Mec N1", "Mecânico Escalador N1", "Mec. Esc. N1" → "Mecânico Escalador N1"
- "Mecânico N2", "Mec. N2", "Mecânico Escalador N2" → "Mecânico Escalador N2"
- "Mecânico N3", "Mec. N3", "Mecânico Escalador N3" → "Mecânico Escalador N3"
- "Sold.", "Sold", "Soldador", "soldador", "Soldador Convencional" → "Soldador Convencional"
- "Soldador N1", "Sold. N1", "Soldador Escalador N1" → "Soldador Escalador N1"
- "Soldador N2", "Sold. N2", "Soldador Escalador N2" → "Soldador Escalador N2"
- "Soldador N3", "Sold. N3", "Soldador Escalador N3" → "Soldador Escalador N3"
- "Cald.", "Caldeireiro", "caldeireiro", "Caldeireiro Convencional" → "Caldeireiro Convencional"
- "Caldeireiro N1", "Cald. N1", "Caldeireiro Escalador N1" → "Caldeireiro Escalador N1"
- "Caldeireiro N2", "Cald. N2", "Caldeireiro Escalador N2" → "Caldeireiro Escalador N2"
- "Caldeireiro N3", "Cald. N3", "Caldeireiro Escalador N3" → "Caldeireiro Escalador N3"
- "Pintor", "pintor", "Pintor Convencional" → "Pintor Convencional"
- "Pintor N1", "Pintor Escalador N1" → "Pintor Escalador N1"
- "Pintor N2", "Pintor Escalador N2" → "Pintor Escalador N2"
- "Pintor N3", "Pintor Escalador N3" → "Pintor Escalador N3"
- "Meio Oficial", "meio oficial", "M.O.", "MO" → "Meio Oficial"
- "Programador", "programador", "Prog." → "Programador"
- "Projetista", "projetista", "Proj." → "Projetista"
- "Supervisor N3", "Sup. N3", "Supervisor Escalador N3" → "Supervisor Escalador N3"
- "Sup.", "Sup", "Supervisor", "supervisor" → "Supervisor"
- "Enc.", "Enc", "Encarregado", "encarregado" → "Encarregado"
- "Líd.", "Líder", "lider", "Lider" → "Líder"
- Quando a função for apenas "N1", "N2" ou "N3" sem tipo, tente inferir pelo contexto. Se não for possível, mantenha como está.
- Outras funções não listadas: normalize para Título Case (ex: "eletricista" → "Eletricista")

PADRÃO "NOME FUNÇÃO" SEM SEPARADOR:
Se o último token (palavra) de um nome for uma abreviação ou função reconhecida, separe-o como função:
- "Valeria TST" → {nome: "Valeria", funcao: "Técnico de Segurança"}
- "Joao Mec." → {nome: "João", funcao: "Mecânico"}
- "Carlos Elet." → {nome: "Carlos", funcao: "Eletricista"}
- "Pedro Sold." → {nome: "Pedro", funcao: "Soldador"}
- "Ana Eng." → {nome: "Ana", funcao: "Engenheiro"}
- "Maria Sup." → {nome: "Maria", funcao: "Supervisor"}
- "Lucas Enc." → {nome: "Lucas", funcao: "Encarregado"}
- Se houver uma lista de COLABORADORES CADASTRADOS NO SISTEMA fornecida, use-a como referência para corrigir grafias (ex: texto tem "Wilian" mas cadastro tem "Willian" → use "Willian").
- IMPORTANTE: Quando houver nomes repetidos na lista de COLABORADORES CADASTRADOS (ex: dois "João", dois "Carlos"), SEMPRE inclua o sobrenome para distinguir. Compare o texto com os nomes COMPLETOS da lista e retorne o nome completo mais provável. Nunca retorne apenas o primeiro nome se existem múltiplos cadastros com o mesmo primeiro nome.

PADRÃO CHECKMARK + NÍVEL + NOME:
Reconheça padrões com emojis de checkmark antes do nível/nome:
- "✔️N3 Cleberson" → {nome: "Cleberson", funcao: "N3", presente: true}
- "✅ N2 João" → {nome: "João", funcao: "N2", presente: true}
- "❌ N1 Pedro" → {nome: "Pedro", funcao: "N1", presente: false}
- "✔N3Cleberson" (sem espaço) → {nome: "Cleberson", funcao: "N3", presente: true}

PRESENÇA/AUSÊNCIA POR EMOJI:
ANTES de limpar emojis, detecte indicadores de presença/ausência:
- ✅, ✔️, ✔ antes ou ao lado de um nome → presente: true
- ❌, ✖ antes ou ao lado de um nome → presente: false
- Se NÃO houver emoji de presença/ausência, assuma presente: true (padrão)
- Extraia esta informação no campo "presente" do efetivo

RECONHECIMENTO DE SEÇÕES DO EFETIVO:
Identifique a seção de colaboradores/efetivo por qualquer um destes títulos ou sinônimos:
- "Efetivo:", "Efetivo do dia:", "Efetivo do Dia:"
- "Equipe:", "Equipe do dia:"
- "Pessoal:", "Pessoal presente:"
- "Mão de Obra:", "Mao de Obra:"
- "Time:", "Time de campo:"
- "Profissionais:", "Profissionais presentes:"
- "Colaboradores:", "Colaboradores presentes:"
- "Funcionários:", "Funcionarios:"
- Qualquer variação similar que liste nomes de pessoas

PADRÕES DE EXTRAÇÃO DE FUNÇÕES NO EFETIVO:
Interprete funções de colaboradores nos seguintes padrões:
- "Função - Nome" (ex: "Mecânico - João Silva" → {nome: "João Silva", funcao: "Mecânico"})
- "Nome - Função" (ex: "João Silva - Mecânico" → {nome: "João Silva", funcao: "Mecânico"})
- "Nome (Função)" (ex: "João Silva (Mecânico)" → {nome: "João Silva", funcao: "Mecânico"})
- "Nome / Função" (ex: "João Silva / Mecânico" → {nome: "João Silva", funcao: "Mecânico"})
- "N1: Nome" ou "N1 - Nome" (ex: "N1 - João Silva" → {nome: "João Silva", funcao: "N1"})
- "Supervisor - Nome" (ex: "Supervisor - João" → {nome: "João", funcao: "Supervisor"})
- Listas numeradas: "1. Nome - Função", "1) Nome - Função"
- Se a função NÃO for explícita no texto, retorne funcao como null (JSON null, NÃO a string "null")

EXTRAÇÃO DO SUPERVISOR A PARTIR DO EFETIVO:
Se o campo "supervisor" não for encontrado em uma seção dedicada do texto (ex: "Supervisor:", "👷🏽 Supervisor:"), 
MAS algum membro do efetivo tiver a função "Supervisor" ou "Encarregado", 
ENTÃO preencha o campo "supervisor" com o nome dessa pessoa.

EXTRAÇÃO DE HORÁRIOS:
Reconheça e normalize horários em qualquer formato:
- "7h", "07h", "7 horas" → "07:00"
- "7:00", "07:00" → "07:00"
- "07h00", "7h00" → "07:00"
- "7h30", "07h30" → "07:30"
- "14:30", "14h30" → "14:30"
- "Período: 07:00 às 14:00" → horaInicio: "07:00", horaFim: "14:00"
- "Das 7h às 17h" → horaInicio: "07:00", horaFim: "17:00"
- Horários malformados ou incompletos como "ás :30hrs", ":00hrs" → IGNORAR (retornar null), NÃO gerar erro

TRATAMENTO DE "N/A" E VALORES VAZIOS:
- Se a seção de desvios/interferências contiver APENAS "N/A", "NA", "Não houve", "Nenhum", "Nenhuma", "Sem desvios", "Sem interferência", "Não se aplica" → retorne array VAZIO []
- NÃO crie um objeto de desvio com descrição "N/A" — isso gera registros fantasmas
- O mesmo se aplica a atividades: se disser apenas "N/A" ou similar, retorne array vazio []

SEÇÃO DE INTERFERÊNCIA:
Identifique a seção "Interferência:", "Interferências:", "Interrupções:" no texto.
- Se houver interferências reais (não "N/A"), capture cada uma como um desvio com tipo "other"
- Exemplo: "Interferência: Parada de 30min por falta de liberação" → desvio com {descricao: "Parada de 30min por falta de liberação", tipo: "other", impacto: "medium", acaoCorretiva: null}

MAPEAMENTO DE SINÔNIMOS DE CAMPOS:
Diferentes supervisores usam termos/templates diferentes para o mesmo campo. Mapeie TODOS estes sinônimos ao campo correto:

localAtividade (Local/Área da atividade):
  "Área:", "Subárea:", "Sub área:", "Local:", "Local da atividade:", "Local da obra:", "Local de trabalho:", "Setor:", "Região:", "Unidade:"
  → Se houver "Área" E "Subárea" separados, concatene: "Área - Subárea" (ex: "Prédio das Moega - Corrimão")

radioWees (Faixa de rádio WEES):
  "Faixa de rádio WEES:", "Faixa de Rádio Wees:", "Rádio Wees:", "Canal Wees:", "Faixa Wees:"

radioOperacao (Faixa de rádio da operação/cliente):
  "Faixa de rádio CSN:", "Faixa de rádio Operação:", "Faixa de rádio operação:", "Rádio CSN:", "Rádio Operação:", "Canal Operação:", "Canal CSN:", "Faixa de rádio cliente:"

horaInicio / horaFim (Período de trabalho):
  "Período de trabalho:", "Horário de Trabalho:", "Início:/Término:", "07:00 hrs as 17:00hrs", "Das Xh às Yh", "Horário:", "Período:"

horarioChegadaLiberador:
  "Horário de chegada na unidade:", "Horário de chegada na sala do liberador:", "Chegada à sala do liberador:", "Chegada na sala do liberador:", "Chegada liberador:", "Horário chegada:"

horarioLiberacao:
  "Horário de contato:", "Horário da liberação:", "Liberação da documentação:", "Horário da liberação da documentação:", "Liberação da atividade:", "Horário liberação:", "Liberação do bloqueio:"

bloqueio:
  "Bloqueio:", "Execução de bloqueio:", "Execução de bloqueio essa elétrico/mecânico:", "Status bloqueio:", "Bloqueio elétrico/mecânico:"

atividades:
  "Atividades Executadas:", "Realizado no dia:", "Atividades realizadas:", "Serviços executados:", "Trabalhos realizados:", "Descrição dos serviços:", "Serviços realizados:"

desvios/interferências:
  "Interferências:", "INTERFERENCIAS:", "Interferência:", "Desvios:", "Ocorrências:", "Interrupções:", "Problemas:"

numeroOM:
  "Nº OM:", "OM:", "Ordem:", "N° OM:", "Nº contrato:", "Contrato:", "Número da OM:"

tituloOM:
  "Título da OM:", "Título OM:", "Descrição da OM:", "Serviço:"

supervisor:
  "Supervisor:", "👷🏽 Supervisor:", "Encarregado:", "Enc:", "Responsável:", "Líder:"

responsavelTecnico:
  "Responsável Técnico:", "RT:", "Engenheiro:", "Técnico Responsável:", "Eng.:", "Engenheiro responsável:"

Analise o texto e extraia os seguintes campos (retorne null se não encontrar):

- data: data no formato YYYY-MM-DD. Reconheça TODOS estes formatos de entrada: DD/MM/YYYY, DD/MM/YY, DD.MM.YYYY, DD.MM.YY, DD-MM-YY, DD-MM-YYYY (ex: "06.05.26" → "2026-05-06", "06/05/2026" → "2026-05-06"). Ano de 2 dígitos SEMPRE vira 20XX. PRESERVE EXATAMENTE o dia e mês do texto, NUNCA invente ou troque dígitos.
- turno: SEMPRE retorne um valor (nunca null). Regras: "night" se aparecer "noturno"/"noite"/"Noturno" no título/cabeçalho OU se horaInicio >= 18:00 OU horaInicio <= 05:59 (ex.: período "19:00 às 07:00" é night); "afternoon" se "tarde"/"vespertino" OU horaInicio entre 12:00 e 17:59; "morning" se "diurno"/"manhã"/"matutino" OU horaInicio entre 06:00 e 11:59 (ex.: período "07:00 às 19:00" é morning). Use o horário de início como critério principal quando não houver palavra-chave explícita.
- localAtividade: local/área onde a atividade foi realizada. Sinônimos: "Área:", "Subárea:", "Local:", "Setor:", "Região:", "Unidade:". Se houver Área + Subárea, concatene com " - ".
- horaInicio: horário de início no formato HH:MM (extraia do período de trabalho)
- horaFim: horário de fim no formato HH:MM (extraia do período de trabalho)
- radioWees: canal/faixa de rádio da Wees (procurar "Faixa de rádio Wees:", "rádio Wees:")
- radioOperacao: canal/faixa de rádio da Operação (procurar "Faixa de rádio Operação:", "Operação:")
- numeroOM: número da ordem de manutenção (procurar "Nº OM:", "OM:", "Ordem:", "N° OM:")
- tituloOM: título da ordem de manutenção (procurar "Título da OM:", "Título OM:")
- tituloTrabalho: título ou descrição principal do trabalho/manutenção
- horarioChegadaLiberador: horário de chegada ao liberador no formato HH:MM (procurar "chegada na sala do liberador:", "chegada liberador:")
- horarioLiberacao: horário de liberação do bloqueio/documento no formato HH:MM (procurar "liberação da atividade:", "Horário da liberação:")
- bloqueio: status ou descrição do bloqueio (procurar "Bloqueio:", pode ser "NA", "sim", "não", ou descrição)
- horarioRevalidacaoBloqueio: horário de revalidação do bloqueio no formato HH:MM
- atividades: array de strings com cada atividade executada (limpe marcadores, formate com capitalização correta e acentuação). Se for "N/A" ou similar, retorne array vazio [].
- efetivo: array de objetos {nome: string, funcao: string|null, presente: boolean} com os nomes, funções e presença das pessoas. IMPORTANTE: funcao deve ser null (JSON null) quando não identificada, NUNCA a string "null". FORMATE OS NOMES CORRETAMENTE. O campo "presente" deve ser true por padrão, e false APENAS se houver indicador explícito de ausência (❌).
- pontoAmbulancia: local do ponto de ambulância mais próximo
- pontoEncontro: ponto de encontro de emergência
- desvios: array de objetos com {descricao, tipo, impacto, acaoCorretiva} para cada desvio/ocorrência/interferência encontrada. tipo pode ser: "delay", "equipment", "safety", "other". impacto pode ser: "low", "medium", "high". Se não houver desvios ou se for "N/A"/"Não houve", retorne array VAZIO [].
- supervisor: nome do supervisor da equipe/obra (procurar por "Supervisor:", "👷🏽 Supervisor:", "Encarregado:", "Enc:" etc.). Se não encontrar em seção dedicada, extraia do efetivo se alguém tiver função "Supervisor" ou "Encarregado". FORMATE O NOME CORRETAMENTE.
- responsavelTecnico: nome do responsável técnico/engenheiro (procurar por "Responsável Técnico:", "RT:", "Engenheiro:", "Técnico Responsável:", "Eng." etc.) - FORMATE O NOME CORRETAMENTE
- comentarios: observações gerais ou comentários adicionais do relatório (procurar "Obs:", "Observação:", "Observações:")

MUITO IMPORTANTE - Os campos do JSON DEVEM ser EXATAMENTE como listados acima.
Retorne APENAS um objeto JSON válido, sem markdown ou explicações.
Use null para campos não encontrados.
Para atividades, separe cada item em uma string diferente no array.
Para efetivo, extraia os nomes e funções das pessoas como objetos {nome, funcao, presente}, FORMATADOS CORRETAMENTE (ex: "Ronieri", não "RONIERI"). A função deve ser normalizada (ex: "Mec." → "Mecânico"). Se não houver função explícita, use null (JSON null, NÃO a string "null"). O campo presente deve ser true por padrão.
Para desvios, extraia cada desvio/ocorrência/interferência mencionado. Se for "N/A" ou similar, retorne [].
Normalize horários para formato HH:MM (ex: "07:00" não "7:00"). Ignore horários malformados.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, registeredNames } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Texto do relatório é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Configuração de IA não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsing report text with AI...');
    console.log('Text length:', text.length);
    if (registeredNames?.length) {
      console.log('Registered names count:', registeredNames.length);
    }

    let userMessage = `Extraia as informações deste relatório de obra:\n\n${text}`;
    if (Array.isArray(registeredNames) && registeredNames.length > 0) {
      userMessage += `\n\n---\nCOLABORADORES CADASTRADOS NO SISTEMA (use como referência para corrigir grafias e identificar pessoas):\n${registeredNames.join(', ')}`;
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_report",
              description: "Extrai dados estruturados de um relatório de obra",
              parameters: {
                type: "object",
                properties: {
                  data: { type: "string", description: "Data no formato YYYY-MM-DD" },
                  turno: { type: "string", enum: ["morning", "afternoon", "night"], description: "Turno de trabalho" },
                  localAtividade: { type: "string", description: "Local da atividade" },
                  horaInicio: { type: "string", description: "Horário início HH:MM" },
                  horaFim: { type: "string", description: "Horário fim HH:MM" },
                  radioWees: { type: "string", description: "Faixa de rádio Wees" },
                  radioOperacao: { type: "string", description: "Faixa de rádio Operação" },
                  numeroOM: { type: "string", description: "Número da OM" },
                  tituloOM: { type: "string", description: "Título da OM" },
                  tituloTrabalho: { type: "string", description: "Título do trabalho" },
                  horarioChegadaLiberador: { type: "string", description: "Horário chegada liberador HH:MM" },
                  horarioLiberacao: { type: "string", description: "Horário liberação HH:MM" },
                  bloqueio: { type: "string", description: "Status do bloqueio" },
                  horarioRevalidacaoBloqueio: { type: "string", description: "Horário revalidação HH:MM" },
                  atividades: { type: "array", items: { type: "string" }, description: "Lista de atividades executadas. Retorne [] se for N/A." },
                  efetivo: { 
                    type: "array", 
                    items: { 
                      type: "object", 
                      properties: { 
                        nome: { type: "string", description: "Nome completo da pessoa, formatado corretamente" }, 
                        funcao: { type: "string", description: "Função/cargo normalizado. Use null se não identificada." },
                        presente: { type: "boolean", description: "true se presente (padrão), false se ausente (indicado por ❌)" }
                      }, 
                      required: ["nome", "presente"] 
                    }, 
                    description: "Lista de pessoas do efetivo com presença. Detecte ✅/❌ para definir presente. Padrão é true." 
                  },
                  pontoAmbulancia: { type: "string", description: "Ponto de ambulância" },
                  pontoEncontro: { type: "string", description: "Ponto de encontro" },
                  desvios: { 
                    type: "array", 
                    items: { 
                      type: "object",
                      properties: {
                        descricao: { type: "string" },
                        tipo: { type: "string", enum: ["delay", "equipment", "safety", "other"] },
                        impacto: { type: "string", enum: ["low", "medium", "high"] },
                        acaoCorretiva: { type: "string" }
                      }
                    },
                    description: "Lista de desvios/ocorrências/interferências. Retorne [] se for N/A ou 'Não houve'."
                  },
                  supervisor: { type: "string", description: "Nome do supervisor. Extraia do efetivo se não houver seção dedicada." },
                  responsavelTecnico: { type: "string", description: "Nome do responsável técnico" },
                  comentarios: { type: "string", description: "Observações gerais" }
                },
                required: []
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "parse_report" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos na sua conta Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao processar com IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    
    let parsedData;
    try {
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall && toolCall.function?.arguments) {
        parsedData = JSON.parse(toolCall.function.arguments);
        console.log('Parsed from tool call:', parsedData);
      } else {
        const content = aiResponse.choices?.[0]?.message?.content;
        if (!content) {
          console.error('No content or tool call in AI response');
          return new Response(
            JSON.stringify({ error: 'Resposta vazia da IA' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.log('Fallback to content parsing:', content);
        let cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const lastBrace = cleanContent.lastIndexOf('}');
        if (lastBrace !== -1) {
          cleanContent = cleanContent.substring(0, lastBrace + 1);
        }
        parsedData = JSON.parse(cleanContent);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(
        JSON.stringify({ error: 'Não foi possível interpretar a resposta da IA. Tente novamente.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize efetivo: ensure funcao is null (not "null" string), ensure presente is boolean
    if (parsedData.efetivo && Array.isArray(parsedData.efetivo)) {
      parsedData.efetivo = parsedData.efetivo.map((item: any) => {
        if (typeof item === 'string') return { nome: item, funcao: null, presente: true };
        return {
          ...item,
          funcao: (item.funcao === 'null' || item.funcao === '' || item.funcao === undefined) ? null : item.funcao,
          presente: item.presente === false ? false : true,
        };
      });
    }

    // Clean up "N/A" ghost deviations
    if (parsedData.desvios && Array.isArray(parsedData.desvios)) {
      parsedData.desvios = parsedData.desvios.filter((d: any) => {
        const desc = (d.descricao || '').trim().toLowerCase();
        return desc && !['n/a', 'na', 'não houve', 'nenhum', 'nenhuma', 'sem desvios', 'sem interferência', 'não se aplica'].includes(desc);
      });
    }

    // Normalize field names to handle variations
    const normalizedData = {
      ...parsedData,
      atividades: parsedData.atividades || parsedData.activas || parsedData.activities || null,
      efetivo: parsedData.efetivo || parsedData.workforce || parsedData.team || parsedData.equipe || null,
      pontoAmbulancia: parsedData.pontoAmbulancia || parsedData.ambulancia || parsedData.ambulancePoint || null,
      pontoEncontro: parsedData.pontoEncontro || parsedData.meetingPoint || null,
      horarioChegadaLiberador: parsedData.horarioChegadaLiberador || parsedData.chegadaLiberador || null,
      horarioRevalidacaoBloqueio: parsedData.horarioRevalidacaoBloqueio || parsedData.revalidacaoBloqueio || null,
      desvios: parsedData.desvios || parsedData.ocorrencias || parsedData.deviations || null,
      supervisor: parsedData.supervisor || parsedData.encarregado || parsedData.supervisorNome || null,
      responsavelTecnico: parsedData.responsavelTecnico || parsedData.rt || parsedData.engenheiro || parsedData.tecnicoResponsavel || null,
      comentarios: parsedData.comentarios || parsedData.observacoes || parsedData.comments || parsedData.obs || null,
      numeroOM: parsedData.numeroOM || parsedData.om || parsedData.ordemManutencao || null,
      tituloOM: parsedData.tituloOM || parsedData.tituloOrdem || null,
      bloqueio: parsedData.bloqueio || parsedData.statusBloqueio || null,
    };
    
    // Remove any extra fields
    const extraKeys = ['activas', 'activities', 'workforce', 'team', 'equipe', 'ambulancia', 'ambulancePoint', 'meetingPoint', 'chegadaLiberador', 'revalidacaoBloqueio', 'ocorrencias', 'deviations', 'observacoes', 'comments', 'obs', 'encarregado', 'supervisorNome', 'rt', 'engenheiro', 'tecnicoResponsavel', 'om', 'ordemManutencao', 'tituloOrdem', 'statusBloqueio'];
    for (const key of extraKeys) {
      delete normalizedData[key];
    }

    // Clean up N/A activities too
    if (normalizedData.atividades && Array.isArray(normalizedData.atividades)) {
      normalizedData.atividades = normalizedData.atividades.filter((a: string) => {
        const val = (a || '').trim().toLowerCase();
        return val && !['n/a', 'na', 'não houve', 'nenhum', 'nenhuma'].includes(val);
      });
    }

    console.log('Successfully parsed and normalized report data:', normalizedData);

    return new Response(
      JSON.stringify({ success: true, data: normalizedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in parse-report-text function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
