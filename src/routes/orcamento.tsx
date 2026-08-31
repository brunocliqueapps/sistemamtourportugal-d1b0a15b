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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Check, Clock, X, Pencil, ChevronsUpDown, Save, Lock, Unlock, Eye } from "lucide-react";
import { QuickViewDialog } from "@/components/QuickViewDialog";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { daysBetween, suggestPaymentTerms, type ItineraryDay } from "@/lib/payment-terms";
import { generateBudgetPdf } from "@/lib/proposal-pdf";
import { shortCode } from "@/lib/codes";
import { fmtDate } from "@/lib/format-date";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { useFinalizedProposalIds } from "@/lib/finalized";
import { usePermissions } from "@/lib/permissions";



export const Route = createFileRoute("/orcamento")({
  component: Orcamento,
  head: () => ({
    meta: [
      { title: "Proposta/Orçamento — Mtour Portugal" },
      { name: "description", content: "Gera propostas/orçamentos a partir dos roteiros com valores e condições de pagamento em PDF." },
      { property: "og:title", content: "Proposta/Orçamento — Mtour Portugal" },
      { property: "og:description", content: "Propostas e orçamentos com valores e condições de pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

/** Formas de pagamento disponíveis para escolha. */
const PAYMENT_METHODS: string[] = [
  "Transferência bancária via Wise",
  "Depósito em conta bancária em Portugal",
];

type Stage = { label: string; pct: any };
const DEFAULT_STAGES: Stage[] = [
  { label: "Aprovação da Proposta", pct: 30 },
  { label: "Antes de iniciar o Serviço", pct: 60 },
  { label: "Após Concluir o Serviço", pct: 10 }
];

function Orcamento() {
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const { isAdmin } = usePermissions();
  const [selected, setSelected] = useState<string>("");

  const [value, setValue] = useState<string>("");
  const [terms, setTerms] = useState<string>("");
  const [receipt, setReceipt] = useState<string>("");
  const [refusal, setRefusal] = useState<string>("");
  const [analysisInfo, setAnalysisInfo] = useState<string>("");
  const [statusDate, setStatusDate] = useState<string>(today());
  const [action, setAction] = useState<"" | "aprovado" | "analise" | "recusado">("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<any | null>(null);
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

  const finalizedIds = useFinalizedProposalIds();
  const finishedIds = useMemo(() => new Set([
    ...(props as any[]).filter((x: any) => x.budget_status === "aprovado" || finalizedIds.has(x.id)).map((x: any) => x.id),
  ]), [props, finalizedIds]);
  const selectableProps = useMemo(() => (props as any[]).filter((x: any) => (!x.budget_validated_at && !finalizedIds.has(x.id)) || x.id === selected), [props, selected, finalizedIds]);
  const savedBudgets = useMemo(() => (props as any[]).filter((x: any) => x.budget_saved_at && !x.budget_validated_at && !finalizedIds.has(x.id)), [props, finalizedIds]);
  const validatedActive = useMemo(() => (props as any[]).filter((x: any) => x.budget_validated_at && !finalizedIds.has(x.id)), [props, finalizedIds]);
  const historyProps = useMemo(() => (props as any[]).filter((x: any) => finalizedIds.has(x.id)), [props, finalizedIds]);
  // Acompanhamentos pendentes: apenas propostas em análise (não aprovadas nem finalizadas)
  const pendingFollowups = useMemo(() => (followups as any[]).filter((f: any) => {
    const pr: any = (props as any[]).find((x: any) => x.id === f.proposal_id);
    return pr && pr.budget_status !== "aprovado" && !finalizedIds.has(pr.id);
  }), [followups, props, finalizedIds]);


  const p: any = useMemo(() => props.find((x: any) => x.id === selected), [props, selected]);
  const locked = !!p?.budget_validated_at;


  function pickProposal(v: string) {
    if (v === selected) return;
    if (hasUnsavedChanges && !confirm("Tem alterações não guardadas. Deseja trocar de proposta?")) return;
    setSelected(v);
    const pr: any = (props as any[]).find((x: any) => x.id === v);
    setValue(String(pr?.total_value ?? 0));
    setTerms(pr?.payment_terms ?? "");
    setStages(Array.isArray(pr?.payment_stages) && pr.payment_stages.length
      ? pr.payment_stages.map((s: any) => ({ label: s.label ?? "Etapa", pct: Number(s.pct ?? 0) }))
      : DEFAULT_STAGES);
    setReceipt(pr?.budget_receipt_info ?? "");
    setRefusal(pr?.budget_refusal_reason ?? "");
    setAnalysisInfo(pr?.budget_analysis_info ?? "");
    setAction("");
    setStatusDate(today());
    setHasUnsavedChanges(false);
  }

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

  function close() {
    setSelected(""); setAction(""); setValue(""); setTerms(""); setReceipt(""); setRefusal(""); setAnalysisInfo("");
    setStages(DEFAULT_STAGES); setStatusDate(today()); setHasUnsavedChanges(false);
  }

  async function save(silent = false) {
    if (!p) return true;
    const { error } = await supabase.from("proposals")
      .update({
        total_value: total,
        payment_stages: stages.map((s) => ({ label: s.label, pct: Number(s.pct || 0) })),
        payment_terms: terms || p.payment_terms || stageTerms() || suggestPaymentTerms(days || 1),
        budget_saved_at: new Date().toISOString(),
      } as any)
      .eq("id", p.id);
    if (error) { toast.error(error.message); return false; }
    if (!silent) { toast.success("Orçamento salvo"); setHasUnsavedChanges(false); }
    refetch();
    return true;
  }

  async function unlockBudget() {
    if (!p) return;
    if (!confirm("Desbloquear este orçamento para edição? A validação será removida.")) return;
    const { error } = await supabase.from("proposals")
      .update({ budget_validated_at: null, budget_saved_at: new Date().toISOString() } as any)
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento desbloqueado para edição");
    refetch();
  }

  async function unsaveBudget() {
    if (!p) return;
    if (!confirm("Remover este orçamento da lista de salvos? Poderá fazê-lo novamente depois.")) return;
    const { error } = await supabase.from("proposals")
      .update({ budget_saved_at: null } as any)
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento removido dos salvos");
    refetch();
    close();
  }


  async function validate() {
    if (!p) return false;
    const { error } = await supabase.from("proposals").update({ budget_validated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Orçamento validado");
    refetch();
    return true;
  }


  async function setBudgetStatus(status: "aprovado" | "analise" | "recusado") {
    if (!p) return;
    if (status === "aprovado" && !receipt.trim()) return toast.error("Indica as informações de recebimento.");
    if (status === "recusado" && !refusal.trim()) return toast.error("Indica o motivo da recusa.");
    const when = statusDate ? new Date(`${statusDate}T12:00:00`).toISOString() : new Date().toISOString();
    const patch: any = { budget_status: status };
    if (status === "aprovado") { patch.budget_approved_at = when; patch.budget_receipt_info = receipt; patch.status = "aprovada"; }
    if (status === "analise") { patch.budget_analysis_at = when; patch.budget_analysis_info = analysisInfo; patch.budget_validated_at = null; patch.status = "enviada"; }
    if (status === "recusado") { patch.budget_refused_at = when; patch.budget_refusal_reason = refusal; patch.budget_validated_at = null; patch.status = "rejeitada"; }
    const { error } = await supabase.from("proposals").update(patch).eq("id", p.id);
    if (error) return toast.error(error.message);
    if (status === "aprovado") {
      // Gera automaticamente a Ordem de Serviço / Voucher (sem campos a preencher)
      const { data: existingSo } = await supabase.from("service_orders").select("id").eq("proposal_id", p.id).maybeSingle();
      if (!existingSo) {
        const { error: soErr } = await supabase.from("service_orders").insert({
          proposal_id: p.id,
          client_id: p.client_id,
          sale_value: total,
          service_date: (p.itinerary_start ?? when).slice(0, 10),
          passengers: p.passengers ?? p.clients?.passengers ?? null,
          origin: p.arrival_place ?? null,
          destination: p.departure_place ?? null,
          payment_terms: terms || p.payment_terms || stageTerms() || null,
          status: "agendado",
        });
        if (soErr) toast.error(`OS: ${soErr.message}`);
      }
      await supabase.from("proposals").update({ status: "convertida", approved_at: when }).eq("id", p.id);
      // Lança automaticamente na conta corrente como entrada
      const { data: existing } = await supabase.from("cash_movements").select("id").eq("proposal_id", p.id).maybeSingle();
      const desc = ["Mtour", p.clients?.name, p.title || (p.proposal_kind === "servico_privado" ? "Serviço privado" : p.tour_routes?.name || "Roteiro personalizado")]
        .filter(Boolean).join(" · ");
      const mvPayload: any = { movement_date: when.slice(0, 10), kind: "entrada", amount: total, description: desc, proposal_id: p.id };
      const { error: mvErr } = existing
        ? await supabase.from("cash_movements").update(mvPayload).eq("id", existing.id)
        : await supabase.from("cash_movements").insert(mvPayload);
      if (mvErr) toast.error(`Conta corrente: ${mvErr.message}`);
    } else {
      // Reverte o lançamento automático e a OS gerada se deixou de estar aprovado
      await supabase.from("cash_movements").delete().eq("proposal_id", p.id);
      await supabase.from("service_orders").delete().eq("proposal_id", p.id);
    }

    if (status !== "analise") await supabase.from("proposal_followups").update({ done: true }).eq("proposal_id", p.id);
    else await supabase.from("proposal_followups").update({ done: false }).eq("proposal_id", p.id);
    toast.success(status === "aprovado" ? "Orçamento aprovado — OS/Voucher gerados e lançado na conta corrente" : status === "analise" ? "Em análise — acompanhamento diário criado" : "Orçamento recusado");
    refetch(); refetchFollowups();
    setAction("");
  }



  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader title="Proposta/Orçamento" description="Puxa todos os dados do roteiro, define valor, condições e aprova, coloca em análise ou recusa." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total de propostas em análise</div>
          <div className="text-2xl font-bold">{(props as any[]).filter((x: any) => !finishedIds.has(x.id)).length}</div>
          <div className="text-xs text-muted-foreground mt-1">Já enviadas para aprovação</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vendas fechadas</div>
          <div className="text-2xl font-bold">{(props as any[]).filter((x: any) => finishedIds.has(x.id)).length}</div>
          <div className="text-xs text-muted-foreground mt-1">Aprovadas + Concluídas</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valores das propostas em análise</div>
          <div className="text-2xl font-bold">
            € {(props as any[]).filter((x: any) => !finishedIds.has(x.id)).reduce((s, p) => s + Number(p.total_value || 0), 0).toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Soma dos orçamentos enviados</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total de vendas</div>
          <div className="text-2xl font-bold">
            € {(props as any[]).filter((x: any) => finishedIds.has(x.id)).reduce((s, x) => s + Number(x.total_value || 0), 0).toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Todas as vendas fechadas</div>
        </Card>
      </div>

      {pendingFollowups.length > 0 && (
        <Card className="p-4">
          <div className="font-semibold text-sm mb-2 flex items-center gap-2"><Clock className="h-4 w-4" /> Bilhetes de acompanhamento pendentes</div>
          <div className="space-y-1 text-sm">
            {pendingFollowups.map((f: any) => (
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
        <div className="space-y-1">
          <Label>Proposta</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {selected
                  ? (() => {
                      const x = (props as any[]).find((pr: any) => pr.id === selected);
                      return x ? `${shortCode(x.code)} · ${x.clients?.name ?? "—"}` : "Selecionar proposta";
                    })()
                  : "Selecionar proposta"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command filter={(value, search) => {
                const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
                const v = value.toLowerCase();
                return terms.every((t) => v.includes(t)) ? 1 : 0;
              }}>
                <CommandInput placeholder="Nº da proposta, nº de cliente, nome, email, telefone ou NIF…" />
                <CommandList>
                  <CommandEmpty>Nenhuma proposta encontrada.</CommandEmpty>
                  {(selectableProps as any[]).map((x: any) => (
                    <CommandItem
                      key={x.id}
                      value={`${x.code ?? ""} ${shortCode(x.code)} ${x.title ?? ""} ${x.clients?.client_number ?? ""} ${shortCode(x.clients?.client_number)} ${x.clients?.name ?? ""} ${x.clients?.email ?? ""} ${x.clients?.phone ?? ""} ${x.clients?.nif ?? ""}`}
                      onSelect={() => {
                        if (hasUnsavedChanges && !confirm("Tem alterações não guardadas. Deseja trocar de proposta?")) return;
                        pickProposal(x.id);
                        setOpen(false);
                      }}
                      className={cn("cursor-pointer", selected === x.id && "bg-accent")}
                    >
                      <span className="font-mono text-xs mr-2">{shortCode(x.code)}</span>
                      {x.clients?.name ?? "—"}
                      {x.clients?.client_number ? <span className="text-muted-foreground ml-1">· {shortCode(x.clients.client_number)}</span> : null}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
              <div className="sm:col-span-3">Período: {[fmtDate(p.itinerary_start), fmtDate(p.itinerary_end)].filter(Boolean).join(" → ") || "—"}</div>
              <div className="sm:col-span-3">Chegada: {[fmtDate(p.arrival_date), p.arrival_time, p.arrival_place].filter(Boolean).join(" · ") || "—"}</div>
              <div className="sm:col-span-3">Saída: {[fmtDate(p.departure_date), p.departure_time, p.departure_place].filter(Boolean).join(" · ") || "—"}</div>
              {p.descriptive && <div className="sm:col-span-3 whitespace-pre-wrap">Descritivo: {p.descriptive}</div>}
            </div>

            {itinerary.filter((d) => !d.deleted).length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead className="w-28">Data</TableHead><TableHead>Serviço contratado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {itinerary.filter((d) => !d.deleted).map((d, i) => {
                    const reg = (regions as any[]).find((r) => r.id === (d.region_id || p.region_id));
                    const rt = (routes as any[]).find((r) => r.id === d.tour_route_id);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{fmtDate(d.date)}</TableCell>
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


            <div className="rounded-md border p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label>Valor total (€)</Label><Input type="number" step="0.01" disabled={locked} value={value} onChange={(e) => { setValue(e.target.value); setHasUnsavedChanges(true); }} /></div>
                <div><Label>Forma de Pagamento</Label>
                  <Select value={terms} onValueChange={(v) => { setTerms(v); setHasUnsavedChanges(true); }} disabled={locked}>
                    <SelectTrigger><SelectValue placeholder="Selecionar forma de pagamento" /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-sm font-semibold">Condições de pagamento (personalizáveis)</div>
              {stages.map((s, i) => {
                const patch = (v: Partial<Stage>) => setStages(stages.map((x, j) => (j === i ? { ...x, ...v } : x)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input className="w-20" type="number" min={0} max={100} disabled={locked} value={s.pct} onChange={(e) => patch({ pct: e.target.value })} />
                    <span className="text-sm">%</span>
                    <Input className="flex-1 min-w-40" placeholder="Descrição da etapa" disabled={locked} value={s.label} onChange={(e) => patch({ label: e.target.value })} />
                    <span className="text-sm w-24 text-right">€ {(total * Number(s.pct || 0) / 100).toFixed(2)}</span>
                    {!locked && <Button size="icon" variant="ghost" onClick={() => setStages(stages.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>}
                  </div>
                );
              })}
              {!locked && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStages([...stages, { label: "", pct: 0 }])}>+ Adicionar etapa</Button>
                  <div className="text-xs text-muted-foreground">
                    Total: {stages.reduce((a, s) => a + Number(s.pct || 0), 0)}% · € {stages.reduce((a, s) => a + total * Number(s.pct || 0) / 100, 0).toFixed(2)}
                  </div>
                </div>
              )}
            </div>


            <div className="rounded-md border p-3 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                Estado do orçamento
                <Badge variant={p.budget_status === "aprovado" ? "default" : "outline"}>{p.budget_status ?? "rascunho"}</Badge>
                {p.budget_validated_at && <Badge variant="default">Validado</Badge>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={action === "analise" ? "default" : "outline"}
                  onClick={() => { setAction("analise"); setStatusDate((p.budget_analysis_at ?? new Date().toISOString()).slice(0, 10)); }}
                ><Clock className="h-4 w-4 mr-1" /> Em análise</Button>
                <Button
                  variant={action === "aprovado" ? "default" : "outline"}
                  className={action === "aprovado" ? "gradient-gold text-gold-foreground" : ""}
                  onClick={() => { setAction("aprovado"); setStatusDate((p.budget_approved_at ?? new Date().toISOString()).slice(0, 10)); }}
                ><Check className="h-4 w-4 mr-1" /> Aprovado</Button>
                <Button variant={action === "recusado" ? "default" : "outline"}
                  onClick={() => { setAction("recusado"); setStatusDate((p.budget_refused_at ?? new Date().toISOString()).slice(0, 10)); }}
                ><X className="h-4 w-4 mr-1" /> Recusado</Button>
              </div>

              {action && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div><Label>Data</Label><Input type="date" value={statusDate} onChange={(e) => setStatusDate(e.target.value)} /></div>
                  <div className="sm:col-span-2">
                    <Label>
                      {action === "aprovado" ? "Informações do recebimento" : action === "analise" ? "Informações da análise" : "Informações da recusa"}
                    </Label>
                    <Textarea rows={2}
                      value={action === "aprovado" ? receipt : action === "analise" ? analysisInfo : refusal}
                      onChange={(e) => action === "aprovado" ? setReceipt(e.target.value) : action === "analise" ? setAnalysisInfo(e.target.value) : setRefusal(e.target.value)}
                      placeholder={action === "aprovado" ? "Ex.: 30% recebido por transferência em 10/02" : action === "analise" ? "Ex.: cliente a avaliar datas" : "Motivo indicado pelo cliente"}
                    />
                  </div>
                  <div className="sm:col-span-3 flex flex-wrap gap-2">
                    <Button className="gradient-gold text-gold-foreground" onClick={() => setBudgetStatus(action)}>
                      Confirmar {action === "aprovado" ? "aprovação" : action === "analise" ? "análise" : "recusa"}
                    </Button>
                    <Button variant="ghost" onClick={() => setAction("")}>Cancelar</Button>
                  </div>
                </div>
              )}

              {p.budget_approved_at && <div className="text-xs text-muted-foreground">Aprovado em {new Date(p.budget_approved_at).toLocaleDateString("pt-PT")} · Recebimento: {p.budget_receipt_info ?? "—"}</div>}
              {p.budget_analysis_at && <div className="text-xs text-muted-foreground">Em análise desde {new Date(p.budget_analysis_at).toLocaleDateString("pt-PT")}{p.budget_analysis_info ? ` · ${p.budget_analysis_info}` : ""}</div>}
              {p.budget_refused_at && <div className="text-xs text-muted-foreground">Recusado em {new Date(p.budget_refused_at).toLocaleDateString("pt-PT")} · Motivo: {p.budget_refusal_reason ?? "—"}</div>}
            </div>

            {locked && (
              <div className="rounded-md border border-primary/30 bg-muted/40 p-3 text-sm flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Orçamento validado em {new Date(p.budget_validated_at).toLocaleString("pt-PT")} — edição bloqueada.
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-end">
              {!locked && (
                <Button variant="outline" onClick={async () => { if (await save()) close(); }}>
                  <Save className="h-4 w-4 mr-1" /> Salvar
                </Button>
              )}
              {!locked && p.budget_saved_at && (
                <Button variant="outline" onClick={unsaveBudget}>
                  <X className="h-4 w-4 mr-1" /> Não Salvo
                </Button>
              )}
              {(
                <Button variant="outline" onClick={() => generateBudgetPdf(p.id).catch((e) => toast.error(e.message))}>
                  <FileDown className="h-4 w-4 mr-1" /> Descarregar PDF
                </Button>
              )}
              {locked && isAdmin && (
                <Button variant="outline" onClick={unlockBudget}>
                  <Unlock className="h-4 w-4 mr-1" /> Desbloquear edição
                </Button>
              )}
              {!locked && (
                <Button className="gradient-gold text-gold-foreground" onClick={async () => { if (await save(true) && await validate()) close(); }}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar Venda
                </Button>
              )}
            </div>


          </>
        )}
      </Card>

      <Card className="p-4">
        <div className="font-semibold text-sm">Orçamentos Salvos</div>
        <div className="text-xs text-muted-foreground mb-2">Salvos e ainda não validados — PDF disponível.</div>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Salvo</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {savedBudgets.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{x.budget_saved_at ? new Date(x.budget_saved_at).toLocaleString("pt-PT") : "—"}</TableCell>
                <TableCell className="text-right">€ {Number(x.total_value || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar orçamento" onClick={() => {
                    pickProposal(x.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}><Pencil className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {savedBudgets.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Nenhum orçamento salvo.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
         <div className="font-semibold text-sm mb-2">Vendas Fechadas</div>

        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Data da viagem</TableHead><TableHead>Validado</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {validatedActive.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs leading-tight">
                  <div>Início: {fmtDate(x.itinerary_start) || "—"}</div>
                  <div>Fim: {fmtDate(x.itinerary_end) || "—"}</div>
                </TableCell>
                <TableCell className="text-xs">{new Date(x.budget_validated_at).toLocaleString("pt-PT")}</TableCell>
                <TableCell className="text-right">€ {Number(x.total_value || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Editar orçamento" onClick={() => {
                    pickProposal(x.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="PDF" onClick={() => generateBudgetPdf(x.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}

            {validatedActive.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">Nenhum orçamento validado em atendimento.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4">
         <div className="font-semibold text-sm">Serviços Concluídos</div>
        <div className="text-xs text-muted-foreground mb-2">Orçamentos de serviços já finalizados.</div>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Data da viagem</TableHead><TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {historyProps.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs leading-tight">
                  <div>Início: {fmtDate(x.itinerary_start) || "—"}</div>
                  <div>Fim: {fmtDate(x.itinerary_end) || "—"}</div>
                </TableCell>
                <TableCell className="text-right">€ {Number(x.total_value || 0).toFixed(2)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="PDF" onClick={() => generateBudgetPdf(x.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {historyProps.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">Sem serviços finalizados.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>

      </Card>

      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Orçamento"
        record={viewing}
        fields={[
          { key: "code", label: "Nº", format: (v: any) => shortCode(v) },
          { key: "clients", label: "Cliente", format: (v: any, r: any) => v?.name ?? r?.leads?.name ?? "—" },
          { key: "title", label: "Serviço" },
          { key: "passengers", label: "Nº de pessoas" },
          { key: "itinerary_start", label: "Início da viagem", format: (v: any) => fmtDate(v) || "—" },
          { key: "itinerary_end", label: "Fim da viagem", format: (v: any) => fmtDate(v) || "—" },
          { key: "total_value", label: "Valor total", format: (v: any) => `€ ${Number(v || 0).toFixed(2)}` },
          { key: "budget_status", label: "Estado do orçamento" },
          { key: "budget_saved_at", label: "Salvo em" },
          { key: "budget_validated_at", label: "Validado em" },
          { key: "payment_method", label: "Forma de pagamento" },
          { key: "payment_terms", label: "Condições de pagamento", fullWidth: true },
          { key: "descriptive", label: "Descritivo", fullWidth: true },
        ]}
      />
    </div>

  );
}
