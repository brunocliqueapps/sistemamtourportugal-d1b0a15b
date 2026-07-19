import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityCrud, type CrudField } from "@/components/EntityCrud";
import { usePermissions, type AppRole, type ModuleKey } from "@/lib/permissions";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({ component: Configuracoes });

const ROLES: AppRole[] = ["admin", "comercial", "administrativo", "motorista"];
const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "dashboard", label: "Dashboard" }, { key: "agenda", label: "Agenda" },
  { key: "crm", label: "CRM · Leads" }, { key: "propostas", label: "Propostas" },
  { key: "oc", label: "Ordens de serviço" }, { key: "operacao", label: "Turnos Motorista" },
  { key: "tvde", label: "TVDE" }, { key: "financeiro", label: "Financeiro" },
  { key: "conta_corrente", label: "Conta Corrente" }, { key: "fechamento", label: "Fechamento" },
  { key: "relatorios", label: "Relatórios" }, { key: "cadastros", label: "Cadastros" },
  { key: "pos_venda", label: "Pós-Venda" }, { key: "importar", label: "Importar CSV" },
  { key: "configuracoes", label: "Configurações" },
];

function Configuracoes() {
  const { isAdmin, loading } = usePermissions();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);
  if (!isAdmin) return null;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Configurações" description="Painel do administrador: empresa, financeiro, utilizadores e permissões." />
      <Tabs defaultValue="company">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="cost_centers">Centros de custo</TabsTrigger>
          <TabsTrigger value="bank_accounts">Contas bancárias</TabsTrigger>
          <TabsTrigger value="payment_methods">Formas de pagto</TabsTrigger>
          <TabsTrigger value="vat_rates">Taxas IVA</TabsTrigger>
          <TabsTrigger value="users">Utilizadores</TabsTrigger>
          <TabsTrigger value="permissions">Permissões</TabsTrigger>
        </TabsList>
        <div className="mt-6">
          <TabsContent value="company"><CompanyForm /></TabsContent>
          <TabsContent value="cost_centers">
            <EntityCrud table="cost_centers" title="Centros de Custo" fields={[
              { key: "name", label: "Nome", required: true }, { key: "description", label: "Descrição" }, { key: "active", label: "Ativo", type: "checkbox" },
            ] as CrudField[]} columns={["name","description","active"]} orderBy="name" />
          </TabsContent>
          <TabsContent value="bank_accounts">
            <EntityCrud table="bank_accounts" title="Contas Bancárias" fields={[
              { key: "name", label: "Nome", required: true }, { key: "bank", label: "Banco" }, { key: "iban", label: "IBAN" },
              { key: "currency", label: "Moeda" }, { key: "opening_balance", label: "Saldo inicial (€)", type: "number", step: "0.01" },
              { key: "active", label: "Ativo", type: "checkbox" },
            ] as CrudField[]} columns={["name","bank","iban","opening_balance"]} orderBy="name" />
          </TabsContent>
          <TabsContent value="payment_methods">
            <EntityCrud table="payment_methods" title="Formas de Pagamento" fields={[
              { key: "name", label: "Nome", required: true }, { key: "active", label: "Ativo", type: "checkbox" },
            ] as CrudField[]} columns={["name","active"]} orderBy="name" />
          </TabsContent>
          <TabsContent value="vat_rates">
            <EntityCrud table="vat_rates" title="Taxas de IVA" fields={[
              { key: "name", label: "Nome", required: true }, { key: "rate", label: "Taxa (%)", type: "number", step: "0.01" },
              { key: "is_exempt", label: "Isento", type: "checkbox" }, { key: "active", label: "Ativo", type: "checkbox" },
            ] as CrudField[]} columns={["name","rate","is_exempt","active"]} orderBy="rate" />
          </TabsContent>
          <TabsContent value="users"><UsersPanel /></TabsContent>
          <TabsContent value="permissions"><PermissionsMatrix /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function CompanyForm() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["company"], queryFn: async () => (await supabase.from("company_settings").select("*").maybeSingle()).data });
  const [f, setF] = useState<any>({});
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_settings").update({ ...f, updated_at: new Date().toISOString() }).eq("id", data!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["company"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const F = (k: string, label: string, type = "text") => (
    <div><Label>{label}</Label><Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Card className="p-6 max-w-3xl">
      <div className="grid md:grid-cols-2 gap-3">
        {F("name","Nome da empresa")}{F("nif","NIF")}
        {F("address","Morada")}{F("postal_code","Código postal")}
        {F("city","Cidade")}{F("country","País")}
        {F("phone","Telefone")}{F("email","Email","email")}
        {F("website","Website")}{F("iban","IBAN")}
        {F("logo_url","Logo (URL)")}
        <div className="md:col-span-2">{F("invoice_footer","Rodapé da fatura")}</div>
      </div>
      <div className="mt-4"><Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()}>Guardar</Button></div>
    </Card>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery({ queryKey: ["profiles"], queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [] });
  const { data: userRoles = [] } = useQuery({ queryKey: ["user_roles"], queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [] });

  const setRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      await supabase.from("user_roles").delete().eq("user_id", user_id);
      const { error } = await supabase.from("user_roles").insert({ user_id, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Papel atualizado"); qc.invalidateQueries({ queryKey: ["user_roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <div className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Utilizadores registados. Crie novos abaixo ou peça o auto-registo em <code>/registro</code>. Depois atribua o papel.
        </div>
        <CreateUserDialog onCreated={() => { qc.invalidateQueries({ queryKey: ["profiles"] }); qc.invalidateQueries({ queryKey: ["user_roles"] }); }} />
      </div>
      <Table>
        <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Papel atual</TableHead><TableHead>Atribuir</TableHead></TableRow></TableHeader>
        <TableBody>
          {profiles.map((p: any) => {
            const cur = userRoles.find((r: any) => r.user_id === p.id)?.role ?? "";
            return (
              <TableRow key={p.id}>
                <TableCell>{p.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{p.email}</TableCell>
                <TableCell><span className="text-xs font-mono px-2 py-0.5 rounded bg-muted">{cur || "—"}</span></TableCell>
                <TableCell>
                  <Select value={cur} onValueChange={(v) => setRole.mutate({ user_id: p.id, role: v as AppRole })}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            );
          })}
          {profiles.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem utilizadores.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Card>
  );
}

function PermissionsMatrix() {
  const qc = useQueryClient();
  const { data: perms = [] } = useQuery({ queryKey: ["role_permissions"], queryFn: async () => (await supabase.from("role_permissions").select("*")).data ?? [] });

  const toggle = useMutation({
    mutationFn: async ({ role, module, on }: { role: AppRole; module: ModuleKey; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("role_permissions").insert({ role, module });
        if (error && !String(error.message).includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("role_permissions").delete().eq("role", role).eq("module", module);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["role_permissions"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const has = (role: AppRole, module: ModuleKey) => perms.some((p: any) => p.role === role && p.module === module);

  return (
    <Card className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Módulo</TableHead>
          {ROLES.map((r) => <TableHead key={r} className="text-center">{r}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {MODULES.map((m) => (
            <TableRow key={m.key}>
              <TableCell className="font-medium">{m.label}</TableCell>
              {ROLES.map((r) => (
                <TableCell key={r} className="text-center">
                  <Checkbox checked={has(r, m.key)} onCheckedChange={(v) => toggle.mutate({ role: r, module: m.key, on: !!v })} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
