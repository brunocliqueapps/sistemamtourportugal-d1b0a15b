import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween, paymentSchedule, suggestPaymentTerms, type ItineraryDay } from "./payment-terms";

async function header(doc: jsPDF, docTitle: string, code?: string) {
  const { data: company } = await supabase.from("company_settings").select("*").maybeSingle();
  const W = doc.internal.pageSize.getWidth();
  let y = 40;
  doc.setFont("helvetica", "bold").setFontSize(16);
  doc.text(company?.name ?? "Mtour Portugal", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 16;
  [company?.address, [company?.postal_code, company?.city].filter(Boolean).join(" "),
   company?.nif ? `NIF: ${company.nif}` : null, company?.phone, company?.email]
    .filter(Boolean).forEach((l: any) => { doc.text(String(l), 40, y); y += 12; });

  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(docTitle, W - 40, 50, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (code) doc.text(`Nº ${code}`, W - 40, 66, { align: "right" });
  doc.text(new Date().toLocaleDateString("pt-PT"), W - 40, 80, { align: "right" });
  y = Math.max(y, 110);
  doc.setDrawColor(200); doc.line(40, y, W - 40, y);
  return y + 16;
}

async function loadProposal(id: string) {
  const { data } = await supabase
    .from("proposals")
    .select("*, clients(*)")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Proposta não encontrada");
  return data as any;
}

function clientBlock(doc: jsPDF, p: any, y: number) {
  const c = p.clients ?? {};
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Cliente", 40, y); y += 14;
  doc.setFont("helvetica", "normal").setFontSize(10);
  const lines = [
    `${c.client_number ? c.client_number + " · " : ""}${c.name ?? "—"}`,
    c.nif ? `NIF/Passaporte: ${c.nif}` : null,
    [c.phone_country, c.phone].filter(Boolean).join(" ") || null,
    c.email || null,
    c.emergency_contact ? `Contacto de emergência: ${c.emergency_contact}` : null,
    p.passengers ? `Nº de pessoas: ${p.passengers}` : null,
    p.responsible ? `Responsável: ${p.responsible}` : null,
  ].filter(Boolean) as string[];
  lines.forEach((l) => { doc.text(l, 40, y); y += 12; });
  return y + 6;
}

function travelBlock(doc: jsPDF, p: any, y: number) {
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Dados da viagem", 40, y); y += 6;
  autoTable(doc, {
    startY: y,
    head: [["", "Data", "Hora", "Local"]],
    body: [
      ["Chegada", p.arrival_date ?? "—", p.arrival_time ?? "—", p.arrival_place ?? "—"],
      ["Partida", p.departure_date ?? "—", p.departure_time ?? "—", p.departure_place ?? "—"],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 33, 66] },
    margin: { left: 40, right: 40 },
  });
  return (doc as any).lastAutoTable.finalY + 18;
}

function itineraryBlock(doc: jsPDF, p: any, y: number) {
  const days: ItineraryDay[] = Array.isArray(p.itinerary) ? p.itinerary : [];
  if (!days.length) return y;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(p.proposal_kind === "servico_privado" ? "Serviço privado — descritivo diário" : "Roteiro personalizado", 40, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Data", "Programa"]],
    body: days.map((d) => [d.date, d.text || "—"]),
    columnStyles: { 0: { cellWidth: 80 } },
    styles: { fontSize: 9, cellPadding: 5, valign: "top" },
    headStyles: { fillColor: [16, 33, 66] },
    margin: { left: 40, right: 40 },
  });
  return (doc as any).lastAutoTable.finalY + 18;
}

export async function generateProposalPdf(id: string) {
  const p = await loadProposal(id);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, "PROPOSTA", p.code);
  y = clientBlock(doc, p, y);
  y = travelBlock(doc, p, y);
  y = itineraryBlock(doc, p, y);
  if (p.descriptive) {
    doc.setFont("helvetica", "bold").setFontSize(11); doc.text("Descritivo", 40, y); y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.splitTextToSize(p.descriptive, doc.internal.pageSize.getWidth() - 80).forEach((l: string) => { doc.text(l, 40, y); y += 12; });
    y += 6;
  }
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(`Valor total: € ${Number(p.total_value || 0).toFixed(2)}`, 40, y); y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Condições: ${p.payment_terms ?? suggestPaymentTerms(p.days_count ?? 1)}`, 40, y);
  doc.save(`Proposta-${p.code ?? p.id}.pdf`);
}

export async function generateBudgetPdf(id: string) {
  const p = await loadProposal(id);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, "ORÇAMENTO", p.code);
  y = clientBlock(doc, p, y);
  y = travelBlock(doc, p, y);
  y = itineraryBlock(doc, p, y);

  const days = p.days_count ?? daysBetween(p.itinerary_start, p.itinerary_end) ?? 1;
  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Dias", "Pessoas", "Total (€)"]],
    body: [[
      p.descriptive || p.title || (p.proposal_kind === "servico_privado" ? "Serviço privado" : "Roteiro personalizado"),
      String(days || 1), String(p.passengers ?? "—"), Number(p.total_value || 0).toFixed(2),
    ]],
    styles: { fontSize: 9 }, headStyles: { fillColor: [16, 33, 66] }, margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Condições de pagamento", 40, y); y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "%", "Valor (€)"]],
    body: paymentSchedule(days || 1, p.total_value).map((s) => [s.label, `${s.pct}%`, s.value.toFixed(2)]),
    styles: { fontSize: 9 }, headStyles: { fillColor: [176, 141, 68] }, margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (p.payment_terms) doc.text(p.payment_terms, 40, y);
  doc.save(`Orcamento-${p.code ?? p.id}.pdf`);
}

export async function generateVoucherPdf(id: string) {
  const p = await loadProposal(id);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, "VOUCHER", p.code);
  y = clientBlock(doc, p, y);
  const c = p.clients ?? {};
  doc.setFont("helvetica", "normal").setFontSize(10);
  [c.address, [c.postal_code, c.city].filter(Boolean).join(" "), c.country,
   c.birth_date ? `Data de nascimento: ${c.birth_date}` : null]
    .filter(Boolean).forEach((l: any) => { doc.text(String(l), 40, y); y += 12; });
  y += 8;
  y = travelBlock(doc, p, y);
  y = itineraryBlock(doc, p, y);
  if (p.descriptive) {
    doc.setFont("helvetica", "bold").setFontSize(11); doc.text("Observações", 40, y); y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.splitTextToSize(p.descriptive, doc.internal.pageSize.getWidth() - 80).forEach((l: string) => { doc.text(l, 40, y); y += 12; });
  }
  doc.save(`Voucher-${p.code ?? p.id}.pdf`);
}
