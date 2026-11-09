import { describe, it, expect } from "vitest";
import { clientIdentificationOf, validateClientIdentification, effectivePaymentResponsible } from "./client-identification";

describe("identificação do cliente", () => {
  it("registos antigos sem valor são Cliente Mtour", () => {
    expect(clientIdentificationOf({})).toBe("mtour");
    expect(clientIdentificationOf({ client_identification: null })).toBe("mtour");
  });
  it("Cliente Parceiro exige parceiro", () => {
    expect(validateClientIdentification({ client_identification: "parceiro" })).not.toBeNull();
    expect(validateClientIdentification({ client_identification: "parceiro", partner_id: "p1" })).toBeNull();
    expect(validateClientIdentification({ client_identification: "mtour" })).toBeNull();
  });
});

describe("responsável pelo pagamento", () => {
  const clients = { client_identification: "parceiro", partner_id: "p1" };
  it("sem escolha predefinida", () => {
    expect(effectivePaymentResponsible({ clients })).toBeNull();
  });
  it("lê a escolha guardada para o parceiro atual", () => {
    expect(effectivePaymentResponsible({ clients, payment_responsible: "parceiro", payment_responsible_partner_id: "p1" })).toBe("parceiro");
  });
  it("ignora escolha ligada a outro parceiro", () => {
    expect(effectivePaymentResponsible({ clients, payment_responsible: "cliente", payment_responsible_partner_id: "p2" })).toBeNull();
  });
  it("não se aplica a Cliente Mtour", () => {
    expect(effectivePaymentResponsible({ clients: { partner_id: "p1" }, payment_responsible: "cliente", payment_responsible_partner_id: "p1" })).toBeNull();
  });
});

import { columnStateFromResult } from "./client-identification";
describe("deteção da coluna", () => {
  it("tabela vazia já migrada → presente", () => expect(columnStateFromResult({ error: null })).toBe("present"));
  it("migração ausente → ausente", () => expect(columnStateFromResult({ error: { code: "42703", message: "column clients.client_identification does not exist" } })).toBe("absent"));
  it("erro real → erro", () => expect(columnStateFromResult({ error: { code: "PGRST301", message: "JWT expired" } })).toBe("error"));
});
