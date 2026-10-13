# Faixa de "WhatsApp desconectado" some sozinha ao reconectar

## Situação atual (confirmada)
- O WhatsApp já reconectou: o sistema marcou "conectado" às 13:43 de hoje e o aviso no sino/e-mail de "WhatsApp reconectado" já é enviado.
- A faixa vermelha no topo **já some sozinha**, mas só na próxima verificação da tela, que acontece a cada 60 segundos. Por isso parece que ela "não sai".

## O que será feito

1. **Faixa some na hora ao reconectar**
   - A faixa passa a "escutar" a mudança de status em tempo real (assinatura realtime na tabela `whatsapp_integration_settings`): no instante em que o sistema marca "conectado", a faixa desaparece, sem esperar e sem recarregar a página.
   - Como segurança, a verificação periódica continua, mas passa de 60s para 15s enquanto a faixa estiver visível.

2. **Aviso de reconexão**
   - Já existe e continua: quando o WhatsApp volta, os super admins recebem "WhatsApp reconectado" no sino e por e-mail.

## Detalhes técnicos
- `src/components/layout/WhatsAppStatusBanner.tsx`: adicionar `supabase.channel(...).on('postgres_changes', { table: 'whatsapp_integration_settings' })` que invalida a query `whatsapp-connection-status`; `refetchInterval` dinâmico (15s quando desconectado, 60s quando conectado).
- Nenhuma mudança no banco nem nas edge functions: `uazapi-health-check` (a cada 5 min) e o webhook já gravam o status corretamente.
