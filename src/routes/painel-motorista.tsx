import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { fmtDate } from "@/lib/format-date";
import { TRIP_PROPOSAL_COLS, tripRange } from "@/lib/trip-dates";
import { generateSettlementPdf, type SettlementLine } from "@/lib/settlement-pdf";
import { Car, ChevronLeft, ChevronRight, Clock, FileDown, MapPin, Pencil, Plus, Ticket, Trash2, Users, Wallet, X } from "lucide-react";

export const Route = createFileRoute("/painel-motorista")({
  component: PainelMotorista,
  head: () => ({
    meta: [
      { title: "Painel do Motorista · Mtour Portugal" },
      { name: "description", content: "Resumo diário do motorista: roteiro do dia, vouchers e acerto do carro da semana." },
      { property: "og:title", content: "Painel do Motorista · Mtour Portugal" },
      { property: "og:description", content: "O que o motorista trabalha hoje: TVDE, serviço privado ou roteiro personalizado Mtour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const iso = (d: Date) => d.toISOString().slice(0, 10);
const eur = (n: number) => `€ ${Number(n || 0).toFixed(2)}`;
function mondayOf(d: Date) {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(12, 0, 0, 0);
  return x;
}
const addDays = (isoDate: string, n: number) =>
  iso(new Date(new Date(isoDate + "T12:00:00").getTime() + n * 86400000));

type Kind = "tvde" | "privado" | "roteiro";
const KINDS: { key: Kind; label: string }[] = [
  { key: "tvde", label: "TVDE" },
  { key: "privado", label: "Serviço privado" },
  { key: "roteiro", label: "Roteiro Personalizado Mtour" },
];

const SERVICE_TYPES: { value: string; label: string }[] = [
  { value: "tvde", label: "TVDE" },
  { value: "privado", label: "Serviço privado" },
  { value: "interno", label: "Roteiro Personalizado Mtour" },
];

/** Origens de entrada — iguais às do Acerto do Carro, para padronizar. */
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



function PainelMotorista() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const today = iso(new Date());
  /** Dia em consulta: permite ver, editar ou apagar lançamentos de datas anteriores. */
  const [dayDate, setDayDate] = useState(today);
  const weekStart = useMemo(() => iso(mondayOf(new Date(dayDate + "T12:00:00"))), [dayDate]);
  const weekEnd = addDays(weekStart, 6);
  const [kind, setKind] = useState<Kind | null>(null);
  const [pickedDriver, setPickedDriver] = useState<string>("");

  const { data: allDrivers = [] } = useQuery({
    queryKey: ["pm-drivers"],
    enabled: isAdmin,
    queryFn: async () =>
      (await supabase.from("drivers").select("id,full_name,active").order("full_name")).data ?? [],
  });

  const { data: myDriverRow } = useQuery({
    queryKey: ["pm-driver", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("drivers").select("id,full_name").eq("user_id", user!.id).maybeSingle()).data,
  });

  const myDriver: any = useMemo(() => {
    if (isAdmin && pickedDriver) return (allDrivers as any[]).find((d) => d.id === pickedDriver) ?? null;
    return myDriverRow ?? null;
  }, [isAdmin, pickedDriver, allDrivers, myDriverRow]);

  const viewingOther = isAdmin && !!pickedDriver && pickedDriver !== myDriverRow?.id;

  const { data: allVehicles = [] } = useQuery({
    queryKey: ["pm-vehicles"],
    queryFn: async () =>
      (await supabase.from("vehicles").select("id,plate,brand,model,active").order("plate")).data ?? [],
  });

  // Veículos atribuídos ao motorista (o veículo está sempre associado ao motorista)
  const { data: myVehicleLinks = [] } = useQuery({
    queryKey: ["pm-vehicle-links", myDriver?.id],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await supabase
        .from("vehicle_drivers")
        .select("vehicle_id,is_primary")
        .eq("driver_id", myDriver!.id)).data ?? [],
  });

  const vehicles = useMemo(() => {
    const ids = new Set((myVehicleLinks as any[]).map((l) => l.vehicle_id));
    return (allVehicles as any[]).filter((v) => ids.has(v.id));
  }, [allVehicles, myVehicleLinks]);


  const { data: services = [] } = useQuery({
    queryKey: ["pm-services", myDriver?.id, dayDate],
    enabled: !!myDriver?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("service_orders") as any)
        .select(`*, clients(name,phone), vehicles(plate,brand,model), proposals(${TRIP_PROPOSAL_COLS})`)
        .eq("driver_id", myDriver!.id)
        .order("start_time", { ascending: true });
      return (data ?? []).filter((s: any) => {
        const { start, end } = tripRange(s);
        if (!start) return false;
        return start <= dayDate && dayDate <= (end || start);
      });
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["pm-shifts", myDriver?.id, dayDate],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await (supabase.from("tvde_shifts") as any)
        .select("*, vehicles(plate,brand,model)")
        .eq("driver_id", myDriver!.id)
        .eq("shift_date", dayDate)
        .order("start_time", { ascending: true })).data ?? [],
  });

  const { data: weekShifts = [] } = useQuery({
    queryKey: ["pm-week-shifts", myDriver?.id, weekStart],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await (supabase.from("tvde_shifts") as any)
        .select("*, vehicles(plate,brand,model)")
        .eq("driver_id", myDriver!.id)
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("shift_date", { ascending: false })).data ?? [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["pm-entries", myDriver?.id, weekStart],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await (supabase.from("car_settlement_entries") as any)
        .select("*")
        .eq("week_start", weekStart)
        .order("created_at")).data ?? [],
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["pm-cost-centers"],
    queryFn: async () =>
      (await supabase.from("cost_centers").select("id,name,active").order("name")).data ?? [],
  });


  /* ---------- Lançamento do dia ---------- */
  const openShift: any = useMemo(() => (shifts as any[]).find((s) => !s.closed_at) ?? null, [shifts]);
  const [editShiftId, setEditShiftId] = useState<string | null>(null);
  const editingShift: any = useMemo(
    () => (editShiftId ? (weekShifts as any[]).find((s) => s.id === editShiftId) ?? null : null),
    [editShiftId, weekShifts],
  );
  /** Turno em edição: o escolhido no histórico ou o turno aberto de hoje. */
  const targetShift: any = editingShift ?? openShift;
  const [dayForm, setDayForm] = useState({ vehicle_id: "", operation_type: "tvde", km_initial: "", km_final: "", notes: "" });

  // Veículo sugerido: o principal atribuído ao motorista, ou o único que tiver
  const defaultVehicleId = useMemo(() => {
    const primary = (myVehicleLinks as any[]).find((l) => l.is_primary);
    if (primary && (vehicles as any[]).some((v) => v.id === primary.vehicle_id)) return primary.vehicle_id;
    return (vehicles as any[]).length ? (vehicles as any[])[0].id : "";
  }, [myVehicleLinks, vehicles]);

  useEffect(() => {
    if (targetShift) {
      setDayForm({
        vehicle_id: targetShift.vehicle_id ?? "",
        operation_type: targetShift.operation_type ?? "tvde",
        km_initial: targetShift.km_initial != null ? String(targetShift.km_initial) : "",
        km_final: targetShift.km_final != null ? String(targetShift.km_final) : "",
        notes: targetShift.notes ?? "",
      });
    } else {
      setDayForm({ vehicle_id: defaultVehicleId, operation_type: "tvde", km_initial: "", km_final: "", notes: "" });
    }
  }, [targetShift?.id, defaultVehicleId]);

  const num = (v: string) => (v === "" ? null : Number(v));
  const canStartDay = !!dayForm.vehicle_id && !!dayForm.operation_type && dayForm.km_initial !== "";



  const startDay = useMutation({
    mutationFn: async () => {
      if (!myDriver?.id) throw new Error("Sem registo de motorista");
      if (openShift) throw new Error("Feche o serviço anterior (KM final) antes de iniciar outro");
      if (!dayForm.vehicle_id) throw new Error("Escolha o veículo");
      if (dayForm.km_initial === "") throw new Error("Indique o KM inicial");
      const { error } = await (supabase.from("tvde_shifts") as any).insert({
        driver_id: myDriver.id,
        vehicle_id: dayForm.vehicle_id,
        operation_type: dayForm.operation_type,
        shift_date: dayDate,
        start_time: new Date().toISOString(),
        km_initial: num(dayForm.km_initial),
        notes: dayForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço iniciado");
      qc.invalidateQueries({ queryKey: ["pm-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-week-shifts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível iniciar o serviço"),
  });

  const saveDay = useMutation({
    mutationFn: async (close: boolean) => {
      if (!targetShift) throw new Error("Não há lançamento selecionado");
      if (close && dayForm.km_final === "") throw new Error("Indique o KM final para encerrar o serviço");
      const payload: any = {
        vehicle_id: dayForm.vehicle_id || null,
        operation_type: dayForm.operation_type,
        km_initial: num(dayForm.km_initial),
        km_final: num(dayForm.km_final),
        notes: dayForm.notes || null,
      };
      if (close) {
        payload.end_time = new Date().toISOString();
        payload.closed_at = new Date().toISOString();
        payload.closed_by = user!.id;
      }
      const { error } = await (supabase.from("tvde_shifts") as any).update(payload).eq("id", targetShift.id);
      if (error) throw error;
      return close;
    },
    onSuccess: (close) => {
      toast.success(close ? "Serviço encerrado" : "Lançamento guardado");
      setEditShiftId(null);
      qc.invalidateQueries({ queryKey: ["pm-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-week-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-entries"] });

    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível guardar"),
  });

  /* ---------- Entradas e saídas da semana (mesmo formulário do Acerto do Carro) ---------- */
  const movVehicleId = useMemo(
    () => defaultVehicleId || openShift?.vehicle_id || (shifts as any[])[0]?.vehicle_id || "",
    [defaultVehicleId, openShift?.vehicle_id, shifts],
  );
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState<EntryDraft>({ ...EMPTY_ENTRY });
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  function openNewEntry() {
    setEditingEntryId(null);
    setEntry({ ...EMPTY_ENTRY, entry_date: today >= weekStart && today <= weekEnd ? today : weekStart });
    setEntryOpen(true);
  }
  function openEditEntry(m: any) {
    setEditingEntryId(m.id);
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
    setEntryOpen(true);
  }




  const addMov = useMutation({
    mutationFn: async () => {
      if (!movVehicleId) throw new Error("Nenhum veículo associado a este motorista");
      if (!Number(entry.amount)) throw new Error("Valor obrigatório.");
      if (entry.kind === "entrada" && !entry.origin) throw new Error("Selecione a origem.");
      if (entry.kind === "saida" && !entry.cost_center_id) throw new Error("Selecione o centro de custo.");
      const isOther = entry.kind === "entrada" ? entry.origin === "Outros" : entry.cost_center_id === "outros";
      if (isOther && !entry.other_label.trim()) throw new Error("Indique qual é o 'Outros'.");
      const entryDate = entry.entry_date || weekStart;
      if (entryDate < weekStart || entryDate > weekEnd) throw new Error("A data tem de estar dentro da semana");
      const payload: any = {
        vehicle_id: movVehicleId,
        week_start: weekStart,
        kind: entry.kind,
        amount: Number(entry.amount),
        description: entry.description || null,
        origin: entry.kind === "entrada" ? entry.origin : null,
        cost_center_id: entry.kind === "saida" && entry.cost_center_id !== "outros" ? entry.cost_center_id : null,
        other_label: isOther ? entry.other_label.trim() : null,
        invoice_number: entry.invoice_number.trim() || null,
        entry_date: entryDate,
      };
      if (editingEntryId) {
        const { error } = await (supabase.from("car_settlement_entries") as any).update(payload).eq("id", editingEntryId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("car_settlement_entries") as any).insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingEntryId ? "Lançamento atualizado" : "Lançamento registado");
      setEntryOpen(false); setEditingEntryId(null); setEntry({ ...EMPTY_ENTRY });
      qc.invalidateQueries({ queryKey: ["pm-entries"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível registar"),
  });

  const delMov = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("car_settlement_entries") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lançamento removido"); qc.invalidateQueries({ queryKey: ["pm-entries"] }); },
    onError: () => toast.error("Só pode remover os seus próprios lançamentos"),
  });

  /** Apagar um serviço registado (o próprio motorista ou o admin). */
  const delShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("tvde_shifts") as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Serviço removido");
      setEditShiftId(null);
      qc.invalidateQueries({ queryKey: ["pm-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-week-shifts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível remover"),
  });

  const privados = useMemo(
    () => (services as any[]).filter((s) => s.operation_type === "privado" && !s.proposal_id),
    [services],
  );
  const roteiros = useMemo(() => (services as any[]).filter((s) => !!s.proposal_id), [services]);

  const counts: Record<Kind, number> = {
    tvde: shifts.length,
    privado: privados.length,
    roteiro: roteiros.length,
  };

  const myVehicleIds = useMemo(
    () => new Set([
      ...(shifts as any[]).map((s) => s.vehicle_id),
      ...(services as any[]).map((s) => s.vehicle_id),
    ].filter(Boolean)),
    [shifts, services],
  );
  const myEntries = useMemo(
    () => (entries as any[]).filter((e) => myVehicleIds.size === 0 || myVehicleIds.has(e.vehicle_id)),
    [entries, myVehicleIds],
  );

  const week = myEntries.reduce(
    (acc, e) => {
      if (e.kind === "entrada") acc.in += Number(e.amount || 0);
      else acc.out += Number(e.amount || 0);
      return acc;
    },
    { in: 0, out: 0 },
  );

  const list = kind === "privado" ? privados : kind === "roteiro" ? roteiros : [];
  const vehicleLabel = (id: string) => {
    const v = (allVehicles as any[]).find((x) => x.id === id);
    return v ? `${v.plate}${v.brand ? ` · ${v.brand} ${v.model ?? ""}` : ""}` : "—";
  };

  /** Resumo PDF da semana do motorista (entradas/saídas registadas). */
  function weekPdf() {
    const line = (e: any): SettlementLine => {
      const cc = (costCenters as any[]).find((c) => c.id === e.cost_center_id);
      const label = e.kind === "entrada"
        ? (e.origin === "Outros" && e.other_label ? `Outros · ${e.other_label}` : (e.origin || "Lançamento manual"))
        : (cc?.name ?? (e.other_label ? `Outros · ${e.other_label}` : "Saída manual"));
      return {
        label,
        date: e.entry_date ?? String(e.created_at ?? "").slice(0, 10),
        detail: [e.description, e.invoice_number ? `Fatura ${e.invoice_number}` : null].filter(Boolean).join(" · ") || "—",
        amount: Number(e.amount || 0),
      };
    };
    const incomes = myEntries.filter((e: any) => e.kind === "entrada").map(line);
    const expenses = myEntries.filter((e: any) => e.kind === "saida").map(line);
    const kmDetail = (weekShifts as any[])
      .map((s) => `${fmtDate(s.shift_date)}: KM ${s.km_initial ?? "—"} → ${s.km_final ?? "—"}`)
      .join("\n");
    generateSettlementPdf({
      weekStart, weekEnd,
      vehicleLabel: movVehicleId ? vehicleLabel(movVehicleId) : "—",
      ownership: "Registos do motorista",
      driverName: myDriver?.full_name ?? "—",
      incomes, expenses,
      incomeTotal: week.in, expenseTotal: week.out, rentalCost: 0,
      netProfit: week.in - week.out,
      driverPct: null, driverAmount: week.in - week.out, companyAmount: 0,
      details: kmDetail || null, closedAt: null,
    }).catch((e) => toast.error(e.message));
  }


  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title={`Olá${myDriver?.full_name ? `, ${myDriver.full_name}` : ""}`}
        description={`O seu dia de trabalho · ${fmtDate(dayDate)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="icon" variant="outline" title="Dia anterior" onClick={() => setDayDate(addDays(dayDate, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Input type="date" value={dayDate} onChange={(e) => e.target.value && setDayDate(e.target.value)} className="w-40" />
            <Button size="icon" variant="outline" title="Dia seguinte" onClick={() => setDayDate(addDays(dayDate, 1))}><ChevronRight className="h-4 w-4" /></Button>
            {dayDate !== today && <Button size="sm" variant="ghost" onClick={() => setDayDate(today)}>Hoje</Button>}
            {isAdmin && (
              <div className="w-full sm:w-64">
                <Select value={pickedDriver} onValueChange={setPickedDriver}>
                  <SelectTrigger><SelectValue placeholder="Ver painel de um motorista…" /></SelectTrigger>
                  <SelectContent>
                    {(allDrivers as any[]).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        }
      />


      {viewingOther && (
        <Card className="p-3 text-xs text-muted-foreground">
          Está a ver o painel de <span className="font-medium text-foreground">{myDriver?.full_name}</span> como administrador.
        </Card>
      )}

      {!myDriver && (
        <Card className="p-6 text-sm text-muted-foreground">
          {isAdmin
            ? "Escolha um motorista acima para ver o painel dele."
            : "O seu utilizador ainda não está ligado a um registo de motorista. Fale com um administrador."}
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {KINDS.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(kind === k.key ? null : k.key)}
            className={`text-left rounded-lg border p-4 transition-colors ${
              kind === k.key ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
            }`}
          >
            <div className="text-sm font-medium">{k.label}</div>
            <div className="mt-1 text-2xl font-bold">{counts[k.key]}</div>
            <div className="text-xs text-muted-foreground">hoje</div>
          </button>
        ))}
      </div>

      {/* Lançamento do dia */}
      {myDriver && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" /> {editingShift ? `Editar serviço · ${fmtDate(editingShift.shift_date)}` : "Lançamento do dia"}
            </div>
            <div className="flex items-center gap-2">
              {editingShift && (
                <Button size="sm" variant="ghost" onClick={() => setEditShiftId(null)}>
                  <X className="h-4 w-4 mr-1" /> Cancelar edição
                </Button>
              )}
              <Badge variant="outline">{targetShift ? (targetShift.closed_at ? "encerrado" : "em curso") : (shifts as any[]).length ? `${(shifts as any[]).length} serviço(s) neste dia` : "não iniciado"}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Veículo</Label>
              <div className="h-10 flex items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-mono">
                {dayForm.vehicle_id ? vehicleLabel(dayForm.vehicle_id) : "Sem veículo atribuído"}
              </div>
              {!defaultVehicleId && (
                <p className="text-xs text-muted-foreground">Nenhum veículo associado a este motorista. Peça ao administrador para associar em Cadastros → Veículos.</p>
              )}
            </div>


            <div className="space-y-1">
              <Label>Tipo de serviço</Label>
              <Select value={dayForm.operation_type} onValueChange={(v) => setDayForm({ ...dayForm, operation_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>KM inicial</Label>
              <Input type="number" value={dayForm.km_initial} onChange={(e) => setDayForm({ ...dayForm, km_initial: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>KM final</Label>
              <Input type="number" value={dayForm.km_final} onChange={(e) => setDayForm({ ...dayForm, km_final: e.target.value })} disabled={!targetShift} />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <Label>Notas do dia</Label>
              <Input value={dayForm.notes} onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })} placeholder="Ocorrências, observações…" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!targetShift ? (
              <>
                <Button
                  onClick={() => startDay.mutate()}
                  disabled={startDay.isPending || !canStartDay}
                >
                  Iniciar serviço
                </Button>
                {!canStartDay && (
                  <span className="text-xs text-muted-foreground">
                    Preencha tipo de serviço e KM inicial.
                  </span>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => saveDay.mutate(false)} disabled={saveDay.isPending}>
                  Guardar lançamento
                </Button>
                {!targetShift.closed_at && (
                  <>
                    <Button
                      onClick={() => saveDay.mutate(true)}
                      disabled={saveDay.isPending || dayForm.km_final === ""}
                    >
                      Encerrar serviço com KM final
                    </Button>
                    {dayForm.km_final === "" && (
                      <span className="text-xs text-muted-foreground">Indique o KM final para encerrar e poder iniciar outro serviço.</span>
                    )}
                  </>
                )}
              </>
            )}
          </div>

          {/* Histórico da semana */}
          <div className="space-y-2 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Histórico da semana</div>
              <Badge variant="outline">{fmtDate(weekStart)} → {fmtDate(weekEnd)}</Badge>
            </div>
            {(weekShifts as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem lançamentos nesta semana.</p>
            ) : (
              (weekShifts as any[]).map((s) => {
                const km = s.km_initial != null && s.km_final != null ? Number(s.km_final) - Number(s.km_initial) : null;
                return (
                  <div key={s.id} className="rounded-md border border-border p-3 text-sm flex flex-wrap items-center gap-3">
                    <span className="font-medium">{fmtDate(s.shift_date)}</span>
                    <span className="font-mono">{s.vehicles?.plate ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {SERVICE_TYPES.find((t) => t.value === s.operation_type)?.label ?? s.operation_type ?? "—"}
                    </span>
                    <span className="text-muted-foreground">KM {s.km_initial ?? "—"} → {s.km_final ?? "—"}</span>
                    {km != null && <span className="text-muted-foreground">({km} km)</span>}
                    <Badge variant="outline">{s.closed_at ? "encerrado" : "em curso"}</Badge>
                    <div className="ml-auto flex items-center">
                      <Button size="icon" variant="ghost" title="Ver / editar este serviço" onClick={() => { setDayDate(s.shift_date); setEditShiftId(s.id); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Eliminar este serviço" onClick={() => { if (confirm("Eliminar este serviço registado?")) delShift.mutate(s.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                  </div>
                );
              })
            )}
          </div>


        </Card>
      )}

      {kind === "tvde" && (
        <Card className="p-4 sm:p-6 space-y-3">
          <div className="font-semibold flex items-center gap-2"><Car className="h-4 w-4" /> Turnos de hoje</div>
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem turno registado para hoje.</p>
          ) : (
            (shifts as any[]).map((s) => (
              <div key={s.id} className="rounded-md border border-border p-3 text-sm flex flex-wrap gap-3">
                <span className="font-mono">{s.vehicles?.plate ?? "—"}</span>
                <span className="text-muted-foreground">KM inicial: {s.km_initial ?? "—"}</span>
                <span className="text-muted-foreground">KM final: {s.km_final ?? "—"}</span>
                <Badge variant="outline">{s.closed_at ? "fechado" : "aberto"}</Badge>
              </div>
            ))
          )}
        </Card>
      )}

      {(kind === "privado" || kind === "roteiro") && (
        <Card className="p-4 sm:p-6 space-y-3">
          <div className="font-semibold">{kind === "privado" ? "Serviços privados de hoje" : "Roteiros personalizados de hoje"}</div>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada agendado para hoje.</p>
          ) : (
            list.map((s: any) => (
              <div key={s.id} className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.clients?.name ?? "—"}</span>
                  <Badge variant="outline">{s.status}</Badge>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  {s.start_time && <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{String(s.start_time).slice(0, 5)}</span>}
                  {(s.origin || s.destination) && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.origin ?? "—"} → {s.destination ?? "—"}</span>
                  )}
                  {s.passengers != null && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.passengers} pax</span>}
                  {s.vehicles?.plate && <span className="flex items-center gap-1"><Car className="h-3.5 w-3.5" />{s.vehicles.plate}</span>}
                  {s.voucher_code && <span className="flex items-center gap-1"><Ticket className="h-3.5 w-3.5" />{s.voucher_code}</span>}
                </div>
                {s.notes && <div className="text-xs text-muted-foreground">{s.notes}</div>}
              </div>
            ))
          )}
        </Card>
      )}

      {/* Entradas e saídas da semana */}
      {myDriver && (
        <Card className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Entradas e saídas da semana</div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{fmtDate(weekStart)} → {fmtDate(weekEnd)}</Badge>
              <Button size="sm" variant="outline" onClick={weekPdf}><FileDown className="h-4 w-4 mr-1" /> Resumo PDF</Button>
              <Button size="sm" className="gradient-gold text-gold-foreground" onClick={openNewEntry}>
                <Plus className="h-4 w-4 mr-1" /> Lançamento
              </Button>
            </div>

          </div>

          <div className="text-xs text-muted-foreground">
            Veículo: <span className="font-mono">{movVehicleId ? vehicleLabel(movVehicleId) : "sem veículo atribuído"}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Entradas</div>
              <div className="text-lg font-bold text-emerald-600">{eur(week.in)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Saídas</div>
              <div className="text-lg font-bold text-destructive">{eur(week.out)}</div>
            </div>
          </div>

          <div className="space-y-2">
            {myEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem lançamentos nesta semana.</p>
            ) : (
              myEntries.map((e: any) => {
                const cc = (costCenters as any[]).find((c) => c.id === e.cost_center_id);
                const label = e.kind === "entrada"
                  ? (e.origin === "Outros" && e.other_label ? `Outros · ${e.other_label}` : (e.origin || "Lançamento manual"))
                  : (cc?.name ?? (e.other_label ? `Outros · ${e.other_label}` : "Saída manual"));
                const mine = e.created_by === user?.id || isAdmin;
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                    <Badge variant="outline">{e.kind === "entrada" ? "Entrada" : "Saída"}</Badge>
                    <span className="font-medium">{eur(e.amount)}</span>
                    <span className="text-muted-foreground">{fmtDate(e.entry_date ?? String(e.created_at).slice(0, 10))}</span>
                    <span>{label}</span>
                    {e.invoice_number && <span className="text-muted-foreground">Fatura {e.invoice_number}</span>}
                    <span className="text-muted-foreground truncate">{e.description ?? ""}</span>
                    {mine && (
                      <div className="ml-auto flex items-center">
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => openEditEntry(e)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Eliminar" onClick={() => { if (confirm("Eliminar este lançamento?")) delMov.mutate(e.id); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>


          <Button asChild variant="outline" size="sm"><Link to="/acerto-carro">Abrir Acerto do Carro</Link></Button>
        </Card>
      )}

      <Card className="p-4 sm:p-6 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Ticket className="h-4 w-4" /> Ordens de Serviço de hoje</div>
        {(services as any[]).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ordens de serviço para hoje.</p>
        ) : (
          (services as any[]).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm border border-border rounded-md p-2">
              <span className="font-mono">{s.oc_code ?? s.service_code ?? "—"}</span>
              <span className="text-muted-foreground truncate">{s.clients?.name ?? "—"}</span>
              {s.start_time && <span className="text-muted-foreground">{String(s.start_time).slice(0, 5)}</span>}
              <Badge variant="outline" className="ml-auto">{s.status}</Badge>
            </div>
          ))
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/roteiro">Ver roteiro do dia</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/oc">Ver ordens de serviço</Link></Button>
        </div>
      </Card>

      <Dialog open={entryOpen} onOpenChange={(o) => { if (!o) { setEntryOpen(false); setEditingEntryId(null); setEntry({ ...EMPTY_ENTRY }); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEntryId ? "Editar lançamento" : "Lançamento manual"}{movVehicleId ? ` · ${vehicleLabel(movVehicleId).split(" ·")[0]}` : ""}</DialogTitle>
          </DialogHeader>
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
                    {(costCenters as any[]).filter((c) => c.active !== false).map((c) => (
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
            <div className="text-xs text-muted-foreground">Veículo: {movVehicleId ? vehicleLabel(movVehicleId) : "—"}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEntryOpen(false); setEditingEntryId(null); setEntry({ ...EMPTY_ENTRY }); }}>Cancelar</Button>
            <Button className="gradient-gold text-gold-foreground" disabled={addMov.isPending} onClick={() => addMov.mutate()}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}
