import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Check, Clock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { daysBetween, paymentSchedule, suggestPaymentTerms, type ItineraryDay } from "@/lib/payment-terms";
import { generateBudgetPdf } from "@/lib/proposal-pdf";
import { shortCode } from "@/lib/codes";

export const Route = createFileRoute("/orcamento")({
  component: Orcamento,
  head: () => ({
    meta: [
      { title: "Orçamento — Mtour Portugal" },
      { name: "description", content: "Gera orçamentos a partir das propostas com valores e condições de pagamento em PDF." },
      { property: "og:title", content: "Orçamento — Mtour Portugal" },
      { property: "og:description", content: "Orçamentos com valores e condições de pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

type Stage = { label: string; pct: any };
const DEFAULT_STAGES: Stage[] = [{ label: "Aprovação da Proposta", pct: 40 }, { label: "Final do Serviço", pct: 60 }];

function Orcamento() {
  const [selected, setSelected] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [terms, setTerms] = useState<string>("");
  const [receipt, setReceipt] = useState<string>("");
  const [refusal, setRefusal] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);


  const { data: props = [], refetch } = useQuery({
    queryKey: ["proposals-orcamento"],
    queryFn: async () => (await supabase.from("proposals").select("*, clients(*), regions(name), tour_routes(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: regions = [] } = useQuery({ queryKey: ["regions"], queryFn: async () => (await supabase.from("regions").select("*")).data ?? [] });
  const { data: routes = [] } = useQuery({ queryKey: ["tour_routes", "list-mini"], queryFn: async () => (await supabase.from("tour_routes").select("*")).data ?? [] });
  const { data: followups = [], refetch: refetchFollowups } = useQuery({
    queryKey: ["proposal-followups"],
    queryFn: async () => (await supabase.from("proposal_followups").select("*, proposals(code, clients(name))").eq("done", false).order("due_date")).data ?? [],
  });

  const q = search.trim().toLowerCase();
  const filteredProps = useMemo(() => !q ? (props as any[]) : (props as any[]).filter((x: any) =>
    [x.code, x.clients?.client_number, x.clients?.name, x.clients?.email].some((v: any) => String(v ?? "").toLowerCase().includes(q))), [props, q]);
  const p: any = useMemo(() => props.find((x: any) => x.id === selected), [props, selected]);
  const days = p ? (p.days_count ?? daysBetween(p.itinerary_start, p.itinerary_end) ?? 1) : 1;
  const total = Number(value || p?.total_value || 0);
  const itinerary: ItineraryDay[] = Array.isArray(p?.itinerary) ? p.itinerary : [];

  // Bilhetes diários de acompanhamento para propostas "em análise"
  useEffect(() => {
    const inAnalysis = (props as any[]).filter((x) => x.budget_status === "analise");
    if (!inAnalysis.length) return;
    (async () => {
      const rows: any[] = [];
      for (const prop of inAnalysis) {
        const start = (prop.budget_analysis_at ?? prop.created_at ?? new Date().toISOString()).slice(0, 10);
        for (let d = new Date(start); d.toISOString().slice(0, 10) <= today(); d.setDate(d.getDate() + 1)) {
          rows.push({ proposal_id: prop.id, due_date: d.toISOString().slice(0, 10), note: "Acompanhar proposta em análise" });
        }
      }
      if (!rows.length) return;
      await supabase.from("proposal_followups").upsert(rows, { onConflict: "proposal_id,due_date", ignoreDuplicates: true });
      refetchFollowups();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.length, (props as any[]).filter((x: any) => x.budget_status === "analise").length]);

  const stageTerms = () => stages.filter((s) => s.label.trim()).map((s) => `${s.label} ${Number(s.pct || 0)}%`).join(" · ");

  async function save() {
    if (!p) return;
    const { error } = await supabase.from("proposals")
      .update({
        total_value: total,
        payment_stages: stages.map((s) => ({ label: s.label, pct: Number(s.pct || 0) })),
        payment_terms: stageTerms() || terms || p.payment_terms || suggestPaymentTerms(days || 1),
      })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento atualizado");
    refetch();
  }

  async function validate() {
    if (!p) return;
    const { error } = await supabase.from("proposals").update({ budget_validated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento validado");
    refetch();
  }


  async function setBudgetStatus(status: "aprovado" | "analise" | "recusado") {
    if (!p) return;
    if (status === "aprovado" && !receipt.trim()) return toast.error("Indica as informações de recebimento.");
    if (status === "recusado" && !refusal.trim()) return toast.error("Indica o motivo da recusa.");
    const now = new Date().toISOString();
    const patch: any = { budget_status: status };
    if (status === "aprovado") { patch.budget_approved_at = now; patch.budget_receipt_info = receipt; patch.status = "aprovada"; }
    if (status === "analise") { patch.budget_analysis_at = now; }
    if (status === "recusado") { patch.budget_refused_at = now; patch.budget_refusal_reason = refusal; patch.status = "rejeitada"; }
    const { error } = await supabase.from("proposals").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (status === "aprovado") {
      // Lança automaticamente na conta corrente como entrada
      const { data: existing } = await supabase.from("cash_movements").select("id").eq("proposal_id", p.id).maybeSingle();
      const desc = ["Mtour", p.clients?.name, p.title || (p.proposal_kind === "servico_privado" ? "Serviço privado" : p.tour_routes?.name || "Roteiro personalizado")]
        .filter(Boolean).join(" · ");
      const mvPayload: any = { movement_date: now.slice(0, 10), kind: "entrada", amount: total, description: desc, proposal_id: p.id };
      const { error: mvErr } = existing
        ? await supabase.from("cash_movements").update(mvPayload).eq("id", existing.id)
        : await supabase.from("cash_movements").insert(mvPayload);
      if (mvErr) toast.error(`Conta corrente: ${mvErr.message}`);
    }
    if (status !== "analise") await supabase.from("proposal_followups").update({ done: true }).eq("proposal_id", p.id);
    toast.success(status === "aprovado" ? "Orçamento aprovado e lançado na conta corrente" : status === "analise" ? "Em análise — acompanhamento diário criado" : "Orçamento recusado");
    refetch(); refetchFollowups();
  }


  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Orçamento" description="Puxa todos os dados da proposta, define valor, condições e aprova, coloca em análise ou recusa." />

      {followups.length > 0 && (
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Bilhetes de acompanhamento pendentes</div>
          <div className="space-y-1 text-sm">
            {followups.map((f: any) => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-1">
                <span>{f.due_date} · {shortCode(f.proposals?.code)} · {f.proposals?.clients?.name ?? "—"}</span>
                <Button size="sm" variant="outline" onClick={async () => {
                  await supabase.from("proposal_followups").update({ done: true }).eq("id", f.id);
                  refetchFollowups();
                }}>Marcar tratado</Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3"><Label>Filtrar</Label>
            <Input placeholder="Nº de cliente, nome ou email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="sm:col-span-2"><Label>Proposta</Label>
            <Select value={selected} onValueChange={(v) => {
              setSelected(v);
              const pr: any = props.find((x: any) => x.id === v);
              setValue(String(pr?.total_value ?? 0));
              setTerms(pr?.payment_terms ?? suggestPaymentTerms(pr?.days_count ?? 1));
              setStages(Array.isArray(pr?.payment_stages) && pr.payment_stages.length
                ? pr.payment_stages.map((s: any) => ({ label: s.label ?? "Etapa", pct: Number(s.pct ?? 0) }))
                : DEFAULT_STAGES);
              setReceipt(pr?.budget_receipt_info ?? "");
              setRefusal(pr?.budget_refusal_reason ?? "");
            }}>

              <SelectTrigger><SelectValue placeholder="Selecionar proposta" /></SelectTrigger>
              <SelectContent>
                {filteredProps.map((x: any) => <SelectItem key={x.id} value={x.id}>{shortCode(x.code)} · {x.clients?.name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor total (€)</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        </div>

        {p && (
          <>
            <div className="rounded-md border p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>Nº Cliente: <span className="font-medium">{shortCode(p.clients?.client_number)}</span></div>
              <div>Cliente: <span className="font-medium">{p.clients?.name ?? "—"}</span></div>
              <div>NIF/Passaporte: <span className="font-medium">{p.clients?.nif ?? "—"}</span></div>
              <div>Telefone: <span className="font-medium">{[p.clients?.phone_country, p.clients?.phone].filter(Boolean).join(" ") || "—"}</span></div>
              <div>Email: <span className="font-medium">{p.clients?.email ?? "—"}</span></div>
              <div>Contacto emergência: <span className="font-medium">{p.clients?.emergency_contact ?? "—"}</span></div>
              <div>Responsável: <span className="font-medium">{p.responsible ?? "—"}</span></div>
              <div>Passageiros: <span className="font-medium">{p.passengers ?? p.clients?.passengers ?? "—"}</span></div>
              <div>Dias: <span className="font-medium">{days || "—"}</span></div>
              <div>Tipo: <span className="font-medium">{p.proposal_kind === "servico_privado" ? "Serviço Privado" : "Roteiro Personalizado"}</span></div>
              <div>Região: <span className="font-medium">{p.regions?.name ?? "—"}</span></div>
              <div>Roteiro: <span className="font-medium">{p.tour_routes?.name ?? "—"}</span></div>
              <div className="sm:col-span-3">Período: {[p.itinerary_start, p.itinerary_end].filter(Boolean).join(" → ") || "—"}</div>
              <div className="sm:col-span-3">Chegada: {[p.arrival_date, p.arrival_time, p.arrival_place].filter(Boolean).join(" · ") || "—"}</div>
              <div className="sm:col-span-3">Saída: {[p.departure_date, p.departure_time, p.departure_place].filter(Boolean).join(" · ") || "—"}</div>
              {p.descriptive && <div className="sm:col-span-3 whitespace-pre-wrap">Descritivo: {p.descriptive}</div>}
            </div>

            {itinerary.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead className="w-28">Data</TableHead><TableHead>Serviço contratado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {itinerary.map((d, i) => {
                    const reg = (regions as any[]).find((r) => r.id === (d.region_id || p.region_id));
                    const rt = (routes as any[]).find((r) => r.id === d.tour_route_id);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{d.date}</TableCell>
                        <TableCell className="whitespace-pre-wrap">
                          {[reg?.name, rt?.name].filter(Boolean).join(" · ")}
                          {(reg || rt) && d.text ? " — " : ""}{d.text || (reg || rt ? "" : "—")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div><Label>Observações das condições de pagamento</Label><Input value={terms} onChange={(e) => setTerms(e.target.value)} /></div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-semibold">Condições de pagamento (personalizáveis)</div>
              {stages.map((s, i) => {
                const patch = (v: Partial<Stage>) => setStages(stages.map((x, j) => (j === i ? { ...x, ...v } : x)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input className="w-20" type="number" min={0} max={100} value={s.pct} onChange={(e) => patch({ pct: e.target.value })} />
                    <span className="text-sm">%</span>
                    <Input className="flex-1 min-w-40" placeholder="Descrição da etapa" value={s.label} onChange={(e) => patch({ label: e.target.value })} />
                    <span className="text-sm w-24 text-right">€ {(total * Number(s.pct || 0) / 100).toFixed(2)}</span>
                    <Button size="icon" variant="ghost" onClick={() => setStages(stages.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={() => setStages([...stages, { label: "", pct: 0 }])}>+ Adicionar etapa</Button>
                <div className="text-xs text-muted-foreground">
                  Total: {stages.reduce((a, s) => a + Number(s.pct || 0), 0)}% · € {stages.reduce((a, s) => a + total * Number(s.pct || 0) / 100, 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                Estado do orçamento
                <Badge variant={p.budget_status === "aprovado" ? "default" : "outline"}>{p.budget_status ?? "rascunho"}</Badge>
                {p.budget_validated_at && <Badge variant="default">Validado</Badge>}
              </div>

              {p.budget_approved_at && <div className="text-xs text-muted-foreground">Aprovado em {new Date(p.budget_approved_at).toLocaleString("pt-PT")} · Recebimento: {p.budget_receipt_info ?? "—"}</div>}
              {p.budget_refused_at && <div className="text-xs text-muted-foreground">Recusado em {new Date(p.budget_refused_at).toLocaleString("pt-PT")} · Motivo: {p.budget_refusal_reason ?? "—"}</div>}
              {p.budget_analysis_at && p.budget_status === "analise" && <div className="text-xs text-muted-foreground">Em análise desde {new Date(p.budget_analysis_at).toLocaleDateString("pt-PT")} — bilhete diário de acompanhamento até aprovar ou recusar.</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Informações do recebimento (aprovação)</Label><Textarea rows={2} value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Ex.: 30% recebido por transferência em 10/02" /></div>
                <div><Label>Motivo da recusa</Label><Textarea rows={2} value={refusal} onChange={(e) => setRefusal(e.target.value)} placeholder="Motivo indicado pelo cliente" /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setBudgetStatus("aprovado")} className="gradient-gold text-gold-foreground"><Check className="h-4 w-4 mr-1" /> Aprovado</Button>
                <Button variant="outline" onClick={() => setBudgetStatus("analise")}><Clock className="h-4 w-4 mr-1" /> Em análise</Button>
                <Button variant="outline" onClick={() => setBudgetStatus("recusado")}><X className="h-4 w-4 mr-1" /> Recusado</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={save}>Guardar</Button>
              <Button variant="outline" onClick={() => generateBudgetPdf(p.id).catch((e) => toast.error(e.message))}>
                <FileDown className="h-4 w-4 mr-1" /> Descarregar PDF
              </Button>
              <Button className="gradient-gold text-gold-foreground" onClick={async () => { await save(); await validate(); }}>
                <Check className="h-4 w-4 mr-1" /> Validar Orçamento
              </Button>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-semibold text-sm mb-2">Orçamentos validados</div>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Validado</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">PDF</TableHead></TableRow></TableHeader>
          <TableBody>
            {(props as any[]).filter((x: any) => x.budget_validated_at).map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{new Date(x.budget_validated_at).toLocaleString("pt-PT")}</TableCell>
                <TableCell className="text-right">€ {Number(x.total_value || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => generateBudgetPdf(x.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {!(props as any[]).some((x: any) => x.budget_validated_at) && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nenhum orçamento validado ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>

  );
}
