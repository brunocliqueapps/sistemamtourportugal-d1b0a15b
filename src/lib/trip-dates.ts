import type { ItineraryDay } from "@/lib/payment-terms";

/** Colunas da proposta necessárias para mostrar as datas e o roteiro da viagem. */
export const TRIP_PROPOSAL_COLS =
  "code,title,proposal_kind,itinerary,itinerary_start,itinerary_end,arrival_date,arrival_time,arrival_place,departure_date,departure_time,departure_place,region_id,tour_route_id,passengers,total_value,regions(name),tour_routes(name)";

/** Dias do roteiro inseridos na proposta (ignora os apagados), ordenados por data. */
export function itineraryDays(proposal: any): ItineraryDay[] {
  const raw = proposal?.itinerary;
  const list: ItineraryDay[] = Array.isArray(raw) ? raw : [];
  return list
    .filter((d) => d && !d.deleted && d.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Data de início/fim reais da viagem, sempre a partir da proposta. */
export function tripRange(so: any): { start: string; end: string } {
  const p = so?.proposals;
  const days = itineraryDays(p).map((d) => String(d.date));
  const start =
    p?.itinerary_start ?? days[0] ?? p?.arrival_date ?? so?.service_date ?? "";
  const end =
    p?.itinerary_end ?? days[days.length - 1] ?? p?.departure_date ?? start ?? "";
  return { start: String(start ?? ""), end: String(end ?? start ?? "") };
}

/** O dia do roteiro correspondente a uma data (yyyy-mm-dd). */
export function itineraryDayFor(proposal: any, date: string): ItineraryDay | undefined {
  return itineraryDays(proposal).find((d) => String(d.date).slice(0, 10) === date);
}

/** Descrição do dia: roteiro escolhido (região · roteiro) ou texto livre. */
export function dayLabel(proposal: any, day?: ItineraryDay): string {
  if (!day) return "";
  if (day.mode === "personalizado") return day.text ?? "";
  const parts = [proposal?.regions?.name, proposal?.tour_routes?.name].filter(Boolean);
  const base = parts.join(" · ");
  return [base, day.text].filter(Boolean).join(" — ");
}
