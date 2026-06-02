## Plano

1. **Confirmar o fluxo correto do `/super-admin`**
   - A tela está redirecionando para o login porque a sessão atual não está como `super_admin`.
   - O formulário correto de criação/edição de fábrica é chamado em `src/pages/SuperAdminPanel.tsx` e usa `CompanyFormDialog`.

2. **Corrigir o campo no lugar certo**
   - Ajustar `src/components/companies/CompanyFormDialog.tsx`, que é o diálogo usado pelos botões de editar/criar fábrica no `/super-admin`.
   - Trocar o uso atual de `ImageUploader` com `label=""` para `label="Foto da Fábrica"` e remover o `Label` externo duplicado, garantindo que o próprio uploader renderize a área “Selecionar arquivo”.
   - Se necessário, adicionar uma `className`/largura explícita para o upload ocupar a área do formulário e não ficar escondido.

3. **Validar visualmente**
   - Após implementar, abrir `/super-admin` com sessão autorizada quando disponível.
   - Confirmar que o diálogo “Nova Fábrica” e “Editar Fábrica” mostram a área de upload com o botão “Selecionar arquivo”.

## Detalhes técnicos

O componente certo já está conectado aqui:

```text
/super-admin
└─ SuperAdminPanel.tsx
   └─ CompanyFormDialog.tsx
      └─ ImageUploader.tsx
```

A correção anterior no `ImageUploader` ajuda, mas o ponto mais seguro é deixar o `CompanyFormDialog` passar um label real para o uploader, porque é esse componente que aparece na criação/edição da fábrica.