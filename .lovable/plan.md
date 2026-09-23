# Garantir que as fotos dos RDOs não sumam mais

O salvamento já foi corrigido: as fotos agora são gravadas uma única vez, a remoção pede confirmação e o sistema só avisa "salvo" depois de conferir no banco que todas as imagens ficaram vinculadas.

Faltam três pontos de risco para fechar de vez.

## 1. Entrada automática pelo WhatsApp

A rotina que recebe os RDOs pelo WhatsApp hoje apaga as informações do RDO (atividades, desvios, presença) antes de regravar. Se a mensagem chegar incompleta, o RDO fica vazio. Ajuste: só substituir esses dados quando a mensagem realmente trouxer conteúdo; caso contrário, manter o que já existe. As fotos que chegam depois do RDO continuam sendo anexadas, com nova tentativa quando o RDO ainda não existir.

## 2. Rede de segurança no banco

Criar um registro histórico de toda foto desvinculada de um RDO (quem, quando, qual imagem). Assim, se algo sumir, dá para devolver em minutos em vez de garimpar o armazenamento.

## 3. Conferência periódica

Uma verificação que aponta RDOs recentes sem nenhuma foto e imagens no armazenamento sem RDO, para agir antes de alguém reclamar.

## Recuperação do que ainda falta

Aplicar aos demais RDOs sem fotos a mesma recuperação já feita nos 14 RDOs do Ricardo, quando a correspondência por horário e obra for inequívoca. Fotos do sistema antigo cujo arquivo não existe mais continuam irrecuperáveis e seguem marcadas como indisponíveis.

## Testes antes de encerrar

- Abrir e salvar um RDO sem mexer nas fotos: nada é perdido.
- Adicionar várias fotos e salvar; reabrir e conferir.
- Remover uma foto: pede confirmação e só some após salvar.
- Conexão lenta e dois cliques seguidos em salvar.
- Baixar o PDF e conferir as imagens.

## Detalhes técnicos

- `supabase/functions/uazapi-webhook/index.ts`: tornar `upsertActivities`, `upsertDeviations` e `upsertAttendance` condicionais a payload não vazio; reforçar retry em `attachPendingPhotos`.
- Migration: tabela `report_photo_deletions` + trigger `AFTER DELETE` em `report_photos` (GRANT + RLS, leitura só para admin/super admin).
- Consulta de auditoria: RDOs dos últimos 30 dias com zero linhas em `report_photos` e objetos recentes do bucket `service-report-photos` sem registro correspondente.
