# Reformulação Completa — Sistema Mtour Portugal

Vou reestruturar o CRM para cobrir toda a operação: comercial, operacional (privado + TVDE), financeiro com controlo fiscal português (IVA/IRC), cadastros completos, agenda, relatórios e fechamento mensal bloqueável.

## 1. Base de dados (novo `supabase-schema.sql` v2)

**Novas tabelas / enums:**
- **Cadastros:** `clients`, `drivers`, `employees`, `suppliers`, `partners`, `hotels`, `restaurants`, `agencies`, `products_services`, `cost_centers`, `bank_accounts`, `payment_methods`
- **Fiscal:** `vat_rates` (configurável, sem taxa fixa), `invoices` (com IVA dedutível/não dedutível, série, NIF, estado), `vat_period_closings`, `irc_estimates`
- **Operação privado:** `service_orders` (OC — nº sequencial único), `vouchers`, `service_expenses` (estacionamento, portagens, abastecimento, outras)
- **TVDE:** `tvde_shifts` (Uber/Bolt/outras), `tvde_earnings`, `tvde_private_jobs`, `tvde_expenses`
- **Sistema:** `audit_log` (quem/quando/o quê), `monthly_closings` (bloqueio de período), `document_alerts` (vencimentos), `user_permissions` (roles: admin, financeiro, comercial, operacional, motorista)
- **Enums:** `service_status` (agendado→confirmado→motorista designado→em deslocação→cliente a bordo→em execução→finalizado→cancelado→não realizado), `invoice_status`, `operation_type` (privado/TVDE/interno/outro), `payment_status`

**Sequências automáticas:** leads, propostas, vouchers, OC, faturas, serviços — cada uma com prefixo e nº sequencial.

**Triggers:**
- Proposta aprovada → gera OC + Voucher + Serviço + entrada em agenda + conta a receber
- Fechamento de serviço → cria transações financeiras automaticamente (sem duplicar)
- Alterações em tabelas financeiras → grava em `audit_log`
- Fechamento mensal bloqueia edição (exceto admin com registo em log)

**RLS por role:** admin (tudo), financeiro (financeiro + relatórios), comercial (CRM/propostas), operacional (agenda/serviços), motorista (só o próprio dia/serviços atribuídos).

## 2. Módulos Frontend

### Dashboard
KPIs do dia: agenda, serviços em andamento, leads, faturamento, receitas, despesas, saldo bancário, alertas de documentos e vencimentos (CC motorista, seguros, inspeção, IUC).

### Cadastros (11 sub-páginas)
Clientes, Motoristas, Veículos, Funcionários, Fornecedores, Parceiros, Hotéis, Restaurantes, Agências, Produtos/Serviços, Centros de Custo.

### CRM Comercial
Kanban Novo → Em negociação → Fechado → Perdido, origem do lead, motivo da perda.

### Propostas
Criação → aprovação → conversão automática em OC/Voucher/Serviço/Agenda/Conta a receber.

### Operação
- **Agenda diária/semanal/mensal** com todos os campos (horário, OC, voucher, cliente+telefone, origem/destino, motorista, veículo/matrícula, pax, valor, estado pagamento e operacional).
- **Início de turno:** escolher tipo de operação (privado / TVDE / interno / outro).
- **Fechamento privado:** hora, km, valor, recebimento, despesas (com "outras" obrigando descrição/valor/forma/pagador/veículo/centro custo).
- **Fechamento TVDE:** ganhos por plataforma (Uber/Bolt/outras) + gorjetas + bónus − comissões − despesas; serviços particulares dentro do turno; acerto motorista/empresa.

### Financeiro
- **Entradas:** cliente, origem, valor, forma pagamento, data, fatura, voucher relacionado.
- **Saídas:** fornecedor, categoria, valor, IVA (taxa configurável), forma, conta, estado, data efetiva.
- **Fatura completa:** todos os campos fiscais PT (tipo doc, série, nº, datas, NIF, IVA dedutível/não dedutível, % dedução).

### Centro de Custos + Relatórios
Relatórios (Leads, conversão, faturamento, receitas, despesas, fluxo caixa, motoristas, veículos, parceiros, clientes, origem vendas) com filtros dia/semana/mês/ano/motorista/veículo/cliente/tipo operação, e separação privado / Uber / Bolt / outros.

### Fechamento Mensal
Gera:
- **Financeiro:** receitas, despesas, lucro bruto/operacional/líquido estimado, contas a receber/pagar, saldos bancários, fluxo caixa.
- **IVA:** liquidado, suportado, dedutível, não dedutível, regularizações, crédito anterior → IVA a pagar ou crédito a transportar.
- **IRC (estimativa gerencial):** faturamento, custos, resultado operacional, despesas não aceites, matéria coletável estimada, IRC estimado, pagamentos por conta, retenções — sempre rotulado como "provisão sujeita a validação do contabilista".
- Botão **Fechar e bloquear período**.

### Pós-venda / Conta Corrente
Pesquisa satisfação, avaliação Google, indicações, histórico; extrato bancário e conferência de pagamentos.

### Global
- **Pesquisa global** (Cmd+K): clientes, vouchers, OC, motoristas, veículos, serviços.
- **Log de alterações** visível ao admin.
- **Permissões por role** aplicadas em UI + RLS.

## 3. Entregas técnicas

- `supabase-schema.sql` v2 completo (drop + recreate seguro, com seeds de taxas IVA PT: 6/13/23%, isento, formas pagamento, centros custo base).
- ~25 novas rotas TanStack sob `src/routes/` (cadastros.*, agenda.tsx, oc.$id.tsx, tvde.tsx, fiscal.iva.tsx, fiscal.irc.tsx, fechamento.tsx, relatorios.*, conta-corrente.tsx, config.permissoes.tsx).
- Sidebar reorganizado por área com controlo de visibilidade por role.
- Componentes reutilizáveis: `InvoiceForm`, `VatBreakdown`, `ServiceOrderCard`, `AgendaGrid`, `GlobalSearch`, `AuditTrail`.
- Preserva tema azul/dourado e logo atuais.

## 4. Ordem de execução

1. Schema SQL v2 (envio para colar no Supabase).
2. Cadastros + permissões + audit log + sequências.
3. CRM → Propostas → conversão automática em OC/Voucher/Agenda.
4. Operação privado + TVDE com fechamentos e integração financeira.
5. Financeiro com IVA por lançamento + faturas completas.
6. Relatórios + Fechamento mensal (IVA/IRC) + bloqueio de período.
7. Dashboard novo + pesquisa global + alertas.

## Observação fiscal
Os cálculos de IVA e IRC são **ferramentas de controlo e pré-apuramento**. A declaração periódica de IVA e o Modelo 22 do IRC são obrigações fiscais próprias — a validação final é sempre do contabilista certificado. O sistema marca todos os valores como "estimativa/provisão".

---

Dado o volume (schema fiscal PT + ~25 rotas + triggers de automação), a implementação será feita em fases sequenciais. Confirma para começar pela **Fase 1 (schema SQL v2)** — envio o ficheiro completo pronto a colar no Supabase antes de tocar no frontend.