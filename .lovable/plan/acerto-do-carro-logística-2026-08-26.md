# Acerto do Carro (Logística)

Nova página de acerto financeiro semanal por viatura, substituindo o item "TVDE (Uber/Bolt)" no menu Logística (a página TVDE fica oculta, mas continua a existir e a funcionar por URL direto). "Comissões Semanais" no Financeiro mantém-se como está.

## Como vai funcionar

- **Filtro de semana (segunda a domingo)**: seletor de semana com navegação anterior/seguinte, mais campo de pesquisa (matrícula, motorista, marca/modelo).
- **Lista de viaturas** da semana, cada uma com: identificação do carro (matrícula, marca/modelo) e etiqueta **Próprio da Empresa** ou **Aluguer** (com o valor semanal de aluguer).
- **Entradas (ganhos)** somadas automaticamente por viatura na semana:
  - TVDE (ganhos dos turnos da viatura),
  - Roteiros Personalizados Mtour e Serviços Privados (ordens de serviço da viatura),
  - lançamentos manuais adicionados pelo admin na semana (ex.: valor entregue em mão).
- **Saídas (custos)**: todas as despesas registadas para a viatura na semana (qualquer categoria) + lançamentos manuais de custo.
- **Cálculo**: `Lucro líquido = Entradas − Saídas`; se a viatura for de aluguer, subtrai-se o valor do aluguer da semana no final.
- **Percentagem opcional**: o admin pode definir uma % de comissão do motorista. Se preenchida, calcula "a pagar ao motorista" e o **restante fica como crédito ao locatário/empresa**. Se ficar vazia, o valor total líquido aparece sem divisão.
- **Fechamento**: só o **Admin** pode fechar a semana de uma viatura. Ao fechar, grava-se um registo de acerto com todos os valores, um campo de **detalhes/observações**, data e autor. Semanas fechadas ficam bloqueadas (o admin pode reabrir).
- **Histórico de pagamentos**: separador com todos os acertos fechados por viatura/motorista, com detalhes e valores. O **motorista** vê apenas os seus acertos — incluindo a semana em curso com valores provisórios — sem poder fechar nem editar.
- **Resumo em PDF**: botão que gera o resumo da semana (viatura, motorista, entradas detalhadas, saídas detalhadas, aluguer, líquido, %, a pagar, crédito, detalhes), com o branding Mtour já usado nos outros documentos. Disponível na semana em curso e em qualquer semana fechada.

## Detalhes técnicos

**Base de dados (migração)**
- Nova tabela `car_settlements`: `vehicle_id`, `driver_id`, `week_start`, `week_end`, `income_tvde`, `income_services`, `income_manual`, `expenses_total`, `rental_cost`, `net_profit`, `driver_pct` (nullable), `driver_amount`, `company_amount`, `details` (texto), `closed_at`, `closed_by`, timestamps + trigger `tg_set_updated_at`. Único por (`vehicle_id`, `week_start`).
- Nova tabela `car_settlement_entries` para lançamentos manuais: `vehicle_id`, `week_start`, `kind` (`entrada`/`saida`), `amount`, `description`, `created_by`, `created_at`.
- GRANTs para `authenticated`/`service_role`, RLS ativa:
  - leitura: admin/financeiro (via `has_role`/`has_module`) vê tudo; motorista vê linhas onde `driver_id` corresponde ao seu registo em `drivers` (`user_id = auth.uid()`);
  - inserir/alterar/fechar: apenas `has_role(auth.uid(),'admin')`.

**Frontend**
- Nova rota `src/routes/acerto-carro.tsx`; entrada no menu Logística ("Acerto do Carro"), item `/tvde` removido do menu (rota mantida).
- `ROUTE_MODULES` em `src/lib/permissions.ts`: `/acerto-carro` → módulo `tvde` (reaproveita a permissão existente).
- Agregações client-side por viatura/semana a partir de `tvde_shifts` + `tvde_earnings`, `service_orders` (privados/roteiros), `service_expenses`, `car_settlement_entries` e `vehicles` (`usage_type`, `rental_weekly_cost`).
- PDF gerado com os helpers existentes em `src/lib/proposal-pdf.ts` (cabeçalho/rodapé Mtour) num novo `src/lib/settlement-pdf.ts`.
- Datas via `src/lib/format-date.ts` (dd-mm-aaaa).
