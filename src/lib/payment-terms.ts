export type ItineraryDay = {
  date: string;
  text: string;
  /** "sugestao" = roteiro sugerido Mtour · "personalizado" = descrição livre */
  mode?: "sugestao" | "personalizado";
  region_id?: string;
  tour_route_id?: string;
  deleted?: boolean;
};

export function daysBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function buildDays(start?: string | null, end?: string | null, existing: ItineraryDay[] = []): ItineraryDay[] {
  const n = daysBetween(start, end);
  if (!n) return [];
  const out: ItineraryDay[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start as string);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const prev = existing.find((e) => e.date === iso);
    out.push({
      date: iso,
      text: prev?.text ?? "",
      mode: prev?.mode ?? "sugestao",
      region_id: prev?.region_id ?? "",
      tour_route_id: prev?.tour_route_id ?? "",
      deleted: prev?.deleted ?? false,
    });
  }
  return out;
}


/** Condições de pagamento sugeridas conforme a duração. */
export function suggestPaymentTerms(days: number): string {
  return "30% na aprovação da proposta · 60% antes de iniciar o serviço · 10% após concluir o serviço";
}

export function paymentSchedule(days: number, total: number) {
  const t = Number(total || 0);
  return [
    { label: "Aprovação da Proposta", pct: 30, value: t * 0.3 },
    { label: "Antes de iniciar o Serviço", pct: 60, value: t * 0.6 },
    { label: "Após Concluir o Serviço", pct: 10, value: t * 0.1 },
  ];
}

/** Datas sugeridas automaticamente para as etapas de pagamento de uma proposta. */
export function defaultStageDates(p: any): { approval: string; firstDay: string; lastDay: string } {
  const days = (Array.isArray(p?.itinerary) ? p.itinerary : [])
    .filter((d: any) => d && !d.deleted && d.date)
    .map((d: any) => String(d.date).slice(0, 10))
    .sort();
  const approvalRaw = p?.budget_approved_at ?? p?.approved_at ?? p?.budget_validated_at ?? "";
  const approval = approvalRaw ? String(approvalRaw).slice(0, 10) : "";
  const firstDay = String(p?.itinerary_start ?? days[0] ?? p?.arrival_date ?? "").slice(0, 10);
  const lastDay = String(p?.itinerary_end ?? days[days.length - 1] ?? p?.departure_date ?? firstDay ?? "").slice(0, 10);
  return { approval, firstDay, lastDay };
}

/** Preenche as datas das etapas (aprovação · 1.º dia · último dia) quando estiverem vazias. */
export function withDefaultStageDates(p: any, stages: any[]): any[] {
  const { approval, firstDay, lastDay } = defaultStageDates(p);
  const fallback = [approval, firstDay, lastDay];
  return stages.map((s: any, i: number) => ({ ...s, date: s?.date || fallback[i] || "" }));
}
