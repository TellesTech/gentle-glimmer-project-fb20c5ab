# Corrigir os RDOs da Laura

## Diagnóstico confirmado
- A conta da Laura está ativa, com perfil **Super Admin**, e entrou normalmente hoje.
- Ela possui 10 RDOs salvos: 6 na CSN Montes Claros e 4 na Aperam Timóteo.
- O cadastro dela restringe a navegação administrativa à fábrica **Suzano Aracruz**.
- A tela já consulta separadamente os RDOs criados pela própria Laura, mas, ao montar as pastas, carrega apenas empresas, fábricas e atividades da restrição administrativa. Por isso os RDOs próprios da CSN e Aperam são descartados antes de aparecerem.

## Implementação
1. Manter a restrição atual da Laura para os RDOs de outras pessoas.
2. Incluir as empresas, fábricas e atividades relacionadas aos RDOs criados pela própria Laura ao montar as pastas.
3. Garantir que a união não duplique empresas, fábricas, atividades ou RDOs já presentes no acesso normal.
4. Ajustar o carregamento para aguardar tanto o acesso administrativo quanto os RDOs próprios, evitando uma pasta vazia momentânea.
5. Validar especificamente o caminho **CSN → CSN Montes Claros → 2026 → Setembro → Atendimento à Parada**, confirmando os RDOs 1, 2, 4, 5, 6 e 8.

## Resultado esperado
A Laura verá todos os RDOs que criou, mesmo quando pertencem a uma fábrica fora da seleção administrativa dela, sem ganhar acesso aos RDOs de terceiros dessas fábricas.

## Detalhes técnicos
- A correção ficará na composição de dados do armário de RDOs.
- Não será necessário alterar nem excluir dados do banco.
- Após a validação, publicar a versão corrigida em `rdo.wees.com.br`.
