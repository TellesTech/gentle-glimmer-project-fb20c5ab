# Corrigir erro ao abrir o RDO

## O que está acontecendo

Ao abrir a página do RDO no portal do cliente, a tela quebra e mostra "Ocorreu um erro ao carregar esta tela".

O erro real no console é:

```text
cannot add `postgres_changes` callbacks for realtime:signature-timeline-<reportId> after `subscribe()`
```

Causa confirmada: o hook `useReportSignaturesRealtime` é usado em dois lugares ao mesmo tempo na mesma página — em `src/pages/ClientReportView.tsx` (linha 231, adicionado na mudança recente do aviso de "Relatório Assinado") e em `src/components/client/SignatureTimeline.tsx` (linha 79). Os dois criam um canal Realtime com o mesmo nome (`signature-timeline-<reportId>`). O Supabase reaproveita o canal já existente, e a segunda montagem tenta registrar listeners em um canal que já fez `subscribe()`, o que lança a exceção e derruba a tela.

Efeito colateral do mesmo problema: quando um dos componentes desmonta, ele remove o canal compartilhado e o outro para de receber atualizações em tempo real.

## Correção

Em `src/hooks/useReportSignaturesRealtime.ts`:

- Gerar um sufixo único por instância do hook (por exemplo um id estável criado com `useRef`/`crypto.randomUUID()`) e usá-lo no nome do canal: `signature-timeline-${reportId}-${instanceId}`.
- Assim cada componente tem seu próprio canal, os listeners são registrados antes do `subscribe()`, e o cleanup de um não afeta o outro.
- Manter o restante da lógica (invalidação das queries) inalterada.

## Validação

- Abrir a rota do RDO no portal do cliente e confirmar que a página carrega sem o erro.
- Verificar no console que não há mais o erro de `postgres_changes`.
- Confirmar que a linha do tempo de assinaturas e o banner de status continuam atualizando ao assinar.
