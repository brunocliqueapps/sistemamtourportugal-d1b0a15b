import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { fmtDate } from "@/lib/format-date";
import { generateSettlementPdf, type SettlementLine } from "@/lib/settlement-pdf";
import { ChevronLeft, ChevronRight, FileDown, Lock, Pencil, Plus, Search, Trash2, Unlock } from "lucide-react";

export const Route = createFileRoute("/acerto-carro")({
  component: AcertoCarro,
  head: () => ({
    meta: [
      { title: "Acerto do Carro · Mtour Portugal" },
      { name: "description", content: "Painel financeiro semanal por viatura: entradas, saídas, aluguer, lucro líquido e fechamento do acerto com os motoristas." },
      { property: "og:title", content: "Acerto do Carro · Mtour Portugal" },
      { property: "og:description", content: "Acerto semanal de contas por viatura, de segunda a domingo, com histórico de pagamentos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(12, 0, 0, 0);
  return x;
}
const addDays = (isoDate: string, n: number) => iso(new Date(new Date(isoDate + "T12:00:00").getTime() + n * 86400000));
const eur = (n: number) => `€ ${Number(n || 0).toFixed(2)}`;
/** Deriva um nome legível a partir de um email, quando não há nome de perfil. */
const nameFromEmail = (email: string) =>
  String(email).split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

type LineRow = SettlementLine & { srcTable?: string; srcId?: string; manual?: any };

const INCOME_ORIGINS = [

  "TVDE (Uber/Bolt)",
  "Serviço privado",
  "Roteiro Mtour",
  "Transferência do motorista",
  "Reembolso",
  "Outros",
];

type EntryDraft = {
  kind: string;
  amount: string;
  description: string;
  origin: string;
  cost_center_id: string;
  other_label: string;
  invoice_number: string;
  entry_date: string;
};
const EMPTY_ENTRY: EntryDraft = {
  kind: "entrada", amount: "", description: "",
  origin: "", cost_center_id: "", other_label: "", invoice_number: "", entry_date: "",
};


function AcertoCarro() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();

  const [weekStart, setWeekStart] = useState(iso(mondayOf(new Date())));
  const weekEnd = addDays(weekStart, 6);
  const [search, setSearch] = useState("");
  const [pctDraft, setPctDraft] = useState<Record<string, string>>({});
  const [detailDraft, setDetailDraft] = useState<Record<string, string>>({});
  const [entryFor, setEntryFor] = useState<any | null>(null);
  const [entry, setEntry] = useState<EntryDraft>({ ...EMPTY_ENTRY });
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: costCenters = [] } = useQuery({
    queryKey: ["ac-cost-centers"],
    queryFn: async () =>
      (await supabase.from("cost_centers").select("id,name,active").order("name")).data ?? [],
  });
  const { data: profiles = [] } = useQuery({
    queryKey: ["ac-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id,full_name,email")).data ?? [],
  });
  const authorName = (id: string | null) => {
    if (!id) return "—";
    const d = drivers.find((x: any) => x.user_id === id);
    if (d) return `${d.full_name} (motorista)`;
    const p = profiles.find((x: any) => x.id === id);
    if (p?.full_name) return p.full_name;
    if (p?.email) return nameFromEmail(p.email);
    return "utilizador";
  };


  /** Registo de motorista do utilizador atual (para acesso restrito). */
  const { data: myDriver } = useQuery({
    queryKey: ["my-driver", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("drivers").select("id,full_name").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ["ac-vehicles"],
    queryFn: async () =>
      (await supabase.from("vehicles").select("id,plate,brand,model,usage_type,owner_company,rental_weekly_cost,active").order("plate")).data ?? [],
  });
  const { data: drivers = [] } = useQuery({
    queryKey: ["ac-drivers"],
    queryFn: async () => (await supabase.from("drivers").select("id,full_name,commission_pct,user_id")).data ?? [],
  });
  const { data: vehicleDrivers = [] } = useQuery({
    queryKey: ["ac-vehicle-drivers"],
    queryFn: async () => (await supabase.from("vehicle_drivers").select("vehicle_id,driver_id,is_primary")).data ?? [],
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["ac-shifts", weekStart],
    queryFn: async () =>
      (await supabase.from("tvde_shifts").select("id,vehicle_id,driver_id,shift_date")
        .gte("shift_date", weekStart).lte("shift_date", weekEnd)).data ?? [],
  });
  const shiftIds = shifts.map((s: any) => s.id);

  const { data: earnings = [] } = useQuery({
    queryKey: ["ac-earnings", weekStart, shiftIds.length],
    enabled: shiftIds.length > 0,
    queryFn: async () =>
      (await supabase.from("tvde_earnings").select("*").in("tvde_shift_id", shiftIds)).data ?? [],
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["ac-orders", weekStart],
    queryFn: async () =>
      (await supabase.from("service_orders")
        .select("id,oc_code,vehicle_id,driver_id,service_date,operation_type,sale_value,amount_received,status")
        .gte("service_date", weekStart).lte("service_date", weekEnd)).data ?? [],
  });
  const orderIds = orders.map((o: any) => o.id);

  const { data: expensesRaw = [] } = useQuery({
    queryKey: ["ac-expenses", weekStart, shiftIds.length, orderIds.length],
    queryFn: async () => {
      const byDate = (await supabase.from("service_expenses").select("*")
        .gte("created_at", `${weekStart}T00:00:00`).lte("created_at", `${weekEnd}T23:59:59`)).data ?? [];
      const byShift = shiftIds.length
        ? (await supabase.from("service_expenses").select("*").in("tvde_shift_id", shiftIds)).data ?? [] : [];
      const byOrder = orderIds.length
        ? (await supabase.from("service_expenses").select("*").in("service_order_id", orderIds)).data ?? [] : [];
      const map = new Map<string, any>();
      [...byDate, ...byShift, ...byOrder].forEach((e: any) => map.set(e.id, e));
      return Array.from(map.values());
    },
  });

  const { data: manual = [] } = useQuery({
    queryKey: ["ac-manual", weekStart],
    queryFn: async () =>
      (await supabase.from("car_settlement_entries").select("*").eq("week_start", weekStart).order("created_at")).data ?? [],
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ["ac-settlements", weekStart],
    queryFn: async () =>
      (await supabase.from("car_settlements").select("*").eq("week_start", weekStart)).data ?? [],
  });

  const { data: history = [] } = useQuery({
    queryKey: ["ac-history"],
    queryFn: async () =>
      (await supabase.from("car_settlements").select("*").order("week_start", { ascending: false }).limit(300)).data ?? [],
  });

  const shiftById = useMemo(() => new Map(shifts.map((s: any) => [s.id, s])), [shifts]);
  const orderById = useMemo(() => new Map(orders.map((o: any) => [o.id, o])), [orders]);

  function vehicleOfExpense(e: any): string | null {
    if (e.vehicle_id) return e.vehicle_id;
    if (e.tvde_shift_id) return (shiftById.get(e.tvde_shift_id) as any)?.vehicle_id ?? null;
    if (e.service_order_id) return (orderById.get(e.service_order_id) as any)?.vehicle_id ?? null;
    return null;
  }

  const rows = useMemo(() => {
    return vehicles.map((v: any) => {
      const vShifts = shifts.filter((s: any) => s.vehicle_id === v.id);
      const vShiftIds = new Set(vShifts.map((s: any) => s.id));
      const vEarnings = earnings.filter((e: any) => vShiftIds.has(e.tvde_shift_id));
      const vOrders = orders.filter((o: any) => o.vehicle_id === v.id);
      const vExpenses = expensesRaw.filter((e: any) => vehicleOfExpense(e) === v.id);
      const vManual = manual.filter((m: any) => m.vehicle_id === v.id);

      const incomes: LineRow[] = [];
      for (const e of vEarnings) {
        const net = Number(e.gross || 0) + Number(e.tips || 0) + Number(e.bonus || 0)
          - Number(e.commissions || 0) - Number(e.other_deductions || 0);
        const s: any = shiftById.get(e.tvde_shift_id);
        incomes.push({ label: `TVDE · ${String(e.platform ?? "").toUpperCase()}`, date: s?.shift_date ?? null, detail: "—", amount: net, srcTable: "tvde_earnings", srcId: e.id });
      }
      const incomeTvde = incomes.reduce((a, l) => a + l.amount, 0);

      const serviceLines: LineRow[] = vOrders.map((o: any) => ({
        label: o.operation_type === "privado" ? "Serviço Privado / Roteiro Mtour" : `Serviço · ${o.operation_type ?? "outro"}`,
        date: o.service_date ?? null,
        detail: `${o.oc_code ?? ""}`.trim() || "—",
        amount: Number(o.sale_value || 0),
      }));
      const incomeServices = serviceLines.reduce((a, l) => a + l.amount, 0);

      const manualIn = vManual.filter((m: any) => m.kind === "entrada");
      const manualOut = vManual.filter((m: any) => m.kind === "saida");
      const manualDate = (m: any) => m.entry_date ?? (m.created_at ? String(m.created_at).slice(0, 10) : null);
      const manualDetail = (m: any) => [m.description, m.invoice_number ? `Fatura ${m.invoice_number}` : null, `por ${authorName(m.created_by)}`]
        .filter(Boolean).join(" · ");
      const manualInLines: LineRow[] = manualIn.map((m: any) => ({
        label: m.origin === "Outros" && m.other_label ? `Outros · ${m.other_label}` : (m.origin || "Lançamento manual"),
        date: manualDate(m),
        detail: manualDetail(m) || "—",
        amount: Number(m.amount || 0),
        srcTable: "car_settlement_entries", srcId: m.id, manual: m,
      }));

      const incomeManual = manualInLines.reduce((a, l) => a + l.amount, 0);

      const expenseLines: LineRow[] = vExpenses.map((e: any) => ({
        label: String(e.category ?? "Despesa"),
        date: e.created_at ? String(e.created_at).slice(0, 10) : null,
        detail: e.description ?? "—",
        amount: Number(e.amount || 0),
      }));
      const manualOutLines: LineRow[] = manualOut.map((m: any) => {
        const cc = costCenters.find((c: any) => c.id === m.cost_center_id);
        const label = cc ? cc.name : (m.other_label ? `Outros · ${m.other_label}` : "Saída manual");
        return { label, date: manualDate(m), detail: manualDetail(m) || "—", amount: Number(m.amount || 0), srcTable: "car_settlement_entries", srcId: m.id, manual: m };
      });



      const allIncomes = [...incomes, ...serviceLines, ...manualInLines];
      const allExpenses = [...expenseLines, ...manualOutLines];
      const incomeTotal = incomeTvde + incomeServices + incomeManual;
      const expenseTotal = allExpenses.reduce((a, l) => a + l.amount, 0);
      const isRental = v.usage_type === "aluguel" || v.usage_type === "aluguer";
      const rentalCost = isRental ? Number(v.rental_weekly_cost || 0) : 0;
      const netProfit = incomeTotal - expenseTotal - rentalCost;

      const settlement = settlements.find((s: any) => s.vehicle_id === v.id);
      const primary = vehicleDrivers.find((vd: any) => vd.vehicle_id === v.id && vd.is_primary)
        ?? vehicleDrivers.find((vd: any) => vd.vehicle_id === v.id);
      const driverId = settlement?.driver_id ?? vShifts[0]?.driver_id ?? vOrders[0]?.driver_id ?? primary?.driver_id ?? null;
      const driver = drivers.find((d: any) => d.id === driverId);

      const pctRaw = settlement?.closed_at
        ? settlement?.driver_pct
        : (pctDraft[v.id] !== undefined ? pctDraft[v.id] : (settlement?.driver_pct ?? driver?.commission_pct ?? ""));
      const pct = pctRaw === "" || pctRaw === null || pctRaw === undefined ? null : Number(pctRaw);
      const hasIncome = incomeTotal > 0;
      const companyAmount = !hasIncome ? 0 : pct === null ? 0 : (netProfit > 0 ? netProfit : 0) * (pct / 100);
      const driverAmount = !hasIncome ? 0 : Math.max(netProfit - companyAmount, 0);

      return {
        vehicle: v, driver, driverId, isRental, rentalCost,
        allIncomes, allExpenses, incomeTvde, incomeServices, incomeManual,
        incomeTotal, expenseTotal, netProfit, pct, driverAmount, companyAmount,
        settlement, hasActivity: allIncomes.length > 0 || allExpenses.length > 0,
        details: settlement?.closed_at ? (settlement?.details ?? "") : (detailDraft[v.id] ?? settlement?.details ?? ""),
      };
    });
  }, [vehicles, shifts, earnings, orders, expensesRaw, manual, settlements, drivers, vehicleDrivers, costCenters, profiles, pctDraft, detailDraft]);

  const term = search.trim().toLowerCase();
  const visible = rows
    .filter((r) => isAdmin || (myDriver ? r.driverId === myDriver.id : true))
    .filter((r) => r.hasActivity || !!r.settlement || isAdmin)
    .filter((r) =>
      !term ||
      [r.vehicle.plate, r.vehicle.brand, r.vehicle.model, r.vehicle.owner_company, r.driver?.full_name]
        .some((x) => String(x ?? "").toLowerCase().includes(term)),
    );

  const totals = visible.reduce(
    (a, r) => ({
      inc: a.inc + r.incomeTotal, exp: a.exp + r.expenseTotal,
      rental: a.rental + r.rentalCost, net: a.net + r.netProfit,
      driver: a.driver + r.driverAmount,
    }),
    { inc: 0, exp: 0, rental: 0, net: 0, driver: 0 },
  );

  const closeWeek = useMutation({
    mutationFn: async (r: any) => {
      const payload: any = {
        vehicle_id: r.vehicle.id, driver_id: r.driverId, week_start: weekStart, week_end: weekEnd,
        income_tvde: r.incomeTvde, income_services: r.incomeServices, income_manual: r.incomeManual,
        expenses_total: r.expenseTotal, rental_cost: r.rentalCost, net_profit: r.netProfit,
        driver_pct: r.pct, driver_amount: r.driverAmount, company_amount: r.companyAmount,
        details: r.details || null, closed_at: new Date().toISOString(), closed_by: user!.id,
      };
      const { error } = r.settlement?.id
        ? await supabase.from("car_settlements").update(payload).eq("id", r.settlement.id)
        : await supabase.from("car_settlements").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Semana fechada");
      qc.invalidateQueries({ queryKey: ["ac-settlements"] });
      qc.invalidateQueries({ queryKey: ["ac-history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("car_settlements").update({ closed_at: null, closed_by: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Semana reaberta");
      qc.invalidateQueries({ queryKey: ["ac-settlements"] });
      qc.invalidateQueries({ queryKey: ["ac-history"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addEntry = useMutation({
    mutationFn: async () => {
      if (!Number(entry.amount)) throw new Error("Valor obrigatório.");
      if (entry.kind === "entrada" && !entry.origin) throw new Error("Selecione a origem.");
      if (entry.kind === "saida" && !entry.cost_center_id) throw new Error("Selecione o centro de custo.");
      const isOther = entry.kind === "entrada" ? entry.origin === "Outros" : entry.cost_center_id === "outros";
      if (isOther && !entry.other_label.trim()) throw new Error("Indique qual é o 'Outros'.");
      const payload: any = {
        vehicle_id: entryFor.vehicle.id, week_start: weekStart, kind: entry.kind,
        amount: Number(entry.amount), description: entry.description || null,
        origin: entry.kind === "entrada" ? entry.origin : null,
        cost_center_id: entry.kind === "saida" && entry.cost_center_id !== "outros" ? entry.cost_center_id : null,
        other_label: isOther ? entry.other_label.trim() : null,
        invoice_number: entry.invoice_number.trim() || null,
        entry_date: entry.entry_date || weekStart,
      };
      if (editingId) {
        const { error } = await supabase.from("car_settlement_entries").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("car_settlement_entries").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Lançamento atualizado" : "Lançamento registado");
      setEntryFor(null); setEditingId(null); setEntry({ ...EMPTY_ENTRY });
      qc.invalidateQueries({ queryKey: ["ac-manual"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  const delEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("car_settlement_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento removido"); qc.invalidateQueries({ queryKey: ["ac-manual"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  /** Remove um registo da linha (lançamento manual ou ganho TVDE). */
  const delRow = useMutation({
    mutationFn: async (l: LineRow) => {
      if (!l.srcTable || !l.srcId) throw new Error("Este registo não pode ser removido aqui.");
      const { error } = await supabase.from(l.srcTable as any).delete().eq("id", l.srcId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registo removido");
      qc.invalidateQueries({ queryKey: ["ac-manual"] });
      qc.invalidateQueries({ queryKey: ["ac-earnings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });


  function openEdit(r: any, m: any) {
    setEditingId(m.id);
    setEntry({
      kind: m.kind,
      amount: String(m.amount ?? ""),
      description: m.description ?? "",
      origin: m.origin ?? "",
      cost_center_id: m.cost_center_id ?? (m.kind === "saida" && m.other_label ? "outros" : ""),
      other_label: m.other_label ?? "",
      invoice_number: m.invoice_number ?? "",
      entry_date: m.entry_date ?? String(m.created_at ?? "").slice(0, 10),
    });
    setEntryFor(r);
  }

  function pdf(r: any) {
    generateSettlementPdf({
      weekStart, weekEnd,
      vehicleLabel: `${r.vehicle.plate} ${[r.vehicle.brand, r.vehicle.model].filter(Boolean).join(" ")}`.trim(),
      ownership: r.isRental
        ? `Aluguer${r.vehicle.owner_company ? ` · ${r.vehicle.owner_company}` : ""} (${eur(r.rentalCost)}/semana)`
        : "Próprio da Empresa",
      driverName: r.driver?.full_name ?? "—",
      incomes: r.allIncomes, expenses: r.allExpenses,
      incomeTotal: r.incomeTotal, expenseTotal: r.expenseTotal, rentalCost: r.rentalCost,
      netProfit: r.netProfit, driverPct: r.pct, driverAmount: r.driverAmount, companyAmount: r.companyAmount,
      details: r.details, closedAt: r.settlement?.closed_at ?? null,
    }).catch((e) => toast.error(e.message));
  }

  const myHistory = history.filter((h: any) => isAdmin || (myDriver ? h.driver_id === myDriver.id : false));

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Acerto do Carro"
        description="Painel financeiro semanal por viatura (segunda a domingo): entradas, saídas, aluguer e lucro líquido."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={weekStart} onChange={(e) => e.target.value && setWeekStart(iso(mondayOf(new Date(e.target.value + "T12:00:00"))))} className="w-40" />
            <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <Badge variant="outline">{fmtDate(weekStart)} → {fmtDate(weekEnd)}</Badge>
          </div>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar por matrícula, veículo ou motorista…" className="pl-8" />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Entradas</div><div className="text-lg font-bold text-emerald-600">{eur(totals.inc)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Saídas</div><div className="text-lg font-bold text-destructive">{eur(totals.exp)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Aluguer viaturas</div><div className="text-lg font-bold">{eur(totals.rental)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Lucro líquido</div><div className={`text-lg font-bold ${totals.net < 0 ? "text-destructive" : "text-emerald-600"}`}>{eur(totals.net)}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">A pagar motoristas</div><div className="text-lg font-bold text-gold">{eur(totals.driver)}</div></Card>
      </div>

      <Tabs defaultValue="semana">
        <TabsList>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="historico">Histórico de pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="semana" className="space-y-4 pt-4">
          {visible.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Sem registos nesta semana.</Card>
          )}
          {visible.map((r) => {
            const closed = !!r.settlement?.closed_at;
            
            return (
              <Card key={r.vehicle.id} className="p-4 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">{r.vehicle.plate}</span>
                      <span className="text-sm text-muted-foreground">{[r.vehicle.brand, r.vehicle.model].filter(Boolean).join(" ")}</span>
                      {r.isRental
                        ? <Badge variant="outline">Aluguer{r.vehicle.owner_company ? ` · ${r.vehicle.owner_company}` : ""}</Badge>
                        : <Badge className="bg-primary text-primary-foreground">Próprio da Empresa</Badge>}
                      {closed && <Badge className="bg-emerald-600 text-white">Semana fechada</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">Motorista: {r.driver?.full_name ?? "—"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => pdf(r)}><FileDown className="h-4 w-4 mr-1" /> Resumo PDF</Button>
                    {isAdmin && !closed && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditingId(null); const t = iso(new Date()); setEntry({ ...EMPTY_ENTRY, entry_date: t >= weekStart && t <= weekEnd ? t : weekStart }); setEntryFor(r); }}><Plus className="h-4 w-4 mr-1" /> Lançamento</Button>
                        <Button size="sm" className="gradient-gold text-gold-foreground" disabled={closeWeek.isPending} onClick={() => closeWeek.mutate(r)}>
                          <Lock className="h-4 w-4 mr-1" /> Fechar semana
                        </Button>
                      </>
                    )}
                    {isAdmin && closed && (
                      <Button size="sm" variant="outline" onClick={() => reopen.mutate((r.settlement as any).id)}><Unlock className="h-4 w-4 mr-1" /> Reabrir</Button>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Entradas</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Origem</TableHead><TableHead>Detalhe</TableHead><TableHead className="text-right">Valor</TableHead>{isAdmin && <TableHead className="w-16" />}</TableRow></TableHeader>
                      <TableBody>
                        {(r.allIncomes as LineRow[]).map((l, i) => (
                          <TableRow key={i}><TableCell className="whitespace-nowrap">{l.date ? fmtDate(l.date) : "—"}</TableCell><TableCell>{l.label}</TableCell><TableCell className="text-muted-foreground">{l.detail}</TableCell><TableCell className="text-right">{eur(l.amount)}</TableCell>
                            {isAdmin && <TableCell className="text-right whitespace-nowrap">
                              {l.manual && !closed && <button className="text-primary mr-2" title="Editar" onClick={() => openEdit(r, l.manual)}><Pencil className="h-3.5 w-3.5" /></button>}
                              {l.srcId && !closed && <button className="text-destructive" title="Eliminar" onClick={() => { if (confirm("Eliminar este registo?")) delRow.mutate(l); }}><Trash2 className="h-3.5 w-3.5" /></button>}
                            </TableCell>}
                          </TableRow>
                        ))}
                        {r.allIncomes.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sem entradas.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Saídas</div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Custo</TableHead><TableHead>Detalhe</TableHead><TableHead className="text-right">Valor</TableHead>{isAdmin && <TableHead className="w-16" />}</TableRow></TableHeader>
                      <TableBody>
                        {(r.allExpenses as LineRow[]).map((l, i) => (
                          <TableRow key={i}><TableCell className="whitespace-nowrap">{l.date ? fmtDate(l.date) : "—"}</TableCell><TableCell>{l.label}</TableCell><TableCell className="text-muted-foreground">{l.detail}</TableCell><TableCell className="text-right">{eur(l.amount)}</TableCell>
                            {isAdmin && <TableCell className="text-right whitespace-nowrap">
                              {l.manual && !closed && <button className="text-primary mr-2" title="Editar" onClick={() => openEdit(r, l.manual)}><Pencil className="h-3.5 w-3.5" /></button>}
                              {l.srcId && !closed && <button className="text-destructive" title="Eliminar" onClick={() => { if (confirm("Eliminar este registo?")) delRow.mutate(l); }}><Trash2 className="h-3.5 w-3.5" /></button>}
                            </TableCell>}
                          </TableRow>
                        ))}
                        {r.allExpenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sem saídas.</TableCell></TableRow>}

                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t pt-3">
                  <div><div className="text-xs text-muted-foreground">Total entradas</div><div className="font-semibold text-emerald-600">{eur(r.incomeTotal)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Total saídas</div><div className="font-semibold text-destructive">{eur(r.expenseTotal)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Aluguer</div><div className="font-semibold">{r.rentalCost > 0 ? `− ${eur(r.rentalCost)}` : "—"}</div></div>
                  <div><div className="text-xs text-muted-foreground">Lucro líquido</div><div className={`font-bold ${r.netProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>{eur(r.netProfit)}</div></div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 items-end">
                  <div>
                    <Label>% da empresa (opcional)</Label>
                    <Input type="number" step="0.01" disabled={!isAdmin || closed}
                      value={r.pct ?? ""}
                      onChange={(e) => setPctDraft({ ...pctDraft, [r.vehicle.id]: e.target.value })} />
                  </div>
                  <div><div className="text-xs text-muted-foreground">A pagar ao motorista</div><div className="font-bold">{eur(r.driverAmount)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Crédito a empresa</div><div className="font-bold text-gold">{r.pct === null ? "—" : eur(r.companyAmount)}</div></div>
                </div>

                <div>
                  <Label>Detalhes</Label>
                  <textarea className="w-full min-h-20 rounded-md border border-input bg-background p-2 text-sm"
                    disabled={!isAdmin || closed}
                    value={r.details}
                    onChange={(e) => setDetailDraft({ ...detailDraft, [r.vehicle.id]: e.target.value })} />
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="historico" className="pt-4">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Semana</TableHead><TableHead>Viatura</TableHead><TableHead>Motorista</TableHead>
                <TableHead className="text-right">Entradas</TableHead><TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Aluguer</TableHead><TableHead className="text-right">Líquido</TableHead>
                <TableHead className="text-right">Motorista</TableHead><TableHead className="text-right">Empresa</TableHead>
                <TableHead>Estado</TableHead><TableHead>Detalhes</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {myHistory.map((h: any) => {
                  const v = vehicles.find((x: any) => x.id === h.vehicle_id);
                  const d = drivers.find((x: any) => x.id === h.driver_id);
                  return (
                    <TableRow key={h.id}>
                      <TableCell className="whitespace-nowrap">{fmtDate(h.week_start)} → {fmtDate(h.week_end)}</TableCell>
                      <TableCell>{v?.plate ?? "—"}</TableCell>
                      <TableCell>{d?.full_name ?? "—"}</TableCell>
                      <TableCell className="text-right">{eur(Number(h.income_tvde) + Number(h.income_services) + Number(h.income_manual))}</TableCell>
                      <TableCell className="text-right">{eur(h.expenses_total)}</TableCell>
                      <TableCell className="text-right">{eur(h.rental_cost)}</TableCell>
                      <TableCell className="text-right font-medium">{eur(h.net_profit)}</TableCell>
                      <TableCell className="text-right">{eur(h.driver_amount)}</TableCell>
                      <TableCell className="text-right">{h.driver_pct === null ? "—" : eur(h.company_amount)}</TableCell>
                      <TableCell>{h.closed_at ? <Badge className="bg-emerald-600 text-white">Fechada</Badge> : <Badge variant="outline">Em curso</Badge>}</TableCell>
                      <TableCell className="max-w-xs text-sm text-muted-foreground">{h.details ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {myHistory.length === 0 && <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Sem acertos registados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!entryFor} onOpenChange={(o) => { if (!o) { setEntryFor(null); setEditingId(null); setEntry({ ...EMPTY_ENTRY }); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar lançamento" : "Lançamento manual"} · {entryFor?.vehicle?.plate}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={entry.kind} onValueChange={(v) => setEntry({ ...entry, kind: v, origin: "", cost_center_id: "", other_label: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada (ganho)</SelectItem>
                  <SelectItem value="saida">Saída (custo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {entry.kind === "entrada" ? (
              <div>
                <Label>Origem</Label>
                <Select value={entry.origin} onValueChange={(v) => setEntry({ ...entry, origin: v, other_label: "" })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar origem" /></SelectTrigger>
                  <SelectContent>
                    {INCOME_ORIGINS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Centro de custo</Label>
                <Select value={entry.cost_center_id} onValueChange={(v) => setEntry({ ...entry, cost_center_id: v, other_label: "" })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar centro de custo" /></SelectTrigger>
                  <SelectContent>
                    {costCenters.filter((c: any) => c.active !== false).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {((entry.kind === "entrada" && entry.origin === "Outros") || (entry.kind === "saida" && entry.cost_center_id === "outros")) && (
              <div><Label>Qual? (Outros)</Label><Input value={entry.other_label} onChange={(e) => setEntry({ ...entry, other_label: e.target.value })} /></div>
            )}

            <div>
              <Label>Data da operação</Label>
              <Input type="date" min={weekStart} max={weekEnd} value={entry.entry_date} onChange={(e) => setEntry({ ...entry, entry_date: e.target.value })} />
            </div>
            <div><Label>Valor (€)</Label><Input type="number" step="0.01" value={entry.amount} onChange={(e) => setEntry({ ...entry, amount: e.target.value })} /></div>
            <div><Label>N.º da fatura (opcional)</Label><Input value={entry.invoice_number} onChange={(e) => setEntry({ ...entry, invoice_number: e.target.value })} placeholder="Só se existir fatura" /></div>
            <div><Label>Descrição</Label><Input value={entry.description} onChange={(e) => setEntry({ ...entry, description: e.target.value })} /></div>
            <div className="text-xs text-muted-foreground">Registado por: {authorName(user?.id ?? null)}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEntryFor(null); setEditingId(null); setEntry({ ...EMPTY_ENTRY }); }}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" disabled={addEntry.isPending} onClick={() => addEntry.mutate()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
