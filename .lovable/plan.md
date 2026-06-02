Plano para corrigir a identificação dos colaboradores pela IA:

1. Corrigir o envio da lista de colaboradores cadastrados
- No formulário de RDO, passar `allProfiles` para o modal “Colar Relatório do WhatsApp”.
- Hoje o modal recebe apenas `teamMembers`, então a IA e o comparador local não usam a base completa de colaboradores cadastrados.

2. Melhorar o pareamento de nomes no frontend
- Ajustar o `matchCollaborator` para normalizar acentos, caixa, espaços e pontuação.
- Permitir identificação por qualquer token relevante do nome, não só pelo primeiro nome.
- Resolver casos como:
  - “Lafftow” → “Lafftow Marques de Oliveira”
  - “Antonio Mardem” → “Antonio Marden da Silva”
  - “Wellington” → “Jose Wellington Araujo de Souza”
  - “Joaquim” → “Joaquim de Araújo Feitosa Neto”
- Evitar correspondência insegura quando houver vários candidatos com pontuação parecida.

3. Preservar os dados extraídos pela IA
- Usar o campo `presente` retornado pela IA em vez de marcar todos como presentes automaticamente.
- Manter cargo/função do cadastro quando o texto não trouxer função explícita.

4. Reforçar o prompt da Edge Function
- Enviar colaboradores cadastrados como referência para a IA e instruí-la a retornar o nome completo quando encontrar equivalência.
- Manter fallback seguro quando a IA retornar só primeiro nome.

5. Validar com o caso da imagem
- Testar o fluxo com os nomes do print/log recente.
- Confirmar que o resultado mostra colaboradores identificados e salva `user_id` corretamente no efetivo.