# Liberar o João para assinar todos os RDOs de "atividades diversas - HK"

## O que está acontecendo

O João Santos (joao.santos.js5@suzano.com.br) está ativo e com permissão de aprovar na Suzano, mas ele só está indicado como signatário em 6 dos 38 RDOs dessa pasta. Nos outros 32 o único indicado é o Lucas Rosa. Quando o João abre um desses RDOs e tenta assinar, o sistema responde "Você não está indicado para assinar este RDO".

Ou seja: não é um erro de tela, é falta de indicação dele nos relatórios.

## Correção em duas partes

### 1. Liberar agora os RDOs existentes
Incluir o João como signatário pendente em todos os RDOs da unidade Suzano Aracruz que já estão enviados/concluídos/assinados e nos quais ele ainda não consta. Isso vale para a pasta "atividades diversas - HK" e para as demais pastas da mesma unidade, para não voltar a acontecer em outra atividade.

Nada é sobrescrito: assinaturas já feitas e o status dos RDOs continuam como estão.

### 2. Evitar que o problema volte
Ajustar a regra de assinatura para que qualquer contato ativo da empresa cliente, com permissão de aprovar e vinculado à unidade do RDO, possa assinar mesmo que não tenha sido indicado individualmente. Nesse caso o sistema registra a indicação automaticamente no momento da assinatura, mantendo o histórico correto (quem assinou, quando) e a mudança de status para "assinado" quando todos assinarem.

Quem não pertence à empresa/unidade do RDO continua bloqueado, como hoje.

## Detalhes técnicos

- Migração de dados: `INSERT` em `report_company_approvers` (status `pending`) para `contact_id = dbd4c0ec-f068-4f1f-b9ff-cf037e3c3463` em todos os `reports` de projetos com `site_id = c61489aa-35e0-4aad-bfc2-ebaa235c5273`, status em (`sent`,`completed`,`signed`,`finalized`), sem linha existente para ele.
- `supabase/functions/_shared/signature-auth.ts`: no ramo `contact`, quando não houver linha em `report_company_approvers`, validar `company_contacts.company_id` contra `projects.company_id` do RDO (e `contact_sites`, quando o contato tiver unidades definidas). Havendo correspondência, criar a linha de aprovador e seguir; caso contrário, manter o erro 403.
- `finalizeApproval` continua igual — passa a receber `approverId` também nesse caminho.
- Verificar depois: João abre um RDO antigo da pasta e assina; status vai para "assinado" quando WEES + cliente estiverem assinados.
