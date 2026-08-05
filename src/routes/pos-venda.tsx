import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { Copy, Send, Eye, Pencil, Trash2, Star, UserPlus } from "lucide-react";

export const Route = createFileRoute("/pos-venda")({ component: PosVenda });

function PosVenda() {
  const { isAdmin } = usePermissions();
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Pós-Venda" description="Pesquisas de satisfação, avaliações Google, indicações e histórico de feedback." />
      <Tabs defaultValue="pesquisa">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="pesquisa">Pesquisa de satisfação</TabsTrigger>
          <TabsTrigger value="google">Indicar Avaliação Google</TabsTrigger>
          <TabsTrigger value="indicacao">Indicação de novos clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico de feedback</TabsTrigger>
          {isAdmin && <TabsTrigger value="templates">Modelos</TabsTrigger>}
        </TabsList>
        <TabsContent value="pesquisa" className="mt-6 space-y-6"><ResultsPanel /><SendPanel /></TabsContent>
        <TabsContent value="google" className="mt-6"><GoogleReviewPanel /></TabsContent>
        <TabsContent value="indicacao" className="mt-6"><ReferralPanel /></TabsContent>
        <TabsContent value="historico" className="mt-6"><FeedbackHistoryPanel /></TabsContent>
        {isAdmin && <TabsContent value="templates" className="mt-6"><TemplatesPanel /></TabsContent>}
      </Tabs>
    </div>
  );
}

function useSurveys() {
  return useQuery({ queryKey: ["surveys"], queryFn: async () => (await (supabase.from("surveys" as any).select("*") as any).order("created_at",{ascending:false})).data ?? [] });
}

function ResultsPanel() {
  const { data: surveys = [] } = useSurveys();
  const total = surveys.length;
  const answered = surveys.filter((s: any) => s.status === "respondido");
  const respRate = total ? Math.round((answered.length / total) * 100) : 0;
  const avg = answered.length ? +(answered.reduce((a: number, s: any) => a + Number(s.average_score || 0), 0) / answered.length).toFixed(2) : 0;
  const npsVals = answered.map((s: any) => Number(s.nps_score)).filter((n) => !isNaN(n));
  const promoters = npsVals.filter((n) => n >= 9).length;
  const detractors = npsVals.filter((n) => n <= 6).length;
  const nps = npsVals.length ? Math.round(((promoters - detractors) / npsVals.length) * 100) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card className="p-5"><div className="text-sm text-muted-foreground">Pesquisas enviadas</div><div className="text-2xl font-bold">{total}</div></Card>
      <Card className="p-5"><div className="text-sm text-muted-foreground">Taxa de resposta</div><div className="text-2xl font-bold">{respRate}%</div></Card>
      <Card className="p-5"><div className="text-sm text-muted-foreground">Média (1-5)</div><div className="text-2xl font-bold text-emerald-600">{avg}</div></Card>
      <Card className="p-5"><div className="text-sm text-muted-foreground">NPS</div><div className={`text-2xl font-bold ${nps >= 0 ? "text-emerald-600" : "text-destructive"}`}>{nps}</div></Card>
    </div>
  );
}

