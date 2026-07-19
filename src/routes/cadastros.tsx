import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityCrud, type CrudField } from "@/components/EntityCrud";

export const Route = createFileRoute("/cadastros")({ component: Cadastros });

const clientes: CrudField[] = [
  { key: "name", label: "Nome", required: true },
  { key: "nif", label: "NIF" }, { key: "email", label: "Email", type: "email" }, { key: "phone", label: "Telefone", type: "phone" },
  { key: "city", label: "Cidade" }, { key: "country", label: "País" }, { key: "address", label: "Morada" },
  { key: "notes", label: "Notas", type: "textarea" },
];
const motoristas: CrudField[] = [
  { key: "full_name", label: "Nome", required: true },
  { key: "phone", label: "Telefone" }, { key: "email", label: "Email", type: "email" },
  { key: "license_number", label: "Nº Carta" }, { key: "license_expiry", label: "Validade Carta", type: "date" },
  { key: "tvde_card_number", label: "Nº Cartão TVDE" }, { key: "tvde_card_expiry", label: "Validade TVDE", type: "date" },
  { key: "hire_date", label: "Data admissão", type: "date" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const veiculos: CrudField[] = [
  { key: "plate", label: "Matrícula", required: true },
  { key: "brand", label: "Marca" }, { key: "model", label: "Modelo" }, { key: "year", label: "Ano", type: "number" },
  { key: "color", label: "Cor" }, { key: "seats", label: "Lugares", type: "number" }, { key: "fuel_type", label: "Combustível" },
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
  { key: "hire_date", label: "Admissão", type: "date" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const fornecedores: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "nif", label: "NIF" }, { key: "category", label: "Categoria" },
  { key: "email", label: "Email" }, { key: "phone", label: "Telefone" }, { key: "address", label: "Morada" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const parceiros: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "type", label: "Tipo" }, { key: "nif", label: "NIF" },
  { key: "email", label: "Email" }, { key: "phone", label: "Telefone" }, { key: "commission_pct", label: "Comissão %", type: "number", step: "0.01" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const hoteis: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "city", label: "Cidade" }, { key: "address", label: "Morada" },
  { key: "phone", label: "Telefone" }, { key: "email", label: "Email" }, { key: "contact_person", label: "Contacto" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const restaurantes: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "city", label: "Cidade" }, { key: "cuisine", label: "Cozinha" },
  { key: "address", label: "Morada" }, { key: "phone", label: "Telefone" }, { key: "email", label: "Email" },
  { key: "active", label: "Ativo", type: "checkbox" },
];
const agencias: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "nif", label: "NIF" },
  { key: "contact_person", label: "Contacto" }, { key: "email", label: "Email" }, { key: "phone", label: "Telefone" },
  { key: "commission_pct", label: "Comissão %", type: "number", step: "0.01" }, { key: "active", label: "Ativo", type: "checkbox" },
];
const produtos: CrudField[] = [
  { key: "name", label: "Nome", required: true }, { key: "kind", label: "Tipo" },
  { key: "default_price", label: "Preço padrão (€)", type: "number", step: "0.01" }, { key: "active", label: "Ativo", type: "checkbox" },
];

function Cadastros() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Cadastros" description="Clientes, motoristas, veículos, fornecedores, parceiros e mais." />
      <Tabs defaultValue="clients">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="drivers">Motoristas</TabsTrigger>
          <TabsTrigger value="vehicles">Veículos</TabsTrigger>
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="hotels">Hotéis</TabsTrigger>
          <TabsTrigger value="restaurants">Restaurantes</TabsTrigger>
          <TabsTrigger value="agencies">Agências</TabsTrigger>
          <TabsTrigger value="products">Produtos/Serviços</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="clients"><EntityCrud table="clients" title="Clientes" fields={clientes} columns={["name","nif","email","phone"]} /></TabsContent>
          <TabsContent value="drivers"><EntityCrud table="drivers" title="Motoristas" fields={motoristas} columns={["full_name","phone","license_expiry","tvde_card_expiry"]} /></TabsContent>
          <TabsContent value="vehicles"><EntityCrud table="vehicles" title="Veículos" fields={veiculos} columns={["plate","brand","model","seats"]} /></TabsContent>
          <TabsContent value="employees"><EntityCrud table="employees" title="Funcionários" fields={funcionarios} columns={["full_name","role","phone","active"]} /></TabsContent>
          <TabsContent value="suppliers"><EntityCrud table="suppliers" title="Fornecedores" fields={fornecedores} columns={["name","nif","category","phone"]} /></TabsContent>
          <TabsContent value="partners"><EntityCrud table="partners" title="Parceiros" fields={parceiros} columns={["name","type","commission_pct","active"]} /></TabsContent>
          <TabsContent value="hotels"><EntityCrud table="hotels" title="Hotéis" fields={hoteis} columns={["name","city","phone","contact_person"]} /></TabsContent>
          <TabsContent value="restaurants"><EntityCrud table="restaurants" title="Restaurantes" fields={restaurantes} columns={["name","city","cuisine","phone"]} /></TabsContent>
          <TabsContent value="agencies"><EntityCrud table="agencies" title="Agências" fields={agencias} columns={["name","nif","commission_pct","active"]} /></TabsContent>
          <TabsContent value="products"><EntityCrud table="products_services" title="Produtos / Serviços" fields={produtos} columns={["name","kind","default_price","active"]} /></TabsContent>
        </div>
      </Tabs>
      <p className="text-xs text-muted-foreground mt-4">Centros de custo, contas bancárias, formas de pagamento e taxas de IVA foram movidos para <b>Configurações</b>.</p>
    </div>
  );
}


