import { describe, expect, it } from "vitest";
import { buildDays, visibleItineraryDays } from "./payment-terms";

describe("dias excluídos do roteiro no voucher", () => {
  const start = "2026-11-01";
  const end = "2026-11-05";
  const saved = buildDays(start, end).map((day, i) => ({ ...day, text: `Serviço ${i + 1}`, deleted: i < 4 }));

  it("preserva a exclusão ao guardar, reabrir e reconstruir o período", () => {
    const reopened = JSON.parse(JSON.stringify(saved));
    expect(buildDays(start, end, reopened).map((day) => day.deleted)).toEqual([true, true, true, true, false]);
    expect(visibleItineraryDays(start, end, reopened).map((day) => day.date)).toEqual(["2026-11-05"]);
  });

  it("mantém o dia 5 como dia 5 após excluir os dias anteriores", () => {
    expect(visibleItineraryDays(start, end, saved).map((day) => day.dayNumber)).toEqual([5]);
  });

  it("não emite dias nem orientações quando todos foram excluídos", () => {
    expect(visibleItineraryDays(start, end, saved.map((day) => ({ ...day, deleted: true })))).toEqual([]);
  });

  it("respeita exclusões mesmo em registos sem período definido", () => {
    expect(visibleItineraryDays(null, null, saved).map((day) => day.date)).toEqual(["2026-11-05"]);
  });

  it("mantém todos os dias dos roteiros antigos sem exclusão", () => {
    expect(visibleItineraryDays(start, end, [{ date: start, text: "Passeio" }])).toHaveLength(5);
  });
});