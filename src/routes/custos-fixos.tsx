import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { EntityCrud, type CrudField } from "@/components/EntityCrud";

export const Route = createFileRoute("/custos-fixos")({ component: CustosFixos });

const fields: CrudField[] = [
  { key: "name", label: "Designação", required: true },
  { key: "category", label: "Categoria", type: "select", options: [
    { value: "renda", label: "Renda / Espaço" }, { value: "seguros", label: "Seguros" },
    { value: "software", label: "Software / Licenças" }, { value: "aluguer_viatura", label: "Aluguer de viatura" },
    { value: "contabilidade", label: "Contabilidade" }, { value: "salarios", label: "Salários" },
    { value: "comunicacoes", label: "Comunicações" }, { value: "impostos", label: "Impostos e taxas" },
    { value: "outros", label: "Outros" },
  ]},
  { key: "amount", label: "Valor (€)", type: "number", step: "0.01", required: true },
  { key: "recurrence", label: "Periodicidade", type: "select", options: [
    { value: "semanal", label: "Semanal" }, { value: "quinzenal", label: "Quinzenal" },
    { value: "mensal", label: "Mensal" }, { value: "anual", label: "Anual" },
  ]},
  { key: "due_day", label: "Dia de vencimento", type: "number" },
  { key: "start_date", label: "Início", type: "date" },
  { key: "end_date", label: "Fim (opcional)", type: "date" },
  { key: "has_invoice", label: "Tem fatura", type: "checkbox" },
  { key: "invoice_number", label: "Nº da fatura" },
  { key: "no_invoice_reason", label: "Se sem fatura, motivo" },
  { key: "notes", label: "Notas", type: "textarea" },
  { key: "active", label: "Ativo", type: "checkbox" },
];

function CustosFixos() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Custos Fixos" description="Despesas recorrentes da empresa lançadas na conta corrente." />
      <EntityCrud
        table="fixed_costs"
        title="Custos fixos"
        fields={fields}
        columns={["name", "category", "amount", "recurrence", "due_day", "active"]}
      />
    </div>
  );
}
