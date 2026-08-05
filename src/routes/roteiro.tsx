import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format-date";
import { TRIP_PROPOSAL_COLS, dayLabel, itineraryDayFor, tripRange } from "@/lib/trip-dates";
import { CheckCircle2, Clock, MapPin, Car, User, Ticket, Gauge, Receipt, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/roteiro")({ component: Roteiro });

function Roteiro() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data: regions = [] } = useQuery({ queryKey: ["roteiro-regions"], queryFn: async () => (await (supabase.from("regions" as any).select("id,name") as any)).data ?? [] });
  const { data: routes = [] } = useQuery({ queryKey: ["roteiro-routes"], queryFn: async () => (await (supabase.from("tour_routes" as any).select("id,name") as any)).data ?? [] });
  const names = {
    regions: Object.fromEntries((regions as any[]).map((r: any) => [r.id, r.name])),
    routes: Object.fromEntries((routes as any[]).map((r: any) => [r.id, r.name])),
  };

  const { data: services = [] } = useQuery({
    queryKey: ["roteiro", date],
    queryFn: async () => {
      const { data } = await (supabase.from("service_orders" as any)
        .select(`*, clients(name,phone,email), drivers(full_name,phone), vehicles(plate,brand,model), proposals(${TRIP_PROPOSAL_COLS})`) as any)
        .order("start_time", { ascending: true });
      // A data da viagem (proposta) manda; a data de registo da OS é só o último recurso
      return (data ?? []).filter((s: any) => {
        const { start, end } = tripRange(s);
        if (!start) return false;
        return start <= date && date <= (end || start);
      });
    },
  });

  const ids = services.map((s: any) => s.id);
  const { data: closings = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["roteiro-closings", ids.join(",")],
    queryFn: async () => (await supabase.from("service_closings").select("*").in("service_order_id", ids)).data ?? [],
  });
  const { data: expenses = [] } = useQuery({
    enabled: ids.length > 0,
    queryKey: ["roteiro-exp", ids.join(",")],
    queryFn: async () => (await supabase.from("service_expenses").select("*").in("service_order_id", ids)).data ?? [],
  });
  const { data: closers = [] } = useQuery({
    enabled: closings.length > 0,
    queryKey: ["roteiro-closers", closings.map((c: any) => c.closed_by).join(",")],
    queryFn: async () => {
      const uids = Array.from(new Set(closings.map((c: any) => c.closed_by).filter(Boolean)));
      if (!uids.length) return [];
      return (await supabase.from("profiles").select("id,full_name,email").in("id", uids)).data ?? [];
    },
  });

  const closingBy = (soId: string) => closings.find((c: any) => c.service_order_id === soId);
  const expensesBy = (soId: string) => expenses.filter((e: any) => e.service_order_id === soId);
  const closerName = (uid?: string) => {
    if (!uid) return "";
    const p = closers.find((c: any) => c.id === uid);
    return p?.full_name || p?.email || uid.slice(0, 8);
  };

  // group by client
  const grouped = services.reduce<Record<string, any[]>>((acc, s: any) => {
    const key = s.client_id || "sem-cliente";
    (acc[key] = acc[key] ?? []).push(s);
    return acc;
  }, {});

  const totalDia = services.length;
  const finalizados = services.filter((s: any) => closingBy(s.id)?.closed_at).length;

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title="Roteiro do Dia"
        description="Todos os serviços agrupados por cliente, com programação, gastos, ocorrências e finalização."
        actions={<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">Serviços</div><div className="text-2xl font-semibold">{totalDia}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Finalizados</div><div className="text-2xl font-semibold">{finalizados}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">Pendentes</div><div className="text-2xl font-semibold">{totalDia - finalizados}</div></Card>
      </div>

      {totalDia === 0 && (
        <Card className="p-10 text-center text-muted-foreground">Sem serviços para {new Date(date).toLocaleDateString("pt-PT")}.</Card>
      )}

      {Object.entries(grouped).map(([clientId, list]) => {
        const client = (list[0] as any).clients;
        return (
          <Card key={clientId} className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Cliente</div>
                <div className="text-lg font-semibold">{client?.name ?? "—"}</div>
                <div className="text-sm text-muted-foreground">
                  {client?.phone && `${client.phone} · `}{client?.email ?? ""}
                </div>
              </div>
              <Badge variant="outline">{list.length} serviço(s)</Badge>
            </div>

            <Separator />

            <div className="space-y-4">
              {list.map((s: any) => {
                const closed = closingBy(s.id);
                const exps = expensesBy(s.id);
                const totalExp = exps.reduce((a, e: any) => a + Number(e.amount || 0), 0);
                const trip = tripRange(s);
                const day = itineraryDayFor(s.proposals, date);
                const dayText = dayLabel(s.proposals, day, names);
                return (
                  <div key={s.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="gap-1"><Clock className="w-3 h-3" />{s.start_time?.slice(0, 5) ?? "—"}</Badge>
                        <Link to="/oc/$id" params={{ id: s.id }} className="font-mono text-sm text-primary hover:underline">{s.oc_code}</Link>
                        <Badge variant="outline" className="gap-1"><Ticket className="w-3 h-3" />{s.voucher_code}</Badge>
                        <Badge>{s.status}</Badge>
                        {trip.start && (
                          <Badge variant="secondary" className="text-xs">
                            Viagem {fmtDate(trip.start)}{trip.end && trip.end !== trip.start ? ` → ${fmtDate(trip.end)}` : ""}
                          </Badge>
                        )}
                      </div>
                      {closed?.closed_at ? (
                        <Badge className="bg-green-600 hover:bg-green-600 gap-1"><CheckCircle2 className="w-3 h-3" />Finalizado</Badge>
                      ) : (
                        <FinalizeDialog service={s} />
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 text-sm">
                      <div className="space-y-1">
                        <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 text-muted-foreground" /><span>{s.origin || "—"} → {s.destination || "—"}</span></div>
                        {(dayText || s.itinerary) && (
                          <div className="text-muted-foreground pl-6 whitespace-pre-line">
                            Roteiro de {fmtDate(date)}: {dayText || s.itinerary}
                          </div>
                        )}
                        <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" />{s.drivers?.full_name ?? "Sem motorista"} {s.drivers?.phone && `· ${s.drivers.phone}`}</div>
                        <div className="flex items-center gap-2"><Car className="w-4 h-4 text-muted-foreground" />{s.vehicles ? `${s.vehicles.plate} · ${s.vehicles.brand ?? ""} ${s.vehicles.model ?? ""}` : "Sem veículo"}</div>
                        <div className="text-muted-foreground">{s.passengers ?? 0} pax · Venda € {Number(s.sale_value || 0).toFixed(2)}</div>
                      </div>
                      <div className="space-y-1">
                        {closed && (
                          <>
                            <div className="flex items-center gap-2"><Gauge className="w-4 h-4 text-muted-foreground" />Km {closed.km_initial ?? "—"} → {closed.km_final ?? "—"} ({Number(closed.km_traveled || 0)} km)</div>
                            <div className="flex items-center gap-2"><Receipt className="w-4 h-4 text-muted-foreground" />Recebido € {Number(closed.amount_received || 0).toFixed(2)} · Pendente € {Number(closed.balance_pending || 0).toFixed(2)}</div>
                            {closed.incidents && <div className="flex items-start gap-2 text-amber-600"><AlertTriangle className="w-4 h-4 mt-0.5" /><span>{closed.incidents}</span></div>}
                            <div className="text-xs text-muted-foreground pt-1">
                              Finalizado por <b>{closerName(closed.closed_by)}</b> em {new Date(closed.closed_at).toLocaleString("pt-PT")}
                            </div>
                          </>
                        )}
                        {exps.length > 0 && (
                          <div className="pt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Gastos (€ {totalExp.toFixed(2)})</div>
                            <ul className="text-xs space-y-0.5">
                              {exps.map((e: any) => (
                                <li key={e.id} className="flex justify-between"><span>{e.category} {e.description && `· ${e.description}`}</span><span>€ {Number(e.amount).toFixed(2)}</span></li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {s.notes && <div className="text-xs text-muted-foreground border-t pt-2">Obs: {s.notes}</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function FinalizeDialog({ service }: { service: any }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [form, setForm] = useState<any>({
    km_initial: 0, km_final: 0,
    amount_received: service.sale_value ?? 0,
    incidents: "", notes: "",
  });

  const finalize = useMutation({
    mutationFn: async () => {
      if (!confirm) throw new Error("Confirme a finalização");
      const payload = {
        service_order_id: service.id,
        km_initial: Number(form.km_initial) || null,
        km_final: Number(form.km_final) || null,
        sale_value: Number(service.sale_value || 0),
        amount_received: Number(form.amount_received) || 0,
        balance_pending: Number(service.sale_value || 0) - Number(form.amount_received || 0),
        incidents: form.incidents || null,
        notes: form.notes || null,
        end_time: new Date().toISOString(),
        closed_by: user!.id,
        closed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("service_closings").upsert(payload, { onConflict: "service_order_id" });
      if (error) throw error;
      await supabase.from("service_orders").update({
        status: "finalizado",
        amount_received: payload.amount_received,
        amount_pending: payload.balance_pending,
      }).eq("id", service.id);
      if (payload.amount_received > 0) {
        await supabase.from("cash_movements").insert({
          kind: "entrada", amount: payload.amount_received,
          service_order_id: service.id,
          description: `Recebimento OS ${service.oc_code}`, created_by: user!.id,
        });
      }
    },
    onSuccess: () => { toast.success("Serviço finalizado"); setOpen(false); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><CheckCircle2 className="w-4 h-4" />Finalizar</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Finalizar {service.oc_code}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>Km inicial</Label><Input type="number" value={form.km_initial} onChange={(e) => setForm({ ...form, km_initial: e.target.value })} /></div>
            <div><Label>Km final</Label><Input type="number" value={form.km_final} onChange={(e) => setForm({ ...form, km_final: e.target.value })} /></div>
          </div>
          <div><Label>Valor recebido (€)</Label><Input type="number" step="0.01" value={form.amount_received} onChange={(e) => setForm({ ...form, amount_received: e.target.value })} /></div>
          <div><Label>Ocorrências</Label><Textarea value={form.incidents} onChange={(e) => setForm({ ...form, incidents: e.target.value })} placeholder="Atrasos, incidentes, alterações…" /></div>
          <div><Label>Notas</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm pt-2">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} />
            Confirmo a finalização deste serviço (será registado com meu utilizador, data e hora)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className="gradient-gold text-gold-foreground" disabled={!confirm || finalize.isPending} onClick={() => finalize.mutate()}>
            Finalizar serviço
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
