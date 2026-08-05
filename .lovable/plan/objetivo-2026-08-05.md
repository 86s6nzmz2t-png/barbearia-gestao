## Objetivo

Fazer o painel **Gerenciamento de Acessos** aparecer de forma confiável na aba Configurações para administradores aprovados.

## Estado confirmado

- A seção já é renderizada por `Configurações`, mas está posicionada somente depois de Taxas, Barbeiros e Despesas.
- O próprio componente se oculta quando `useIsAdmin()` retorna falso.
- A conta `loshermanosbarbearia.mva@gmail.com` está registrada no banco como `admin` e `aprovado`.

## Implementação

1. Reorganizar Configurações para colocar **Gerenciamento de Acessos** no início do conteúdo quando o usuário for administrador, evitando que fique escondido no final de uma página longa, especialmente no celular.
2. Tornar explícitos os estados de carregamento e falha do perfil administrativo, em vez de o painel desaparecer silenciosamente enquanto o perfil ainda não foi carregado.
3. Ajustar a sincronização do perfil autenticado para que a interface reconheça imediatamente `role = admin` e `status = aprovado` após login, atualização de sessão ou retorno à página.
4. Manter a seção completamente oculta para barbeiros e demais usuários sem permissão; as operações administrativas continuarão protegidas também no banco e nas funções do servidor.
5. Validar com uma sessão de administrador nas versões mobile e desktop, confirmando a presença da seção, a listagem de usuários e os controles de aprovar, suspender e excluir.

## Arquivos principais

- `src/routes/configuracoes.tsx`
- `src/components/user-access-section.tsx`
- `src/lib/auth.tsx`
