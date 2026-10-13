# Corrigir erro que impede acessar o sistema

## Causa
A faixa de aviso do WhatsApp foi colocada no layout principal, mas a linha que a importa foi esquecida. Por isso todas as páginas internas quebram ao abrir.

## Correção
- Adicionar em `src/components/layout/MainLayout.tsx` a importação `import { WhatsAppStatusBanner } from './WhatsAppStatusBanner';`.
- Conferir o registro de erros depois da mudança e abrir o sistema para confirmar que carrega.
- Republicar para o site oficial também voltar a funcionar.