function Cadastros() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Cadastros" description="Clientes, motoristas, veículos, fornecedores, parceiros e mais." />
      <Tabs defaultValue="clients">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="clients">Clientes</TabsTrigger>
          <TabsTrigger value="drivers">Motoristas</TabsTrigger>
          <TabsTrigger value="vehicles">Veículos</TabsTrigger>
          <TabsTrigger value="employees">Funcionários</TabsTrigger>
          <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="hotels">Hotéis</TabsTrigger>
          <TabsTrigger value="restaurants">Restaurantes</TabsTrigger>
          <TabsTrigger value="agencies">Agências</TabsTrigger>
          <TabsTrigger value="products">Produtos/Serviços</TabsTrigger>
          <TabsTrigger value="cost_centers">Centros custo</TabsTrigger>
          <TabsTrigger value="bank_accounts">Contas bancárias</TabsTrigger>
          <TabsTrigger value="payment_methods">Formas pagto</TabsTrigger>
          <TabsTrigger value="vat_rates">Taxas IVA</TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="clients"><EntityCrud table="clients" title="Clientes" fields={clientes} columns={["name","nif","email","phone"]} /></TabsContent>
          <TabsContent value="drivers"><EntityCrud table="drivers" title="Motoristas" fields={motoristas} columns={["full_name","phone","license_expiry","tvde_card_expiry"]} /></TabsContent>
          <TabsContent value="vehicles"><EntityCrud table="vehicles" title="Veículos" fields={veiculos} columns={["plate","brand","model","seats"]} /></TabsContent>
          <TabsContent value="employees"><EntityCrud table="employees" title="Funcionários" fields={funcionarios} columns={["full_name","role","phone","active"]} /></TabsContent>
          <TabsContent value="suppliers"><EntityCrud table="suppliers" title="Fornecedores" fields={fornecedores} columns={["name","nif","category","phone"]} /></TabsContent>
          <TabsContent value="partners"><EntityCrud table="partners" title="Parceiros" fields={parceiros} columns={["name","type","commission_pct","active"]} /></TabsContent>
          <TabsContent value="hotels"><EntityCrud table="hotels" title="Hotéis" fields={hoteis} columns={["name","city","phone","contact_person"]} /></TabsContent>
          <TabsContent value="restaurants"><EntityCrud table="restaurants" title="Restaurantes" fields={restaurantes} columns={["name","city","cuisine","phone"]} /></TabsContent>
          <TabsContent value="agencies"><EntityCrud table="agencies" title="Agências" fields={agencias} columns={["name","nif","commission_pct","active"]} /></TabsContent>
          <TabsContent value="products"><EntityCrud table="products_services" title="Produtos / Serviços" fields={produtos} columns={["name","kind","default_price","active"]} /></TabsContent>
          <TabsContent value="cost_centers"><EntityCrud table="cost_centers" title="Centros de Custo" fields={centros} columns={["name","description","active"]} orderBy="name" /></TabsContent>
          <TabsContent value="bank_accounts"><EntityCrud table="bank_accounts" title="Contas Bancárias" fields={contas} columns={["name","bank","iban","opening_balance"]} orderBy="name" /></TabsContent>
          <TabsContent value="payment_methods"><EntityCrud table="payment_methods" title="Formas de Pagamento" fields={formasPag} columns={["name","active"]} orderBy="name" /></TabsContent>
          <TabsContent value="vat_rates"><EntityCrud table="vat_rates" title="Taxas de IVA" fields={taxasIva} columns={["name","rate","is_exempt","active"]} orderBy="rate" /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
