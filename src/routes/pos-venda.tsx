import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { usePermissions } from "@/lib/permissions";
import { Copy, Send } from "lucide-react";

export const Route = createFileRoute("/pos-venda")({ component: PosVenda });

function PosVenda() {
  const { isAdmin } = usePermissions();
  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Pós-Venda" description="Envio de pesquisas de satisfação e análise dos resultados." />
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Resultados</TabsTrigger>
          <TabsTrigger value="send">Enviar Pesquisa</TabsTrigger>
          {isAdmin && <TabsTrigger value="templates">Modelos</TabsTrigger>}
        </TabsList>
        <TabsContent value="dashboard" className="mt-6"><ResultsPanel /></TabsContent>
        <TabsContent value="send" className="mt-6"><SendPanel /></TabsContent>
        {isAdmin && <TabsContent value="templates" className="mt-6"><TemplatesPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

function ResultsPanel() {
  const { data: surveys = [] } = useQuery({ queryKey: ["surveys"], queryFn: async () => (await supabase.from("surveys").select("*").order("created_at",{ascending:false})).data ?? [] });
  const total = surveys.length;
  const answered = surveys.filter((s: any) => s.status === "respondido");
  const respRate = total ? Math.round((answered.length / total) * 100) : 0;
  const avg = answered.length ? +(answered.reduce((a: number, s: any) => a + Number(s.average_score || 0), 0) / answered.length).toFixed(2) : 0;
  const npsVals = answered.map((s: any) => Number(s.nps_score)).filter((n) => !isNaN(n));
  const promoters = npsVals.filter((n) => n >= 9).length;
  const detractors = npsVals.filter((n) => n <= 6).length;
  const nps = npsVals.length ? Math.round(((promoters - detractors) / npsVals.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5"><div className="text-sm text-muted-foreground">Pesquisas enviadas</div><div className="text-2xl font-bold">{total}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Taxa de resposta</div><div className="text-2xl font-bold">{respRate}%</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">Média (1-5)</div><div className="text-2xl font-bold text-emerald-600">{avg}</div></Card>
        <Card className="p-5"><div className="text-sm text-muted-foreground">NPS</div><div className={`text-2xl font-bold ${nps >= 0 ? "text-emerald-600" : "text-destructive"}`}>{nps}</div></Card>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>OC</TableHead><TableHead>Enviado</TableHead><TableHead>Respondido</TableHead><TableHead>Média</TableHead><TableHead>NPS</TableHead><TableHead>Estado</TableHead><TableHead>Link</TableHead></TableRow></TableHeader>
          <TableBody>
            {surveys.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.client_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{s.service_order_id?.slice(0,8) ?? "—"}</TableCell>
                <TableCell className="text-xs">{s.sent_at ? new Date(s.sent_at).toLocaleDateString("pt-PT") : "—"}</TableCell>
                <TableCell className="text-xs">{s.answered_at ? new Date(s.answered_at).toLocaleDateString("pt-PT") : "—"}</TableCell>
                <TableCell>{s.average_score ?? "—"}</TableCell>
                <TableCell>{s.nps_score ?? "—"}</TableCell>
                <TableCell><Badge variant={s.status === "respondido" ? "default" : "outline"}>{s.status}</Badge></TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/pesquisa/${s.token}`); toast.success("Link copiado"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {surveys.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sem pesquisas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function SendPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ template_id: "", service_order_id: "", client_email: "", client_name: "" });

  const { data: templates = [] } = useQuery({ queryKey: ["surveyTemplates"], queryFn: async () => (await supabase.from("survey_templates").select("*").eq("active", true)).data ?? [] });
  const { data: ocs = [] } = useQuery({ queryKey: ["ocsForSurvey"], queryFn: async () => (await supabase.from("service_orders").select("id,code,client_name,status").order("service_date",{ascending:false}).limit(200)).data ?? [] });

  const create = useMutation({
    mutationFn: async () => {
      const oc = ocs.find((o: any) => o.id === form.service_order_id);
      const payload: any = {
        template_id: form.template_id || null,
        service_order_id: form.service_order_id || null,
        client_name: form.client_name || oc?.client_name,
        client_email: form.client_email,
        status: "enviado",
        sent_at: new Date().toISOString(),
      };
      const { data, error } = await supabase.from("surveys").insert(payload).select().single();
      if (error) throw error;
      const url = `${window.location.origin}/pesquisa/${data.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Pesquisa criada. Link copiado.");
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gradient-gold text-gold-foreground" onClick={() => setOpen(true)}><Send className="h-4 w-4 mr-1" /> Nova pesquisa</Button>
      </div>
      <Card className="p-4 text-sm text-muted-foreground">
        Escolha o modelo e a OC. Ao criar, o link público de resposta é copiado. Envie-o ao cliente por email/WhatsApp.
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova pesquisa de satisfação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Modelo</Label>
              <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ordem de serviço</Label>
              <Select value={form.service_order_id} onValueChange={(v) => setForm({ ...form, service_order_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{ocs.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.code} · {o.client_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome cliente</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><Label>Email cliente</Label><Input type="email" value={form.client_email} onChange={(e) => setForm({ ...form, client_email: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => create.mutate()}>Criar e copiar link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplatesPanel() {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ["surveyTemplatesAll"], queryFn: async () => (await supabase.from("survey_templates").select("*").order("created_at")).data ?? [] });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ name: "", description: "", questions: [] as any[] });

  const addQ = () => setF({ ...f, questions: [...f.questions, { id: `q${Date.now()}`, label: "", type: "rating", required: true }] });
  const updateQ = (i: number, patch: any) => setF({ ...f, questions: f.questions.map((q: any, idx: number) => idx === i ? { ...q, ...patch } : q) });
  const rmQ = (i: number) => setF({ ...f, questions: f.questions.filter((_: any, idx: number) => idx !== i) });

  const save = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("survey_templates").insert(f); if (error) throw error; },
    onSuccess: () => { toast.success("Modelo criado"); qc.invalidateQueries({ queryKey: ["surveyTemplatesAll"] }); setOpen(false); setF({ name: "", description: "", questions: [] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => setOpen(true)}>Novo modelo</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t: any) => (
          <Card key={t.id} className="p-4">
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-muted-foreground">{t.description}</div>
            <ul className="mt-2 text-sm list-disc pl-5">
              {(t.questions ?? []).map((q: any) => <li key={q.id}>{q.label} <span className="text-xs text-muted-foreground">({q.type})</span></li>)}
            </ul>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo modelo de pesquisa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><Label>Perguntas</Label><Button size="sm" variant="outline" onClick={addQ}>+ Adicionar</Button></div>
              {f.questions.map((q: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-7"><Input placeholder="Pergunta" value={q.label} onChange={(e) => updateQ(i, { label: e.target.value })} /></div>
                  <div className="col-span-3">
                    <Select value={q.type} onValueChange={(v) => updateQ(i, { type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">Avaliação 1-5</SelectItem>
                        <SelectItem value="nps">NPS 0-10</SelectItem>
                        <SelectItem value="yes_no">Sim / Não</SelectItem>
                        <SelectItem value="text">Texto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Button variant="ghost" size="sm" onClick={() => rmQ(i)}>Remover</Button></div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!f.name || f.questions.length === 0}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
