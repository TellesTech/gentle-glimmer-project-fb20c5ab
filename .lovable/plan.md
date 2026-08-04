# Convite com e-mail e senha no card do membro

Hoje o botão "Gerar texto de convite" só aparece depois de configurar um PIN de 4 dígitos, e o texto gerado leva o cliente para a tela de login sem indicar por onde entrar. A senha é criada nos bastidores, mas o convite não dá um caminho claro de acesso por e-mail e senha.

## O que muda

**1. Convite sempre disponível no card**
- O botão "Gerar texto de convite" passa a funcionar mesmo sem PIN.
- Com PIN configurado, o convite inclui o PIN normalmente.
- Sem PIN, o convite é gerado apenas com e-mail e senha, sem o bloqueio "Configurar PIN". O campo de PIN continua disponível para quem quiser usá-lo.

**2. Dois links no texto do convite**
O texto copiado para o WhatsApp passa a trazer, quando aplicável:

```text
Acesso por e-mail e senha
E-mail: cliente@empresa.com
Senha: Cliente@1234
Link: https://rdo.wees.com.br/suzano/unidade?mode=email&email=cliente@empresa.com

Acesso rápido por PIN
PIN: 1234
Link: https://rdo.wees.com.br/suzano/unidade
```

Cada link abre a tela de login já no modo correto, com o e-mail preenchido.

**3. Diálogo de credenciais**
O diálogo exibido após gerar mostra e-mail, senha, PIN e os dois links, com botões de copiar individuais além do "copiar mensagem completa".

**4. Tela de login do cliente**
A página de login passa a ler parâmetros da URL: `?mode=email` abre direto o formulário de e-mail e senha (com o e-mail preenchido) e `?mode=pin` mantém o fluxo de PIN.

## Detalhes técnicos

- `src/components/settings/ClientContactsSection.tsx`
  - `handleGenerateInvite`: remover a obrigatoriedade de PIN; enviar `pin` só quando existir. Se a resposta não trouxer senha, chamar `set-client-password` para garantir uma senha válida no convite.
  - Renderização do card: unificar os três estados (sem PIN / PIN inline / com PIN) para sempre exibir o botão de convite; o input de PIN vira opcional.
  - `getWhatsAppMessage`: montar os dois blocos de acesso com os links específicos.
  - `GeneratedCredentials`: incluir `emailLoginUrl` e `pinLoginUrl`.
- `supabase/functions/send-client-invitation/index.ts`: aceitar `pin` opcional e retornar também a URL de login por e-mail.
- `src/pages/ClientLogin.tsx`: ler `mode` e `email` via `useSearchParams` no efeito inicial para definir o modo e pré-preencher o campo.

Sem mudanças de banco de dados.