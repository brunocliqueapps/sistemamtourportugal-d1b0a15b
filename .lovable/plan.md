# Corrigir erro "voucher_day_notes não encontrada"

## O que verifiquei agora

- As colunas **existem** na base de dados: `voucher_day_notes` (jsonb), `voucher_final_note` (texto) e `voucher_validated_at` na tabela `proposals`.
- Os tipos usados pela aplicação também já reconhecem estes campos.

Conclusão: não é preciso mexer na estrutura do banco. O erro vem da **cache de esquema da API** do backend, que ainda não recarregou depois de as colunas terem sido criadas. Enquanto essa cache está desatualizada, qualquer gravação do voucher falha com a mensagem que apareceu.

## O que vou fazer

1. Enviar um pedido de **recarregamento da cache de esquema** da API (não altera tabelas, colunas nem dados) e confirmar as permissões de leitura/escrita nas colunas do voucher.
2. Testar uma gravação real de "Guardar e Validar Voucher" e confirmar que as orientações por dia e a Nota Final ficam guardadas.
3. Tornar o botão de guardar mais claro em caso de falha: em vez de mostrar a mensagem técnica, indicar que deve recarregar a página, mantendo o texto já escrito no ecrã para não se perder nada.

Nada é apagado e o banco continua exatamente onde está.

## Detalhes técnicos

- Migração apenas com `NOTIFY pgrst, 'reload schema';` e `GRANT` idempotente em `public.proposals` (sem `ALTER TABLE`).
- Em `src/routes/voucher.tsx`: tratar o erro do `update` com mensagem amigável e manter `localNotes` / `localFinalNote` no estado após falha.
