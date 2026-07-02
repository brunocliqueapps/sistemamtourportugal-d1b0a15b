import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/crm")({ component: CRM });

const statusColors: Record<string, string> = {
  novo: "bg-secondary text-secondary-foreground",
  qualificado: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  proposta: "bg-gold/30 text-gold-foreground",
  fechado: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  perdido: "bg-destructive/20 text-destructive",
};

function CRM() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", origin: "site", indication_name: "", partner: "" });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({ ...form, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead cadastrado");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setOpen(false);
      setForm({ name: "", email: "", phone: "", origin: "site", indication_name: "", partner: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="CRM Comercial"
        description="Gestão de leads e oportunidades comerciais."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-gold text-gold-foreground"><Plus className="h-4 w-4 mr-2" />Novo Lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Lead</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div>
                  <Label>Origem</Label>
                  <Select value={form.origin} onValueChange={(v) => setForm({ ...form, origin: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="site">Site</SelectItem>
                      <SelectItem value="indicacao">Indicação</SelectItem>
                      <SelectItem value="parceiro">Parceiro</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.origin === "indicacao" && (
                  <div><Label>Nome de quem indicou</Label><Input value={form.indication_name} onChange={(e) => setForm({ ...form, indication_name: e.target.value })} /></div>
                )}
                {form.origin === "parceiro" && (
                  <div><Label>Parceiro</Label><Input value={form.partner} onChange={(e) => setForm({ ...form, partner: e.target.value })} /></div>
                )}
                <Button className="w-full" onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                  {create.isPending ? "A gravar…" : "Salvar Lead"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">A carregar…</TableCell></TableRow>}
            {!isLoading && leads.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Ainda sem leads. Clique em "Novo Lead".</TableCell></TableRow>}
            {leads.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.email || l.phone || "—"}</TableCell>
                <TableCell><Badge variant="outline">{l.origin || "—"}</Badge></TableCell>
                <TableCell><Badge className={statusColors[l.status] || ""}>{l.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Link to="/crm/$id/qualificacao" params={{ id: l.id }}><Button variant="ghost" size="sm">Qualificar</Button></Link>
                  <Link to="/crm/$id/viagem" params={{ id: l.id }}><Button variant="ghost" size="sm">Viagem</Button></Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
