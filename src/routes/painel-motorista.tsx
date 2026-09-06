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
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { fmtDate } from "@/lib/format-date";
import { TRIP_PROPOSAL_COLS, tripRange } from "@/lib/trip-dates";
import { Car, Clock, MapPin, Plus, Ticket, Trash2, Users, Wallet } from "lucide-react";

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

function PainelMotorista() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const qc = useQueryClient();
  const today = iso(new Date());
  const weekStart = iso(mondayOf(new Date()));
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
    queryKey: ["pm-services", myDriver?.id, today],
    enabled: !!myDriver?.id,
    queryFn: async () => {
      const { data } = await (supabase.from("service_orders") as any)
        .select(`*, clients(name,phone), vehicles(plate,brand,model), proposals(${TRIP_PROPOSAL_COLS})`)
        .eq("driver_id", myDriver!.id)
        .order("start_time", { ascending: true });
      return (data ?? []).filter((s: any) => {
        const { start, end } = tripRange(s);
        if (!start) return false;
        return start <= today && today <= (end || start);
      });
    },
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ["pm-shifts", myDriver?.id, today],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await (supabase.from("tvde_shifts") as any)
        .select("*, vehicles(plate,brand,model)")
        .eq("driver_id", myDriver!.id)
        .eq("shift_date", today)
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


  /* ---------- Lançamento do dia ---------- */
  const openShift: any = useMemo(() => (shifts as any[]).find((s) => !s.closed_at) ?? null, [shifts]);
  const [dayForm, setDayForm] = useState({ vehicle_id: "", operation_type: "tvde", km_initial: "", km_final: "", notes: "" });

  // Veículo sugerido: o principal atribuído ao motorista, ou o único que tiver
  const defaultVehicleId = useMemo(() => {
    const primary = (myVehicleLinks as any[]).find((l) => l.is_primary);
    if (primary && (vehicles as any[]).some((v) => v.id === primary.vehicle_id)) return primary.vehicle_id;
    return (vehicles as any[]).length ? (vehicles as any[])[0].id : "";
  }, [myVehicleLinks, vehicles]);

  useEffect(() => {
    if (openShift) {
      setDayForm({
        vehicle_id: openShift.vehicle_id ?? "",
        operation_type: openShift.operation_type ?? "tvde",
        km_initial: openShift.km_initial != null ? String(openShift.km_initial) : "",
        km_final: openShift.km_final != null ? String(openShift.km_final) : "",
        notes: openShift.notes ?? "",
      });
    } else {
      setDayForm({ vehicle_id: defaultVehicleId, operation_type: "tvde", km_initial: "", km_final: "", notes: "" });
    }
  }, [openShift?.id, defaultVehicleId]);

  const num = (v: string) => (v === "" ? null : Number(v));
  const canStartDay = !!dayForm.vehicle_id && !!dayForm.operation_type && dayForm.km_initial !== "";



  const startDay = useMutation({
    mutationFn: async () => {
      if (!myDriver?.id) throw new Error("Sem registo de motorista");
      if (!dayForm.vehicle_id) throw new Error("Escolha o veículo");
      if (dayForm.km_initial === "") throw new Error("Indique o KM inicial");
      const { error } = await (supabase.from("tvde_shifts") as any).insert({
        driver_id: myDriver.id,
        vehicle_id: dayForm.vehicle_id,
        operation_type: dayForm.operation_type,
        shift_date: today,
        start_time: new Date().toISOString(),
        km_initial: num(dayForm.km_initial),
        notes: dayForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dia iniciado");
      qc.invalidateQueries({ queryKey: ["pm-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-week-shifts"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível iniciar o dia"),
  });

  const saveDay = useMutation({
    mutationFn: async (close: boolean) => {
      if (!openShift) throw new Error("Não há lançamento aberto");
      if (close && dayForm.km_final === "") throw new Error("Indique o KM final para encerrar o dia");
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
      const { error } = await (supabase.from("tvde_shifts") as any).update(payload).eq("id", openShift.id);
      if (error) throw error;
      return close;
    },
    onSuccess: (close) => {
      toast.success(close ? "Serviços do dia encerrados" : "Lançamento guardado");
      qc.invalidateQueries({ queryKey: ["pm-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-week-shifts"] });
      qc.invalidateQueries({ queryKey: ["pm-entries"] });

    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível guardar"),
  });

  /* ---------- Entradas e saídas da semana ---------- */
  const [mov, setMov] = useState({ kind: "entrada", amount: "", description: "", entry_date: today, vehicle_id: "" });
  useEffect(() => {
    const suggested = openShift?.vehicle_id ?? (shifts as any[])[0]?.vehicle_id ?? defaultVehicleId;
    if (!mov.vehicle_id && suggested) setMov((m) => ({ ...m, vehicle_id: suggested }));
  }, [openShift?.vehicle_id, shifts.length, defaultVehicleId]);


  const addMov = useMutation({
    mutationFn: async () => {
      if (!mov.vehicle_id) throw new Error("Escolha o veículo");
      if (!mov.amount) throw new Error("Indique o valor");
      if (mov.entry_date < weekStart || mov.entry_date > weekEnd) throw new Error("A data tem de estar dentro da semana");
      const { error } = await (supabase.from("car_settlement_entries") as any).insert({
        vehicle_id: mov.vehicle_id,
        week_start: weekStart,
        kind: mov.kind,
        amount: Number(mov.amount),
        description: mov.description || null,
        entry_date: mov.entry_date,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lançamento registado");
      setMov((m) => ({ ...m, amount: "", description: "" }));
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


  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title={`Olá${myDriver?.full_name ? `, ${myDriver.full_name}` : ""}`}
        description={`O seu dia de trabalho · ${fmtDate(today)}`}
        actions={
          isAdmin ? (
            <div className="w-full sm:w-72">
              <Select value={pickedDriver} onValueChange={setPickedDriver}>
                <SelectTrigger><SelectValue placeholder="Ver painel de um motorista…" /></SelectTrigger>
                <SelectContent>
                  {(allDrivers as any[]).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : undefined
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
            <div className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Lançamento do dia</div>
            <Badge variant="outline">{openShift ? "em curso" : (shifts as any[]).length ? "encerrado" : "não iniciado"}</Badge>
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
              <Input type="number" value={dayForm.km_final} onChange={(e) => setDayForm({ ...dayForm, km_final: e.target.value })} disabled={!openShift} />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <Label>Notas do dia</Label>
              <Input value={dayForm.notes} onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })} placeholder="Ocorrências, observações…" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!openShift ? (
              <>
                <Button
                  onClick={() => startDay.mutate()}
                  disabled={startDay.isPending || viewingOther || !canStartDay}
                >
                  Iniciar dia de trabalho
                </Button>
                {!canStartDay && (
                  <span className="text-xs text-muted-foreground">
                    Preencha veículo, tipo de serviço e KM inicial.
                  </span>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => saveDay.mutate(false)} disabled={saveDay.isPending || viewingOther}>
                  Guardar lançamento
                </Button>
                <Button
                  onClick={() => saveDay.mutate(true)}
                  disabled={saveDay.isPending || viewingOther || dayForm.km_final === ""}
                >
                  Encerrar dia com KM final
                </Button>
                {dayForm.km_final === "" && (
                  <span className="text-xs text-muted-foreground">Indique o KM final para encerrar.</span>
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
            <Badge variant="outline">{fmtDate(weekStart)} → {fmtDate(weekEnd)}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={mov.kind} onValueChange={(v) => setMov({ ...mov, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Veículo</Label>
              <Select value={mov.vehicle_id} onValueChange={(v) => setMov({ ...mov, vehicle_id: v })}>
                <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                <SelectContent>
                  {(vehicles as any[]).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" min={weekStart} max={weekEnd} value={mov.entry_date} onChange={(e) => setMov({ ...mov, entry_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Valor (€)</Label>
              <Input type="number" step="0.01" value={mov.amount} onChange={(e) => setMov({ ...mov, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Input value={mov.description} onChange={(e) => setMov({ ...mov, description: e.target.value })} placeholder="Ex.: combustível, Uber, portagem" />
            </div>
          </div>
          <Button onClick={() => addMov.mutate()} disabled={addMov.isPending || viewingOther}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar lançamento
          </Button>

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
              myEntries.map((e: any) => (
                <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <Badge variant="outline">{e.kind === "entrada" ? "Entrada" : "Saída"}</Badge>
                  <span className="font-medium">{eur(e.amount)}</span>
                  <span className="text-muted-foreground">{fmtDate(e.entry_date ?? String(e.created_at).slice(0, 10))}</span>
                  <span className="text-muted-foreground">{vehicleLabel(e.vehicle_id)}</span>
                  <span className="text-muted-foreground truncate">{e.description ?? ""}</span>
                  {e.created_by === user?.id && !viewingOther && (
                    <Button size="icon" variant="ghost" className="ml-auto" onClick={() => delMov.mutate(e.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          <Button asChild variant="outline" size="sm"><Link to="/acerto-carro">Abrir Acerto do Carro</Link></Button>
        </Card>
      )}

      <Card className="p-4 sm:p-6 space-y-3">
        <div className="font-semibold flex items-center gap-2"><Ticket className="h-4 w-4" /> Vouchers do dia</div>
        {(services as any[]).filter((s) => s.voucher_code).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem vouchers para hoje.</p>
        ) : (
          (services as any[]).filter((s) => s.voucher_code).map((s) => (
            <div key={s.id} className="flex items-center justify-between text-sm border border-border rounded-md p-2">
              <span className="font-mono">{s.voucher_code}</span>
              <span className="text-muted-foreground truncate ml-2">{s.clients?.name}</span>
            </div>
          ))
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link to="/roteiro">Ver roteiro do dia</Link></Button>
          <Button asChild variant="outline" size="sm"><Link to="/voucher">Ver vouchers</Link></Button>
        </div>
      </Card>
    </div>
  );
}
