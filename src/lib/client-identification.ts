// Identificação do cliente (Mtour / Parceiro) e responsável pelo pagamento.
// Registos antigos sem valor são tratados como "mtour".
export type ClientIdentification = "mtour" | "parceiro";
export type PaymentResponsible = "cliente" | "parceiro";

export const CLIENT_IDENTIFICATION_OPTIONS: { value: ClientIdentification; label: string }[] = [
  { value: "mtour", label: "Cliente Mtour" },
  { value: "parceiro", label: "Cliente Parceiro" },
];

export const PAYMENT_RESPONSIBLE_OPTIONS: { value: PaymentResponsible; label: string }[] = [
  { value: "cliente", label: "Pagamento pelo cliente" },
  { value: "parceiro", label: "Pagamento pelo parceiro" },
];

export function clientIdentificationOf(c: any): ClientIdentification {
  return c?.client_identification === "parceiro" ? "parceiro" : "mtour";
}

export function isPartnerClient(c: any): boolean {
  return clientIdentificationOf(c) === "parceiro" && !!c?.partner_id;
}

/** Valida a identificação no formulário de cliente. Devolve mensagem de erro ou null. */
export function validateClientIdentification(form: any): string | null {
  if (clientIdentificationOf(form) === "parceiro" && !form?.partner_id) {
    return "Seleciona o parceiro do Cliente Parceiro.";
  }
  return null;
}

/**
 * Responsável pelo pagamento só é válido se foi guardado para o parceiro atual do cliente
 * da proposta — evita mostrar uma escolha ligada a outro cliente/parceiro.
 */
export function effectivePaymentResponsible(proposal: any): PaymentResponsible | null {
  const c = proposal?.clients;
  if (!isPartnerClient(c)) return null;
  const v = proposal?.payment_responsible;
  if (v !== "cliente" && v !== "parceiro") return null;
  if (proposal?.payment_responsible_partner_id !== c.partner_id) return null;
  return v;
}

export type ColumnState = "loading" | "present" | "absent" | "error";
/** Interpreta o resultado de um select read-only (limit 0) sobre as colunas novas. */
export function columnStateFromResult(res: { error: { code?: string; message?: string } | null }): ColumnState {
  if (!res.error) return "present"; // tabela vazia também devolve sucesso
  const code = res.error.code ?? "";
  if (code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(res.error.message ?? "")) return "absent";
  return "error";
}
