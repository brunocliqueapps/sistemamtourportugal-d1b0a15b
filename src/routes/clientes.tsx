import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { EntityCrud, type CrudField } from "@/components/EntityCrud";

export const Route = createFileRoute("/clientes")({ component: Clientes });

const clientes: CrudField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "nif", label: "NIF" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Telefone", type: "phone" },
  { key: "city", label: "Cidade" },
  { key: "country", label: "País" },
  { key: "address", label: "Morada" },
  { key: "notes", label: "Notas", type: "textarea" },
];

function Clientes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Clientes" description="Clientes registados manualmente ou convertidos de leads." />
      <EntityCrud
        table="clients"
        title="Clientes"
        fields={clientes}
        columns={["name", "nif", "email", "phone", "city"]}
      />
    </div>
  );
}
