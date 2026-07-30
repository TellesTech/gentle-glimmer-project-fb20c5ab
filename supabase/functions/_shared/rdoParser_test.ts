import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildProjectName,
  mergeParsed,
  parseRdoDeterministic,
  routeProject,
  sanitizeOmNumber,
} from "./rdoParser.ts";

// ---------------------------------------------------------------------------
// A) Modelo antigo completo
// ---------------------------------------------------------------------------
const CASE_A = `RELATÓRIO DIÁRIO DE OBRA
Data: 29/07/2026
Local: TR 09
Horário de Trabalho
Início: 07:00
Término: 17:00
Faixa de Rádio WEES: 01
Faixa de Rádio Operação: 13
Nº da OM: 22461261
Título da OM: Transportadora 09
Registro de Horários
Chegada à sala do liberador: 07:50
Liberação da documentação: 09:30
Revalidação de bloqueio:
Equipe de Trabalho
Antonio Carlos
Bruno Silva
Carlos Eduardo
Daniel Souza
Edson Ramos
Fabio Lima
Gabriel Nunes
Hugo Martins
Igor Pereira
Joao Vitor
Kleber Dias
Lucas Rocha
Marcos Aurelio
Nelson Farias
Atividades Executadas:
* Limpeza da estrutura da TR 09
* Inspeção de roletes
* Troca de chapas de desgaste
Interferências: N/A
Observações: Atividade concluída no turno.`;

Deno.test("A - modelo antigo com Equipe de Trabalho e Registro de Horários", () => {
  const r = parseRdoDeterministic(CASE_A);
  assertEquals(r.data, "2026-07-29");
  assertEquals(r.localAtividade, "TR 09");
  assertEquals(r.horaInicio, "07:00");
  assertEquals(r.horaFim, "17:00");
  assertEquals(r.radioWees, "01");
  assertEquals(r.radioOperacao, "13");
  assertEquals(r.numeroOM, "22461261");
  assertEquals(r.tituloOM, "Transportadora 09");
  assertEquals(r.horarioChegadaLiberador, "07:50");
  assertEquals(r.horarioLiberacao, "09:30");
  assertEquals(r.horarioRevalidacaoBloqueio, null);
  assertEquals(r.efetivo.length, 14);
  assertEquals(r.efetivo[0].nome, "Antonio Carlos");
  assertEquals(r.atividades.length, 3);
  assertEquals(r.desvios.length, 0);
  assertEquals(r.comentarios, "Atividade concluída no turno.");
  assertEquals(r.turno, "morning");
});

// ---------------------------------------------------------------------------
// B) OM vazia
// ---------------------------------------------------------------------------
const CASE_B = `Data: 28/07/2026
Local: SECAGEM C
Nº da OM:
Título da OM: Montagem de linha de vida / Limpeza da TCM
Chegada à sala do liberador:
Liberação da documentação:
Revalidação de bloqueio:
Efetivo do Dia
1. Ana Paula
2. Bruno Costa
3. Carlos Henrique
4. Diego Alves
5. Eduardo Lima
6. Felipe Moura
Atividades Executadas:
- Montagem parcial da linha de vida
Observações: Atividade em andamento`;

Deno.test("B - OM vazia, título composto, 6 nomes", () => {
  const r = parseRdoDeterministic(CASE_B);
  assertEquals(r.data, "2026-07-28");
  assertEquals(r.numeroOM, null);
  assertEquals(r.tituloOM, "Montagem de linha de vida / Limpeza da TCM");
  assertEquals(r.localAtividade, "SECAGEM C");
  assertEquals(r.efetivo.length, 6);
  assertEquals(r.efetivo[5].nome, "Felipe Moura");
  assertEquals(r.horarioChegadaLiberador, null);
  assertEquals(r.comentarios, "Atividade em andamento");
});

// ---------------------------------------------------------------------------
// C) Horários com "h"
// ---------------------------------------------------------------------------
const CASE_C = `Data: 27/07/2026
Local: Secagem C
Nº da OM:
Título da OM: Secagem C
Chegada à sala do liberador: 17h
Liberação da documentação: 17:30h
Atividades Executadas:
• Limpeza geral
• Retirada de resíduos
Observações: Sem intercorrências relevantes`;

Deno.test("C - horários 17h / 17:30h normalizados", () => {
  const r = parseRdoDeterministic(CASE_C);
  assertEquals(r.data, "2026-07-27");
  assertEquals(r.numeroOM, null);
  assertEquals(r.tituloOM, "Secagem C");
  assertEquals(r.horarioChegadaLiberador, "17:00");
  assertEquals(r.horarioLiberacao, "17:30");
  assertEquals(r.atividades.length, 2);
});

// ---------------------------------------------------------------------------
// D) Template canônico
// ---------------------------------------------------------------------------
const CASE_D = `📌 *RELATÓRIO DIÁRIO DE OBRA (RDO)*

📆 *Data/Turno:* 30/07/2026 – Noturno

🔹 *Atividade:* Tratamento e pintura

📍 *Área da Atividade:* Pátio de Madeiras

⏰ *Horário de Trabalho:* 19:00 às 07:00

📡 *Faixa de Rádio (WEES):* 05

📡 *Faixa de Rádio (Operação):* 12

📄 *Título da OM (Obrigatório):* Reparo de calhas do Alto Forno

📝 *Número da OM:* 900037786367

🚑 *Ponto de Ambulância:* Portaria 3

🚨 *Ponto de Encontro:* Estacionamento A

━━━━━━━━━━━━━━━━━━━━

⏱️ *Controle de Liberação*

• Chegada à sala do liberador: 18:30
• Liberação da documentação: 19:10
• Revalidação de bloqueio: 23:00

━━━━━━━━━━━━━━━━━━━━

🛠️ *Atividades Executadas*

• Aplicação de primer nas calhas
• Lixamento das estruturas

━━━━━━━━━━━━━━━━━━━━

📌 *Desvios / Ocorrências*

• Falta de energia por 30 minutos

━━━━━━━━━━━━━━━━━━━━

🧗‍♂️ *Efetivo do Dia*

1. Ronieri Souza
2. Anacleto Dias
3. José Silva

✅ *Observações:* Serviço seguirá amanhã

📷 *Fotos abaixo:*`;

