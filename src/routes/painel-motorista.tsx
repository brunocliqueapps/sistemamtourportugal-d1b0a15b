import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { fmtDate } from "@/lib/format-date";
import { TRIP_PROPOSAL_COLS, tripRange } from "@/lib/trip-dates";
import { Car, Clock, MapPin, Ticket, Users, Wallet } from "lucide-react";

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

function PainelMotorista() {
  const { user } = useAuth();
  const today = iso(new Date());
  const weekStart = iso(mondayOf(new Date()));
  const weekEnd = addDays(weekStart, 6);
  const [kind, setKind] = useState<Kind | null>(null);

  const { data: myDriver } = useQuery({
    queryKey: ["pm-driver", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("drivers").select("id,full_name").eq("user_id", user!.id).maybeSingle()).data,
  });

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
        .eq("shift_date", today)).data ?? [],
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["pm-entries", myDriver?.id, weekStart],
    enabled: !!myDriver?.id,
    queryFn: async () =>
      (await (supabase.from("car_settlement_entries") as any)
        .select("kind,amount,week_start")
        .gte("week_start", weekStart)
        .lte("week_start", weekStart)).data ?? [],
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

  const week = (entries as any[]).reduce(
    (acc, e) => {
      if (e.kind === "entrada") acc.in += Number(e.amount || 0);
      else acc.out += Number(e.amount || 0);
      return acc;
    },
    { in: 0, out: 0 },
  );

  const list = kind === "privado" ? privados : kind === "roteiro" ? roteiros : [];

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <PageHeader
        title={`Olá${myDriver?.full_name ? `, ${myDriver.full_name}` : ""}`}
        description={`O seu dia de trabalho · ${fmtDate(today)}`}
      />

      {!myDriver && (
        <Card className="p-6 text-sm text-muted-foreground">
          O seu utilizador ainda não está ligado a um registo de motorista. Fale com um administrador.
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

      {kind === "tvde" && (
        <Card className="p-4 sm:p-6 space-y-3">
          <div className="font-semibold flex items-center gap-2"><Car className="h-4 w-4" /> Turnos TVDE de hoje</div>
          {shifts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem turno TVDE registado para hoje.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
          <Button asChild variant="outline" size="sm"><Link to="/roteiro">Ver roteiro do dia</Link></Button>
        </Card>

        <Card className="p-4 sm:p-6 space-y-3">
          <div className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Acerto do carro · semana</div>
          <div className="text-sm text-muted-foreground">{fmtDate(weekStart)} — {fmtDate(weekEnd)}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Entradas</div>
              <div className="text-lg font-bold">{eur(week.in)}</div>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="text-xs text-muted-foreground">Saídas</div>
              <div className="text-lg font-bold">{eur(week.out)}</div>
            </div>
          </div>
          <Button asChild variant="outline" size="sm"><Link to="/acerto-carro">Abrir Acerto do Carro</Link></Button>
        </Card>
      </div>
    </div>
  );
}
