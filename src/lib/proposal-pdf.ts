import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { buildDays, daysBetween, paymentSchedule, suggestPaymentTerms, type ItineraryDay } from "./payment-terms";

async function header(doc: jsPDF, docTitle: string, code?: string) {
  const { data: company } = await supabase.from("company_settings").select("*").maybeSingle();
  const c: any = company ?? {};
  const W = doc.internal.pageSize.getWidth();
  let y = 40;
  doc.setFont("helvetica", "bold").setFontSize(13);
  const title = [c.legal_name ?? c.name ?? "Mtour Portugal", c.trade_name ? `"${c.trade_name}"` : null].filter(Boolean).join(" ");
  doc.text(title, 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9);
  y += 16;
  [c.address, [c.postal_code, c.city].filter(Boolean).join(" "),
   c.nif ? `NIF: ${c.nif}` : null, c.phone, c.email, c.doc_header_extra]
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
    .select("*, clients(*), regions(name), tour_routes(name)")
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

function itineraryBlock(doc: jsPDF, p: any, y: number, columnLabel = "Programa") {
  const saved: ItineraryDay[] = Array.isArray(p.itinerary) ? p.itinerary : [];
  // Garante que todos os dias do período aparecem, mesmo os que ficaram sem texto
  const days = buildDays(p.itinerary_start, p.itinerary_end, saved);
  const list = days.length ? days : saved;
  if (!list.length) return y;
  const fallback = p.tour_routes?.name ?? p.private_service_text ?? "";
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(p.proposal_kind === "servico_privado" ? "Serviço privado — descritivo diário" : "Roteiro personalizado", 40, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [["Data", columnLabel]],
    body: list.map((d, i) => [
      `Dia ${i + 1}\n${d.date ?? "—"}`,
      (d.text && d.text.trim()) || ((d.mode ?? "sugestao") === "sugestao" ? fallback : "") || "—",
    ]),
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
  const stages: any[] = Array.isArray(p.payment_stages) && p.payment_stages.length
    ? p.payment_stages.map((s: any) => ({ label: s.label ?? "Etapa", pct: Number(s.pct || 0), value: Number(p.total_value || 0) * Number(s.pct || 0) / 100 }))
    : paymentSchedule(days || 1, p.total_value);
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "%", "Valor (€)"]],
    body: stages.map((s) => [s.label, `${s.pct}%`, Number(s.value || 0).toFixed(2)]),
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
  // O voucher é apenas para o cliente: sem valores nem observações de venda.
  y = itineraryBlock(doc, p, y, "Serviço contratado");
  doc.save(`Voucher-${p.code ?? p.id}.pdf`);
}

export async function generateServiceOrderPdf(id: string) {
  const { data } = await supabase
    .from("service_orders")
    .select("*, clients(*), vehicles(plate,brand,model,owner_company), proposals(code,title,descriptive,payment_terms,itinerary,itinerary_start,itinerary_end,proposal_kind,private_service_text,passengers,total_value)")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Ordem de serviço não encontrada");
  const s: any = data;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, "ORDEM DE SERVIÇO", s.oc_code ?? s.voucher_code);
  y = clientBlock(doc, { clients: s.clients, passengers: s.passengers ?? s.proposals?.passengers, responsible: s.responsible }, y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Hora", "Origem", "Destino", "Veículo"]],
    body: [[
      s.service_date ?? "—", s.start_time ?? "—", s.origin ?? "—", s.destination ?? "—",
      s.vehicles ? `${s.vehicles.plate}${s.vehicles.owner_company ? " — " + s.vehicles.owner_company : ""}` : "—",
    ]],
    styles: { fontSize: 9 }, headStyles: { fillColor: [16, 33, 66] }, margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 18;
  if (s.proposals) y = itineraryBlock(doc, s.proposals, y, "Serviço contratado");
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(`Valor: € ${Number(s.sale_value ?? s.proposals?.total_value ?? 0).toFixed(2)}`, 40, y); y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (s.payment_terms ?? s.proposals?.payment_terms) doc.text(String(s.payment_terms ?? s.proposals?.payment_terms), 40, y);
  doc.save(`OS-${s.oc_code ?? s.id}.pdf`);
}

