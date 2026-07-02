import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/pos-venda")({ component: PosVenda });

function PosVenda() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [evalForm, setEvalForm] = useState({ lead_id: "", rating: 5, comments: "", image_authorization: false });
  const [refForm, setRefForm] = useState({ lead_id_original: "", referred_name: "", referred_phone: "", referred_email: "" });

  const { data: leads = [] } = useQuery({
    queryKey: ["leads-pv"],
    queryFn: async () => (await supabase.from("leads").select("id,name")).data ?? [],
  });
  const { data: evals = [] } = useQuery({
    queryKey: ["evals"],
    queryFn: async () => (await supabase.from("evaluations").select("*, leads(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: refs = [] } = useQuery({
    queryKey: ["refs"],
    queryFn: async () => (await supabase.from("referrals").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const addEval = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("evaluations").insert(evalForm); if (error) throw error; },
    onSuccess: () => { toast.success("Avaliação registada"); qc.invalidateQueries({ queryKey: ["evals"] }); setEvalForm({ lead_id: "", rating: 5, comments: "", image_authorization: false }); },
  });
  const addRef = useMutation({
    mutationFn: async () => {
      const { data: newLead, error: le } = await supabase.from("leads").insert({
        name: refForm.referred_name, email: refForm.referred_email, phone: refForm.referred_phone,
        origin: "indicacao", user_id: user?.id,
      }).select().single();
      if (le) throw le;
      const { error } = await supabase.from("referrals").insert({ ...refForm, new_lead_id: newLead.id, user_id: user?.id });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Indicação registada e lead criado"); qc.invalidateQueries(); setRefForm({ lead_id_original: "", referred_name: "", referred_phone: "", referred_email: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Pós-venda & Indicações" description="Avaliações e captação de novos leads." />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Nova avaliação</h3>
          <div>
            <Label>Cliente</Label>
            <Select value={evalForm.lead_id} onValueChange={(v) => setEvalForm({ ...evalForm, lead_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nota</Label>
            <div className="flex gap-1 mt-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setEvalForm({ ...evalForm, rating: n })} type="button">
                  <Star className={`h-6 w-6 ${n <= evalForm.rating ? "fill-gold text-gold" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>
          <div><Label>Comentários</Label><Textarea value={evalForm.comments} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={evalForm.image_authorization} onCheckedChange={(v) => setEvalForm({ ...evalForm, image_authorization: !!v })} />
            Autoriza uso de imagem para marketing
          </label>
          <Button className="gradient-gold text-gold-foreground" onClick={() => addEval.mutate()} disabled={!evalForm.lead_id}>Salvar Avaliação</Button>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="font-semibold">Nova indicação</h3>
          <div>
            <Label>Cliente que indicou</Label>
            <Select value={refForm.lead_id_original} onValueChange={(v) => setRefForm({ ...refForm, lead_id_original: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>{leads.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome do indicado</Label><Input value={refForm.referred_name} onChange={(e) => setRefForm({ ...refForm, referred_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Telefone</Label><Input value={refForm.referred_phone} onChange={(e) => setRefForm({ ...refForm, referred_phone: e.target.value })} /></div>
            <div><Label>E-mail</Label><Input type="email" value={refForm.referred_email} onChange={(e) => setRefForm({ ...refForm, referred_email: e.target.value })} /></div>
          </div>
          <Button className="gradient-gold text-gold-foreground" onClick={() => addRef.mutate()} disabled={!refForm.referred_name || !refForm.lead_id_original}>Salvar Indicação</Button>
        </Card>
      </div>

      <Card>
        <div className="p-6 pb-0"><h3 className="font-semibold">Últimas avaliações</h3></div>
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>Nota</TableHead><TableHead>Comentário</TableHead><TableHead>Imagem</TableHead></TableRow></TableHeader>
          <TableBody>
            {evals.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell>{e.leads?.name}</TableCell>
                <TableCell className="text-gold">{"★".repeat(e.rating)}<span className="text-muted-foreground">{"★".repeat(5-e.rating)}</span></TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.comments}</TableCell>
                <TableCell>{e.image_authorization ? "Sim" : "Não"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <div className="p-6 pb-0"><h3 className="font-semibold">Indicações captadas ({refs.length})</h3></div>
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>E-mail</TableHead></TableRow></TableHeader>
          <TableBody>
            {refs.map((r: any) => (
              <TableRow key={r.id}><TableCell>{r.referred_name}</TableCell><TableCell>{r.referred_phone}</TableCell><TableCell>{r.referred_email}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
