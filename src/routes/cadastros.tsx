import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityCrud, type CrudField } from "@/components/EntityCrud";
import { VehicleDrivers } from "@/components/VehicleDrivers";
import { RegionsDialog } from "@/components/RegionsDialog";

export const Route = createFileRoute("/cadastros")({ component: Cadastros });

const motoristas: CrudField[] = [
  { key: "full_name", label: "Nome", required: true },
  { key: "phone", label: "Telefone" }, { key: "email", label: "Email", type: "email" },
  { key: "nif", label: "NIF" }, { key: "address", label: "Morada" },
  { key: "id_document_type", label: "Documento de identificação", type: "select", options: [
    { value: "cartao_cidadao", label: "Cartão de Cidadão" },
    { value: "titulo_residencia", label: "Título de Residência" },
    { value: "passaporte", label: "Passaporte" },
  ]},
  { key: "id_document_number", label: "Nº documento" },
  { key: "id_document_expiry", label: "Validade documento", type: "date" },
  { key: "criminal_record", label: "Registo criminal entregue", type: "checkbox" },
  { key: "criminal_record_expiry", label: "Validade registo criminal (opcional)", type: "date" },
  { key: "contract_type", label: "Vínculo", type: "select", options: [
    { value: "contratado", label: "Contratado" },
    { value: "funcionario_fixo", label: "Funcionário Fixo" },
  ]},
  { key: "commission_pct", label: "Recebe por percentagem (%)", type: "select", options: [
    { value: "20", label: "20%" }, { value: "30", label: "30%" }, { value: "40", label: "40%" }, { value: "50", label: "50%" },
  ]},
  { key: "license_number", label: "Nº Carta" }, { key: "license_expiry", label: "Validade Carta", type: "date" },
  { key: "tvde_card_number", label: "Nº Cartão TVDE" }, { key: "tvde_card_expiry", label: "Validade TVDE", type: "date" },
  { key: "hire_date", label: "Data admissão", type: "date" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const veiculos: CrudField[] = [
  { key: "plate", label: "Matrícula", required: true },
  { key: "brand", label: "Marca" }, { key: "model", label: "Modelo" }, { key: "year", label: "Ano", type: "number" },
  { key: "color", label: "Cor" }, { key: "seats", label: "Lugares", type: "number" }, { key: "fuel_type", label: "Combustível" },
  { key: "usage_type", label: "Utilização", type: "select", options: [
    { value: "proprio", label: "Uso próprio" }, { value: "aluguel", label: "Aluguel" },
  ]},
  { key: "owner_company", label: "Empresa proprietária (parceiro)" },
  { key: "rental_weekly_cost", label: "Custo semanal aluguer (€)", type: "number", step: "0.01" },
  { key: "operates_tvde", label: "Opera TVDE", type: "checkbox" },
  { key: "insurance_expiry", label: "Seguro (valid.)", type: "date" },
  { key: "inspection_expiry", label: "Inspeção (valid.)", type: "date" },
  { key: "iuc_expiry", label: "IUC (valid.)", type: "date" },
  { key: "tvde_license_expiry", label: "Lic. TVDE (valid.)", type: "date" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const funcionarios: CrudField[] = [
  { key: "full_name", label: "Nome", required: true }, { key: "role", label: "Função" },
  { key: "email", label: "Email", type: "email" }, { key: "phone", label: "Telefone" },
  { key: "nif", label: "NIF" }, { key: "address", label: "Morada" },
  { key: "citizen_card_number", label: "Cartão de cidadão" }, { key: "citizen_card_expiry", label: "Validade CC", type: "date" },
  { key: "residence_permit_number", label: "Título de residência" }, { key: "residence_permit_expiry", label: "Validade TR", type: "date" },
  { key: "criminal_record", label: "Registo criminal entregue", type: "checkbox" },
  { key: "criminal_record_expiry", label: "Validade registo criminal (opcional)", type: "date" },
  { key: "salary", label: "Salário mensal (€)", type: "number", step: "0.01" },
  { key: "salary_pay_day", label: "Dia de pagamento", type: "number" },
  { key: "hire_date", label: "Admissão", type: "date" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const fornecedores: CrudField[] = [
  { key: "company_name", label: "Nome da empresa", required: true },
  { key: "name", label: "Nome comercial" },
  { key: "contact_person", label: "Nome do responsável" },
  { key: "products_services", label: "Produtos / Serviços", type: "textarea" },
  { key: "nif", label: "NIF" }, { key: "category", label: "Categoria" },
  { key: "email", label: "Email" }, { key: "phone", label: "Telefone", type: "phone" }, { key: "address", label: "Morada" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const parceiros: CrudField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "partner_type", label: "Tipo", type: "select", options: [
    { value: "hotel", label: "Hotel" }, { value: "restaurante", label: "Restaurante" },
    { value: "agencia", label: "Agência" }, { value: "outro", label: "Outro" },
  ]},
  { key: "other_type_label", label: "Se outro, indicar" },
  { key: "contact_person", label: "Nome do responsável" },
  { key: "nif", label: "NIF" },
  { key: "email", label: "Email" }, { key: "phone", label: "Telefone", type: "phone" },
  { key: "address", label: "Morada" },
  { key: "commission_pct", label: "Comissão %", type: "number", step: "0.01" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const produtos: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "kind", label: "Tipo" },
  { key: "default_price", label: "Preço padrão (€)", type: "number", step: "0.01" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const roteiros: CrudField[] = [
  { key: "region_id", label: "Região", type: "select", required: true, optionsFrom: { table: "regions", value: "id", label: "name" } },
  { key: "name", label: "Nome do roteiro", required: true },
  { key: "description", label: "Descrição", type: "textarea" },
  { key: "active", label: "Ativo", type: "checkbox" },
];


function Cadastros() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Cadastros" description="Clientes, motoristas, veículos, fornecedores, parceiros e mais." />
      <Tabs defaultValue="drivers">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="drivers">Motoristas</TabsTrigger>
          <TabsTrigger value="vehicles">Veículos</TabsTrigger>
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="products">Produtos/Serviços</TabsTrigger>
          <TabsTrigger value="routes">Roteiros</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="drivers"><EntityCrud table="drivers" title="Motoristas" fields={motoristas} columns={["full_name","phone","contract_type","commission_pct","license_expiry"]} /></TabsContent>
          <TabsContent value="vehicles" className="space-y-8">
            <EntityCrud table="vehicles" title="Veículos" fields={veiculos} columns={["plate","brand","model","usage_type","seats"]} />
            <VehicleDrivers />
          </TabsContent>
          <TabsContent value="employees"><EntityCrud table="employees" title="Funcionários" fields={funcionarios} columns={["full_name","role","phone","salary","active"]} /></TabsContent>
          <TabsContent value="suppliers"><EntityCrud table="suppliers" title="Fornecedores" fields={fornecedores} columns={["company_name","contact_person","products_services","phone"]} /></TabsContent>
          <TabsContent value="partners"><EntityCrud table="partners" title="Parceiros" fields={parceiros} columns={["name","partner_type","contact_person","phone"]} /></TabsContent>
          <TabsContent value="products"><EntityCrud table="products_services" title="Produtos / Serviços" fields={produtos} columns={["name","kind","default_price","active"]} /></TabsContent>
          <TabsContent value="routes"><EntityCrud table="tour_routes" title="Roteiros" fields={roteiros} columns={["region_id","name","description","active"]} extraActions={<RegionsDialog />} /></TabsContent>
        </div>
      </Tabs>
      <p className="text-xs text-muted-foreground mt-4">Hotéis, restaurantes e agências passaram a ser geridos em <b>Parceiros</b> (por tipo). Centros de custo, contas bancárias, formas de pagamento e taxas de IVA estão em <b>Configurações</b>.</p>
    </div>
  );
}
