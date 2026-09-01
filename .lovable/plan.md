# Eliminar duplicidade na conexão do WhatsApp

## Problema
A aba WhatsApp em Configurações mostra a mesma informação/ação duas vezes:

- **Card 1 — "Conexão do WhatsApp (UAZAPI)"** (`WhatsAppConnectionSettingsCard.tsx`): Server URL, Token, badge de status (conectada/desconectada) com auto-refresh de 20s e botão "Conectar WhatsApp" (que na verdade clica no botão escondido do Card 2 via `getElementById`).
- **Card 2 — "WhatsApp → RDO"** (dentro de `WhatsAppSettingsTab.tsx`): botões "Testar Conexão", "Conectar WhatsApp" (o real, `id="whatsapp-connect-button"`), "Trocar número / Reconectar", badges de status (✅/❌/⚠️) e alerta de diagnóstico de credenciais.

Resultado: dois botões "Conectar WhatsApp", dois badges de status (que podem divergir, como no erro reportado antes), dois intervalos de 20s chamando `uazapi-status`, e um hack de clique por DOM id entre componentes.

## Solução: fonte única de conexão

### 1. `WhatsAppConnectionSettingsCard.tsx` vira o único dono da conexão
- Adicionar nele os botões reais de ação: **Conectar WhatsApp (QR)** e **Trocar número / Reconectar**.
- Mover para ele o estado/fluxo de QR Code (dialog, polling, configurar webhook) e o alerta de diagnóstico de credenciais inválidas, hoje em `WhatsAppSettingsTab`.
- Remover o hack `document.getElementById('whatsapp-connect-button')?.click()`.
- Manter um único badge de status (conectada — instância/telefone) com refresh de 20s.

### 2. `WhatsAppSettingsTab.tsx` — remover duplicados do card "WhatsApp → RDO"
- Remover: botão "Testar Conexão", botão "Conectar WhatsApp", botão "Trocar número / Reconectar", badges de status e o `Alert` de credenciais inválidas.
- Remover estados/funções movidos (`testConnection`, `connectionStatus`, `credentialsDiagnostic`, QR flow, reconnect flow) e o intervalo duplicado de 20s.
- O card "WhatsApp → RDO" passa a mostrar apenas informação estática da integração (URL do webhook para referência), sem status nem ações de conexão.
- Manter intactos: chave mestra de automação, mapeamento Grupo → Unidade, grupos órfãos e logs.

### Resultado
Uma única seção de conexão (status, QR, reconectar, credenciais) e uma única chamada de status a cada 20s — sem badges divergentes nem botões duplicados.

## Detalhes técnicos
- Arquivos: `src/components/settings/WhatsAppConnectionSettingsCard.tsx`, `src/components/settings/WhatsAppSettingsTab.tsx`.
- Nenhuma mudança de backend/edge function — apenas reorganização de UI.
- Preservar o comportamento atual: salvar config aplica webhook automaticamente; QR com polling de 15s e refresh após 3 tentativas; reconectar desconecta a sessão e abre QR do novo número.