Deno.test("D - template canônico completo", () => {
  const r = parseRdoDeterministic(CASE_D);
  assertEquals(r.data, "2026-07-30");
  assertEquals(r.turno, "night");
  assertEquals(r.atividade, "Tratamento e pintura");
  assertEquals(r.localAtividade, "Pátio de Madeiras");
  assertEquals(r.horaInicio, "19:00");
  assertEquals(r.horaFim, "07:00");
  assertEquals(r.radioWees, "05");
  assertEquals(r.radioOperacao, "12");
  assertEquals(r.tituloOM, "Reparo de calhas do Alto Forno");
  assertEquals(r.numeroOM, "900037786367");
  assertEquals(r.pontoAmbulancia, "Portaria 3");
  assertEquals(r.pontoEncontro, "Estacionamento A");
  assertEquals(r.horarioChegadaLiberador, "18:30");
  assertEquals(r.horarioLiberacao, "19:10");
  assertEquals(r.horarioRevalidacaoBloqueio, "23:00");
  assertEquals(r.atividades.length, 2);
  assertEquals(r.desvios.length, 1);
  assertEquals(r.efetivo.length, 3);
  assertEquals(r.efetivo[0].nome, "Ronieri Souza");
  assertEquals(r.comentarios, "Serviço seguirá amanhã");
});

// ---------------------------------------------------------------------------
// E) OM "N.A."
// ---------------------------------------------------------------------------
Deno.test("E - OM N.A. vira null", () => {
  assertEquals(sanitizeOmNumber("N.A."), null);
  assertEquals(sanitizeOmNumber("NA"), null);
  assertEquals(sanitizeOmNumber("N/A"), null);
  assertEquals(sanitizeOmNumber("-"), null);
  assertEquals(sanitizeOmNumber("0"), null);
  assertEquals(sanitizeOmNumber("sem OM"), null);
  assertEquals(sanitizeOmNumber("Título da OM"), null);
  assertEquals(sanitizeOmNumber("OM 22461261"), "22461261");
  const r = parseRdoDeterministic("Data: 01/02/2026\nNº da OM: N.A.\nTítulo da OM: Teste");
  assertEquals(r.numeroOM, null);
  assertEquals(buildProjectName(r.numeroOM, r.tituloOM), "Teste");
});

// ---------------------------------------------------------------------------
// F) Desvios N/A
// ---------------------------------------------------------------------------
Deno.test("F - Desvios / Ocorrências: N/A vira []", () => {
  const r = parseRdoDeterministic(
    "Data: 01/02/2026\nDesvios / Ocorrências: N/A\nAtividades Executadas:\n• Teste"
  );
  assertEquals(r.desvios.length, 0);
  assertEquals(r.atividades.length, 1);
  const merged = mergeParsed(r, { desvios: [{ descricao: "N/A", tipo: "other" }] });
  assertEquals(merged.desvios.length, 0);
});

// ---------------------------------------------------------------------------
// G) Roteamento com OM explícita diferente
// ---------------------------------------------------------------------------
Deno.test("G - palavras genéricas não causam associação errada", () => {
  const projects = [
    { id: "p1", name: "OM 111111 — Limpeza da linha de vida" },
    { id: "p2", name: "OM 222222 — Montagem de linha de vida" },
  ];
  const res = routeProject({ omNumber: "333333", omTitle: "Limpeza da TCM", projects });
  assertEquals(res.projectId, null);
  assertEquals(res.reason, "om_not_found");

  const res2 = routeProject({ omNumber: "222222", omTitle: "Qualquer coisa", projects });
  assertEquals(res2.projectId, "p2");

  const res3 = routeProject({
    omNumber: "999999",
    omTitle: null,
    projects,
    projectOmNumbers: { p1: ["999999"] },
  });
  assertEquals(res3.projectId, "p1");

  // Sem OM: título genérico de uma palavra não pode rotear
  const res4 = routeProject({ omNumber: null, omTitle: "Limpeza", projects });
  assertEquals(res4.projectId, null);
});

Deno.test("buildProjectName nunca usa rótulo/horário", () => {
  assertEquals(buildProjectName(null, "Título da OM"), null);
  assertEquals(buildProjectName(null, "07:00"), null);
  assertEquals(buildProjectName("22461261", "Transportadora 09"), "OM 22461261 — Transportadora 09");
  assertEquals(buildProjectName("22461261", ""), "OM 22461261");
});

Deno.test("merge: valores determinísticos vencem a IA", () => {
  const det = parseRdoDeterministic(CASE_A);
  const merged = mergeParsed(det, {
    numeroOM: "999999",
    localAtividade: "Outro lugar",
    tituloOM: "TR 09",
    data: "2025-01-01",
  });
  assertEquals(merged.numeroOM, "22461261");
  assertEquals(merged.localAtividade, "TR 09");
  assertEquals(merged.tituloOM, "Transportadora 09");
  assertEquals(merged.data, "2026-07-29");
});