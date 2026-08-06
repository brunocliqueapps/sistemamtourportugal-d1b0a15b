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
    const prev = existing.find((e) => e.date === iso && !e.deleted);
    out.push({
      date: iso,
      text: prev?.text ?? "",
      mode: prev?.mode ?? "sugestao",
      region_id: prev?.region_id ?? "",
      tour_route_id: prev?.tour_route_id ?? "",
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
