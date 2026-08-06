# Criar a conta de administrador

## Situação atual

Verifiquei a base de dados: **não existe nenhum utilizador registado**. As credenciais combinadas (`sistemamtour@gmail.com` / `Admin123!`) nunca chegaram a ser criadas, por isso o login falha.

## O que vou fazer

1. Criar o utilizador `sistemamtour@gmail.com` com a senha `Admin123!`, já com o email confirmado (login imediato, sem precisar clicar em link).
2. Atribuir-lhe o papel de **administrador** na tabela de papéis, para ter acesso completo a todos os módulos.
3. Garantir que a operação é repetível: se o utilizador já existir, apenas a senha é reposta e o papel garantido — não cria duplicados.
4. Confirmar depois, com uma consulta, que o utilizador e o papel de admin existem.

## Credenciais finais

- Email: `sistemamtour@gmail.com`
- Senha: `Admin123!`

Recomendo trocar a senha depois do primeiro acesso.

## Detalhes técnicos

- Migration SQL que usa `pgcrypto` (`crypt(..., gen_salt('bf'))`) para inserir em `auth.users` com `email_confirmed_at = now()` e a identidade correspondente em `auth.identities`.
- Insere `('admin')` em `public.user_roles` para o `user_id` criado, com `on conflict do nothing`.
- Sem alterações no frontend.