function SurveyTable({ surveys }: { surveys: any[] }) {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("surveys" as any).update({
        client_name: editing.client_name,
        client_email: editing.client_email,
        status: editing.status,
        average_score: editing.average_score ? Number(editing.average_score) : null,
        nps_score: editing.nps_score !== "" && editing.nps_score != null ? Number(editing.nps_score) : null,
      } as any).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Pesquisa atualizada"); setEditing(null); qc.invalidateQueries({ queryKey: ["surveys"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("surveys").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Removida"); qc.invalidateQueries({ queryKey: ["surveys"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead>OS</TableHead><TableHead>Enviado</TableHead><TableHead>Respondido</TableHead><TableHead>Média</TableHead><TableHead>NPS</TableHead><TableHead>Estado</TableHead><TableHead className="text-right w-40">Ações</TableHead></TableRow></TableHeader>
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
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Copiar link" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/pesquisa/${s.token}`); toast.success("Link copiado"); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewing(s)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing({ ...s })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm(`Excluir pesquisa de ${s.client_name ?? "—"}?`)) del.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {surveys.length === 0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Sem pesquisas.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <QuickViewDialog open={!!viewing} onClose={() => setViewing(null)} title="Pesquisa" record={viewing} />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar pesquisa</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Cliente</Label><Input value={editing.client_name ?? ""} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} /></div>
              <div className="col-span-2"><Label>Email</Label><Input value={editing.client_email ?? ""} onChange={(e) => setEditing({ ...editing, client_email: e.target.value })} /></div>
              <div><Label>Média (1-5)</Label><Input type="number" step="0.1" value={editing.average_score ?? ""} onChange={(e) => setEditing({ ...editing, average_score: e.target.value })} /></div>
              <div><Label>NPS (0-10)</Label><Input type="number" value={editing.nps_score ?? ""} onChange={(e) => setEditing({ ...editing, nps_score: e.target.value })} /></div>
              <div className="col-span-2"><Label>Estado</Label>
                <Select value={editing.status} onValueChange={(v) => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="respondido">Respondido</SelectItem>
                    <SelectItem value="expirado">Expirado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SendPanel() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ template_id: "", service_order_id: "", client_email: "", client_name: "" });
  const { data: surveys = [] } = useSurveys();

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

      <SurveyTable surveys={surveys} />

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

function GoogleReviewPanel() {
  const [googleUrl, setGoogleUrl] = useState<string>(() => localStorage.getItem("google_review_url") ?? "");
  const [clientName, setClientName] = useState("");
  const [sent, setSent] = useState<{ id: string; name: string; date: string; sent: boolean }[]>(() => {
    try { return JSON.parse(localStorage.getItem("google_review_sent") ?? "[]"); } catch { return []; }
  });
  const persist = (list: typeof sent) => { setSent(list); localStorage.setItem("google_review_sent", JSON.stringify(list)); };

  const saveUrl = () => {
    localStorage.setItem("google_review_url", googleUrl);
    toast.success("Link Google guardado");
  };

  const copyAndTrack = () => {
    if (!googleUrl) { toast.error("Configura primeiro o link Google."); return; }
    if (!clientName.trim()) { toast.error("Indica o nome do cliente."); return; }
    const msg = `Olá ${clientName}! Obrigado por escolher a MTOUR Portugal. Se gostou do serviço, ajude-nos com uma avaliação Google: ${googleUrl}`;
    navigator.clipboard.writeText(msg);
    persist([{ id: crypto.randomUUID(), name: clientName, date: new Date().toISOString().slice(0,10), sent: false }, ...sent]);
    setClientName("");
    toast.success("Mensagem copiada e registada.");
  };

  const toggleSent = (id: string) => persist(sent.map((s) => s.id === id ? { ...s, sent: !s.sent } : s));
  const remove = (id: string) => persist(sent.filter((s) => s.id !== id));

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /> Link de avaliação Google</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <Input placeholder="https://g.page/r/..." value={googleUrl} onChange={(e) => setGoogleUrl(e.target.value)} />
          <Button className="gradient-gold text-gold-foreground" onClick={saveUrl}>Guardar link</Button>
        </div>
        <p className="text-xs text-muted-foreground">Cole aqui o link direto do Perfil de Empresa Google (Google Business Profile → Pedir avaliações).</p>
      </Card>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold">Preparar convite ao cliente</h3>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div><Label>Nome cliente</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} /></div>
          <div className="flex items-end"><Button className="gradient-gold text-gold-foreground" onClick={copyAndTrack}><Copy className="h-4 w-4 mr-1" /> Copiar mensagem e registar</Button></div>
        </div>
        <p className="text-xs text-muted-foreground">Copie a mensagem e envie pelo canal que preferir (WhatsApp, SMS). Marque abaixo assim que enviar.</p>
      </Card>

      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-12">Enviado</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Data</TableHead>
            <TableHead className="w-16 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {sent.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Sem registos.</TableCell></TableRow>}
            {sent.map((s) => (
              <TableRow key={s.id}>
                <TableCell><input type="checkbox" checked={s.sent} onChange={() => toggleSent(s.id)} /></TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.date}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}


type Referral = { id: string; date: string; referrer: string; referrer_id?: string | null; lead_name: string; lead_contact: string; lead_email: string; status: string; notes: string };

function ReferralPanel() {
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-referral"],
    queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });

  const [items, setItems] = useState<Referral[]>(() => {
    try { return JSON.parse(localStorage.getItem("referrals") ?? "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Referral | null>(null);
  const [viewing, setViewing] = useState<Referral | null>(null);
  const empty: Referral = { id: "", date: new Date().toISOString().slice(0,10), referrer: "", referrer_id: null, lead_name: "", lead_contact: "", lead_email: "", status: "novo", notes: "" };
  const [form, setForm] = useState<Referral>(empty);

  const persist = (list: Referral[]) => { setItems(list); localStorage.setItem("referrals", JSON.stringify(list)); };

  const add = () => {
    if (!form.referrer || !form.lead_name) { toast.error("Cliente indicador e nome do novo cliente são obrigatórios."); return; }
    const item = { ...form, id: crypto.randomUUID() };
    persist([item, ...items]);
    setForm(empty); setOpen(false);
    toast.success("Indicação registada");
  };

  const save = () => {
    if (!editing) return;
    persist(items.map((i) => i.id === editing.id ? editing : i));
    setEditing(null);
    toast.success("Indicação atualizada");
  };

  const del = (id: string) => { if (confirm("Excluir indicação?")) persist(items.filter((i) => i.id !== id)); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button className="gradient-gold text-gold-foreground" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4 mr-1" /> Nova indicação</Button>
      </div>
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Cliente indicador</TableHead><TableHead>Novo cliente</TableHead>
            <TableHead>Contacto</TableHead><TableHead>Estado</TableHead><TableHead className="text-right w-32">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Sem indicações registadas.</TableCell></TableRow>}
            {items.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.date}</TableCell>
                <TableCell>{i.referrer}</TableCell>
                <TableCell>{i.lead_name}</TableCell>
                <TableCell>{i.lead_contact}</TableCell>
                <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" title="Visualizar" onClick={() => setViewing(i)}><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Editar" onClick={() => setEditing({ ...i })}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <QuickViewDialog open={!!viewing} onClose={() => setViewing(null)} title="Indicação" record={viewing} />

      <Dialog open={open || !!editing} onOpenChange={(o) => { if (!o) { setOpen(false); setEditing(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar indicação" : "Nova indicação de cliente"}</DialogTitle></DialogHeader>
          {(() => {
            const f = editing ?? form;
            const setF = (v: Referral) => editing ? setEditing(v) : setForm(v);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
                <div><Label>Estado</Label>
                  <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="novo">Novo</SelectItem>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="convertido">Convertido</SelectItem>
                      <SelectItem value="perdido">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>Cliente indicador (registado)</Label>
                  <Select value={f.referrer_id ?? ""} onValueChange={(v) => { const c = clients.find((x: any) => x.id === v); setF({ ...f, referrer_id: v, referrer: c?.name ?? "" }); }}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Novo cliente (nome)</Label><Input value={f.lead_name} onChange={(e) => setF({ ...f, lead_name: e.target.value })} /></div>
                <div><Label>Novo cliente (contacto)</Label><Input value={f.lead_contact} onChange={(e) => setF({ ...f, lead_contact: e.target.value })} /></div>
                <div className="col-span-2"><Label>Novo cliente (email)</Label><Input type="email" value={f.lead_email} onChange={(e) => setF({ ...f, lead_email: e.target.value })} /></div>

                <div className="col-span-2"><Label>Notas</Label>
                  <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={editing ? save : add}>{editing ? "Guardar" : "Registar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FeedbackHistoryPanel() {
  const { data: surveys = [] } = useSurveys();
  const answered = surveys.filter((s: any) => s.status === "respondido");
  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-muted-foreground">
        Histórico consolidado de respostas recebidas. Pode visualizar, editar ou excluir cada registo.
      </Card>
      <SurveyTable surveys={answered} />
    </div>
  );
}

function TemplatesPanel() {
  const qc = useQueryClient();
  const { data: templates = [] } = useQuery({ queryKey: ["surveyTemplatesAll"], queryFn: async () => (await supabase.from("survey_templates").select("*").order("created_at")).data ?? [] });
  const [open, setOpen] = useState(false);
  const emptyForm = { id: null as string | null, name: "", description: "", questions: [] as any[], active: true };
  const [f, setF] = useState<any>(emptyForm);

  const addQ = () => setF({ ...f, questions: [...f.questions, { id: `q${Date.now()}`, label: "", type: "rating", required: true }] });
  const updateQ = (i: number, patch: any) => setF({ ...f, questions: f.questions.map((q: any, idx: number) => idx === i ? { ...q, ...patch } : q) });
  const rmQ = (i: number) => setF({ ...f, questions: f.questions.filter((_: any, idx: number) => idx !== i) });

  const save = useMutation({
    mutationFn: async () => {
      const payload = { name: f.name, description: f.description, questions: f.questions, active: f.active };
      if (f.id) {
        const { error } = await supabase.from("survey_templates").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("survey_templates").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Modelo guardado"); qc.invalidateQueries({ queryKey: ["surveyTemplatesAll"] }); qc.invalidateQueries({ queryKey: ["surveyTemplates"] }); setOpen(false); setF(emptyForm); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("survey_templates").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("Modelo removido"); qc.invalidateQueries({ queryKey: ["surveyTemplatesAll"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (t: any) => { setF({ id: t.id, name: t.name, description: t.description ?? "", questions: t.questions ?? [], active: t.active ?? true }); setOpen(true); };
  const openNew = () => { setF(emptyForm); setOpen(true); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button className="gradient-gold text-gold-foreground" onClick={openNew}>Novo modelo</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map((t: any) => (
          <Card key={t.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.description}</div>
              </div>
              <div className="flex">
                <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" title="Excluir" onClick={() => { if (confirm(`Excluir modelo ${t.name}?`)) del.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
            <ul className="mt-2 text-sm list-disc pl-5">
              {(t.questions ?? []).map((q: any) => <li key={q.id}>{q.label} <span className="text-xs text-muted-foreground">({q.type})</span></li>)}
            </ul>
          </Card>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{f.id ? "Editar modelo" : "Novo modelo"} de pesquisa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="space-y-2">
              <div className="flex justify-between items-center"><Label>Perguntas</Label><Button size="sm" variant="outline" onClick={addQ}>+ Adicionar pergunta</Button></div>
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
              {f.questions.length === 0 && <p className="text-xs text-muted-foreground">Sem perguntas. Clique em "Adicionar pergunta".</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()} disabled={!f.name || f.questions.length === 0 || save.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
