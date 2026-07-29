export type ItineraryDay = { date: string; text: string };

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
    out.push({ date: iso, text: existing.find((e) => e.date === iso)?.text ?? existing[i]?.text ?? "" });
  }
  return out;
}

/** Condições de pagamento sugeridas conforme a duração. */
export function suggestPaymentTerms(days: number): string {
  if (days <= 1) return "40% na aprovação da proposta · 60% no final do serviço";
  return "30% na aprovação da proposta · 50% no início do serviço · 20% após a conclusão";
}

export function paymentSchedule(days: number, total: number) {
  const t = Number(total || 0);
  if (days <= 1) {
    return [
      { label: "Aprovação da proposta", pct: 40, value: t * 0.4 },
      { label: "Final do serviço", pct: 60, value: t * 0.6 },
    ];
  }
  return [
    { label: "Aprovação da proposta", pct: 30, value: t * 0.3 },
    { label: "Início do serviço", pct: 50, value: t * 0.5 },
    { label: "Após a conclusão", pct: 20, value: t * 0.2 },
  ];
}
