# Padronizar botões "Voltar" no portal do cliente

Hoje cada tela usa um estilo diferente de voltar (botão com texto "Voltar", seta em caixa, seta no header colorido). O padrão desejado é o usado na pasta do mês: seta redonda discreta + ícone colorido + título da página.

## Padrão único

```text
( ‹ )  [icone]  Fevereiro 2026
```

- Botão ghost redondo (h-9 w-9, `rounded-full hover:bg-muted`) com chevron para a esquerda
- Badge de ícone arredondado com cor do contexto (calendário, documento, atividade)
- Título em `text-xl font-bold` ao lado
- Sem a palavra "Voltar" e sem botão em caixa

## Implementação

1. Criar `src/components/client/PageBackHeader.tsx` com props `onBack`, `icon`, `iconClassName`, `title`, `subtitle?` reproduzindo exatamente o bloco atual do mês em `ClientDashboard.tsx`.
2. Reaproveitar o componente no próprio `ClientDashboard.tsx` (drill-down do mês), sem mudança visual.
3. Substituir os botões atuais por esse header em:
   - `src/pages/client/ClientActivityList.tsx` (botão "Voltar" + breadcrumb)
   - `src/pages/client/ClientReports.tsx` (botão "Voltar" no topo)
   - `src/pages/ClientReportView.tsx` (voltar para a lista de RDOs)
   - `src/components/client/ClientHeader.tsx` / `ClientLayout.tsx` (setas em caixa) quando exibem voltar
4. Manter os destinos de navegação atuais (mesmos `navigate(...)` e query params).

## Observação

Mudança apenas visual/estrutural de UI; nenhuma lógica de dados ou rota é alterada.
