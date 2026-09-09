# Assinatura digitada salva e assinatura com 1 clique

## Situação atual

- Na tela de um RDO, o cliente pode digitar o nome (vira uma imagem de assinatura) ou enviar uma imagem. Já existe a opção de guardar essa assinatura no perfil, marcada por padrão.
- Na assinatura em lote (assinar vários RDOs de uma vez), a assinatura precisa ser refeita sempre: não aproveita a assinatura já cadastrada nem oferece guardá-la.
- Quem nunca assinou continua sem assinatura cadastrada até assinar um relatório ou entrar no perfil.

## O que será feito

1. **Assinatura digitada tratada como assinatura oficial**
   - Ao digitar o nome e concluir a assinatura, ela é gravada no perfil do cliente (mesmo caminho já usado para a assinatura desenhada/enviada), com a opção de desmarcar antes de confirmar.
   - Vale para a tela do RDO e para a assinatura em lote.

2. **Assinatura em lote com 1 clique**
   - Se o cliente já tem assinatura salva, a janela mostra a assinatura cadastrada e um único botão "Assinar todos os RDOs selecionados".
   - Links "Usar outra assinatura desta vez" e "Voltar para minha assinatura cadastrada", iguais aos da tela do RDO.
   - Sem assinatura salva: campos de digitar/enviar, com a caixinha "Salvar esta assinatura no meu perfil" marcada por padrão.

3. **Perfil do cliente**
   - O bloco de assinatura passa a deixar claro que a assinatura digitada também pode ser cadastrada ali, e continua permitindo trocar ou remover.

4. **Atualização imediata**
   - Depois de salvar, a assinatura aparece na hora nas telas de RDO, na lista de responsáveis da unidade e na assinatura em lote, sem precisar sair e entrar de novo.

## Detalhes técnicos

- `src/components/client/BulkSignatureDialog.tsx`: substituir o `SignatureInput` isolado pelo `OneClickSignatureCard` (ou reaproveitar sua lógica), recebendo `identity.savedSignature` do perfil do cliente e `allowSaveSignature`.
- `src/components/signatures/OneClickSignatureCard.tsx`: já emite `onSign(sig, { saveToProfile })`; ajustar o texto para cobrir assinatura digitada.
- Persistência via edge function existente `save-client-signature` (grava em `company_contacts.signature_data` ou `client_profiles.signature_data`), chamada após a assinatura ser registrada com sucesso.
- Invalidação de cache: `usePortalResponsibles` e as queries de relatório/lote, além de `refreshProfile()` no `ClientAuthContext`.
- Nada muda no fluxo de PIN nem nas assinaturas internas da WEES.
