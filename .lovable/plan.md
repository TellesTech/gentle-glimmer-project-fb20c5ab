# Corrigir o status "desconectada" no card do WhatsApp

## O que foi verificado agora

Consultei a UAZAPI e a função `uazapi-status` neste momento:

- Instância **WEES Treinamentos Cursos** — `status: connected`, `loggedIn: true`, número `5527997041945`.
- A função `uazapi-status` responde `connected: true` e o webhook já está aplicado (`.../uazapi-webhook`, eventos messages/messages_update/connection).
- Houve uma desconexão às 17:17 UTC por "QR Code timeout" — foi justamente nesse intervalo que a tela mostrou "desconectada".

Ou seja: **a integração está conectada**. O problema é só de tela: o card consulta o status uma única vez ao carregar e nunca mais atualiza, então fica mostrando um estado antigo.

## O que será feito

1. **Atualização automática do status** no card "Conexão do WhatsApp (UAZAPI)": nova consulta a cada 20 segundos enquanto a tela estiver aberta (com limpeza ao sair).
2. **Botão de atualizar** (ícone de recarregar) ao lado do badge, para conferir na hora.
3. **Erro deixa de virar "desconectada"**: se a consulta falhar, o badge mostra "não foi possível verificar" em vez de afirmar que está desconectado.
4. **Mais contexto no badge de conectado**: mostrar o nome da instância e o número vinculado (ex.: "conectada — WEES Treinamentos Cursos (+55 27 99704-1945)"), usando dados que a função já retorna.
5. Alinhar o mesmo comportamento no badge da aba WhatsApp para os dois lugares nunca se contradizerem.

## Detalhes técnicos

- `src/components/settings/WhatsAppConnectionSettingsCard.tsx`: `refreshStatus` passa a rodar em `setInterval` (20s) dentro de `useEffect`; novos estados `unknown | connected | disconnected | error`; extrair `status.instance.name` e `status.status.jid` da resposta.
- `src/components/settings/WhatsAppSettingsTab.tsx`: reutilizar a mesma leitura de `connected` e o mesmo tratamento de erro no `connectionStatus`.
- Nenhuma mudança de backend, migration ou edge function — a função `uazapi-status` já retorna tudo o que é necessário.
