# Assinaturas: funções completas para super admin + modo "visão do cliente"

## 1. Painel Assinaturas (Área WEES, /admin/signatures)
Hoje a tela é só leitura: lista, filtros e dois ícones (baixar PDF assinado / abrir RDO). Para super admin passa a ter:

- Coluna de ações ampliada: abrir o RDO interno, abrir a **visão do cliente** daquele RDO, baixar PDF (gera na hora quando não existe PDF assinado) e copiar o link de assinatura do cliente.
- Reenviar cobrança de assinatura ao contato pendente (mesma ação já usada no envio para assinatura).
- Ver detalhes de quem assinou/falta assinar direto na linha (nome, papel, data), sem sair da página.
- Ações internas ficam visíveis apenas para super admin/admin; demais internos continuam com a visão de leitura atual.

## 2. Tela do RDO com assinaturas (visão do portal)
Quando um usuário interno WEES abre o RDO no portal, ele passa a ver um bloco "Ações WEES" com:

- Baixar PDF (já existe), abrir o RDO na área interna, copiar link de assinatura e reenviar para o cliente.
- Linha do tempo de assinaturas completa (todos os signatários, internos e cliente, com status e data).

## 3. Botão "Ver como cliente" (alterna na mesma tela)
- Botão no topo das duas telas: **Ver como cliente / Voltar à visão WEES**.
- Ao ativar, some tudo que é interno (ações WEES, links administrativos, badges internos) e a página fica exatamente como o cliente enxerga; um aviso discreto no topo indica "Você está vendo como cliente".
- O estado fica na URL (`?view=client`), então dá para atualizar a página ou compartilhar mantendo o modo.
- Visível somente para super admin/admin — cliente nunca vê o botão.

## Detalhes técnicos
- Novo hook simples `useClientPreviewMode()` lendo/gravando `view=client` no `useSearchParams`, usado por `src/pages/ClientReportView.tsx` e `src/pages/AdminSignatures.tsx`.
- `src/pages/ClientReportView.tsx`: `isWeesUser && !clientPreview` passa a controlar o bloco de ações internas; adicionar botões (abrir `/reports/:id`, copiar link, reenviar) e manter `SignatureTimeline` completa.
- `src/pages/AdminSignatures.tsx`: usar `useAuth().role` para liberar ações de super admin/admin; adicionar botão que navega para `/client/reports/:reportId`, botão de PDF via `getReportPdfBlob`, cópia de link e reenvio reutilizando a função de envio já existente (`SendForSignatureDialog`/edge function correspondente).
- Nenhuma mudança de banco: apenas UI e reuso de funções/edge functions já existentes.
