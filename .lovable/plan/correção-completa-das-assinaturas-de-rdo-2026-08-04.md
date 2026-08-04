# Correção completa das assinaturas de RDO

## Objetivo
Fazer a assinatura funcionar de forma consistente para usuários WEES, responsáveis da Suzano, demais clientes e convidados por link, mantendo identificação correta do signatário e trilha de auditoria.

## Diagnóstico confirmado
- O `submit-signature` implantado grava `document_hash`, `document_version` e `geolocation`.
- No banco ativo, somente `document_hash` existe; `document_version`, `geolocation` e a tabela `signature_audit_log` estão ausentes.
- Por isso a primeira correção apenas mudou o erro: agora o PostgREST retorna `PGRST204` para `document_version`.
- O mesmo conjunto de campos também é usado na assinatura em lote, portanto a correção precisa abranger os dois caminhos.
- A função usa credenciais privilegiadas e atualmente aceita identidade do signatário enviada pelo navegador; esse ponto será corrigido para impedir assinatura em nome de outra pessoa.

## Implementação
1. **Alinhar o banco com o fluxo de assinatura**
   - Adicionar a `report_signatures` os campos legais ausentes: versão do documento e geolocalização.
   - Criar a trilha `signature_audit_log` com permissões explícitas, RLS e acesso restrito aos perfis autorizados.
   - Recarregar o cache do PostgREST para os novos campos ficarem disponíveis imediatamente.

2. **Separar e validar os tipos de signatário**
   - WEES autenticado: validar o token da sessão e obter nome, e-mail, usuário e função a partir do cadastro confiável.
   - Suzano e demais clientes autenticados: validar sessão e vínculo com o RDO/portal antes de permitir a assinatura.
   - Convidado por link: validar token, validade e relatório associado; usar somente a identidade vinculada ao convite.
   - Não aceitar do navegador um usuário alternativo como proprietário da assinatura.

3. **Unificar os caminhos de gravação**
   - Aplicar as mesmas validações e campos compatíveis em `submit-signature` e `submit-bulk-signatures`.
   - Manter prevenção de duplicidade por relatório e signatário, sem bloquear pessoas diferentes que precisam assinar o mesmo RDO.
   - Registrar sucesso e falha de auditoria sem deixar uma assinatura válida falhar por erro secundário de log.
   - Retornar ao frontend a mensagem real e amigável para erros de duplicidade, acesso, convite expirado e banco.

4. **Atualizar as chamadas das telas**
   - Enviar os dados mínimos necessários nas páginas interna e do cliente.
   - Preservar a experiência atual, mas apresentar erro específico em vez do genérico “Edge Function returned a non-2xx status code”.
   - Atualizar os tipos gerados para refletir o esquema final.

## Verificação
- Executar a função real com sessão WEES e confirmar a linha gravada com o usuário correto.
- Executar com responsável Suzano/cliente e confirmar vínculo, nome, e-mail e empresa corretos.
- Testar um convidado por link válido e um link inválido/expirado.
- Tentar enviar outro `signerUserId` pelo navegador e confirmar que ele é ignorado ou rejeitado.
- Confirmar que duas pessoas diferentes podem assinar o mesmo RDO e que a mesma pessoa não duplica assinatura.
- Validar assinatura em lote e assinatura individual.
- Conferir a trilha de auditoria, os logs finais da função e o registro persistido no banco.
- Executar o linter de segurança após a migração.

## Resultado esperado
WEES, Suzano, outros clientes e convidados conseguem assinar conforme sua autorização, com identidade correta, sem erros de coluna ausente e com auditoria legal completa.