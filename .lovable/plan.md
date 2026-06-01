## Objetivo

Cadastrar os colaboradores da aba **"11.05.2026 a 15.05.2026"** da planilha enviada como usuários **Operacional** (role `collaborator`), preenchendo:

- **Nome** → `profiles.name`
- **Função** → `profiles.job_title`
- **Fábrica** → `profiles.state` (mesmo campo já usado como "filial")

A tabela hoje só tem 2 perfis (Dayvison e Eliel), então não há risco real de duplicidade com o que já existe.

## Como a aba será lida

A aba tem 87 linhas e várias colunas (`NOME`, `FUNÇÃO`, `LOCAL`, `11/mai`…`15/mai`). A "fábrica" será extraída pegando o **primeiro valor concreto** entre os dias 11–15/mai, ignorando `FOLGA`, `Intermitente` e células vazias. Quando não houver nenhuma alocação concreta, a fábrica fica como `Intermitente`.

## Limpeza aplicada

1. **Nome** normalizado para Title Case (`ABEL PEÇANHA` → `Abel Peçanha`); partículas (`da, de, do, dos, das`) em minúsculo.
2. **Função** padronizada (corrige `Soldador escalador` → `Soldador Escalador`, `Cadeireiro` → `Caldeireiro`, `Mcânico` → `Mecânico`, etc.).
3. **Fábrica** normalizada para um conjunto curto: `SUZANO`, `BRACELL`, `REFRAMAX`, `POLO`, `CSN SERRA`, `ARCELOR PECEM`, `NEXA`, `INTERMITENTE`.
4. **Duplicatas internas da aba** removidas (ex.: `Marcelino Da Silva (Int)` aparece 2x; `Wesley Borges` / `Wesley borges`; `Vanderlei` / `Vanderley` Calavort).
5. **Nomes incompletos** (só primeiro nome — `Daniel`, `Lucas`, `Wagner`, `Werles`, `Kalef Insp`, `Thiago Insp`, `Deisy`, etc.) — **preciso de uma definição sua** (ver "Pontos a confirmar").

## Lista prevista (após limpeza)

São ~80 colaboradores únicos. Os principais grupos:

- **BRACELL**: Ademar dos Reis Neto, Allef Gomes Honorato, Bruno de Oliveira Almeida, Henrique Pereira Firmino Tavares, Jucimar Penha Gomes, Keubim Vancini Eduardo, Luiz Felipe de Jesus Lacerda, Maxsuel da Vitoria Rodrigues, Ronieri Guimarães Nascimento, Vanderson Rocha, Wesley Renam Borges dos Santos
- **REFRAMAX/Rechapeamento**: Agustin Nicolas Maldonado, Cesar Vieira, Christiano Serra da Silva, Diego Rissari, Jaqueline Alves da Silva, Jhonatan de Cruz Pereira, Marcio Afonso Simoes Mai, Murilo Andrade Forest, Thubias Domiciano Sobrinho, Willian Sulatti Gomes
- **SUZANO**: Chainer Bueno Freitas, Claudionor Azeredo Dinis, João Batista da Silva Amaral, Leandro dos Santos de Andrade, Marcos Antônio Lemos da Silva, Valeria Totola da Silva
- **POLO**: Adilson Batista de Oliveira, Davi Monfardini de Oliveira, Patrick Bento, Ricardo Gonçalves Vieira, Rodrigo da Vitória
- **CSN SERRA**: Elvis Silva Aurelio, Kennedy Souza de Oliveira, Luciano Cerqueira Azevedo Junior
- **ARCELOR PECEM**: Deivid Braga Florencio, Edmilton Pereira
- **NEXA**: Hercoles Aprigio Cirilo Junior, Renato da Silva Santos
- **INTERMITENTE** (sem alocação semanal): ~40 nomes (Abel Peçanha, Adailson Lima, Alessandro Rosário, Anderson Andrade, Carlos Jhonata, Denis Candeia Wagner, Diego Costa, Douglas Felipe, Douglas Selestrino Saraiva, Edcharles, Elton Romão, Evandro Elias, Felipe Roberto, Fernando Augusto, Gabriel Pacheco, Genesis Andrade, Hercules Vasconcelos, Israel Cuzuol, Italo Dally, Jessé Esteves, José Carlos, Luiz Carlos, Manoel Martins de Souza Neto, Marcelino da Silva, Marcelo Almeida da Silva, Marcos Vinicius, Ricardo Muniz, Robson Sudre de Amorim, Vanderlei Calavort Nascimento, Vanderson, Vitor Adalberto Cibien Maia, Vladimir Moraes, Wagner Santos dos Santos, Wellington Paulo do Rosario, Wesley Borges, Wagner Dos Santos)

## Como será cadastrado

Para cada nome único, chamar `supabase.functions.invoke('admin-users', { action: 'create-collaborator', name, job_title, state })`. A função já cria o usuário em `auth.users` com email interno (`collaborator-<id>@internal.local`), perfil em `profiles` e papel `collaborator`. Nenhuma mudança de schema é necessária.

Ao final, mostro relatório: criados / ignorados / erros.

## Pontos a confirmar

1. **Nomes incompletos** (`Daniel`, `Lucas`, `Wagner`, `Werles`, `Kalef Insp`, `Thiago Insp`, `Deisy`, `José Carlos`, `Vanderson`) — cadastrar mesmo assim, ou pular?
2. **Intermitentes sem fábrica** — cadastrar com `state = "Intermitente"`, ou pular esses ~40 e cadastrar só os ~40 com fábrica definida na semana?
3. **Fábrica em `profiles.state`** — confirma usar esse campo? (alternativa: criar coluna nova `factory`, exige migração.)
