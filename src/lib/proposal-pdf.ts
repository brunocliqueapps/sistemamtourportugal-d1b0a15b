import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { buildDays, daysBetween, paymentSchedule, suggestPaymentTerms, type ItineraryDay } from "./payment-terms";
import { shortCode } from "@/lib/codes";
import { fmtDate } from "./format-date";

function watermark(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.07 }));
  doc.setFont("helvetica", "bold").setFontSize(58);
  doc.setTextColor(150);
  doc.text("MTOUR PORTUGAL", W / 2, H / 2 + 10, { align: "center", angle: 45, baseline: "middle" } as any);
  doc.restoreGraphicsState();
  doc.setTextColor(0);
}

function applyWatermarkToAllPages(doc: jsPDF) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    watermark(doc);
  }
}

async function header(doc: jsPDF, docTitle: string, code?: string, opts?: { skipWatermark?: boolean }) {
  const { data: company } = await supabase.from("company_settings").select("*").maybeSingle();
  const c: any = company ?? {};
  const W = doc.internal.pageSize.getWidth();

  // Marca d'água (Texto leve no fundo, centrado)
  if (!opts?.skipWatermark) watermark(doc);


  // Logo (Direito Superior) — quadrado
  if (c.logo_url) {
    try {
      doc.addImage(c.logo_url, "PNG", W - 110, 28, 70, 70);
    } catch (e) {
      console.error("Erro ao carregar logo", e);
    }
  }

  let y = 45;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(16, 33, 66); // Azul Marinho — destaque nome comercial
  doc.text(String(c.trade_name ?? c.name ?? "Mtour Portugal"), 40, y);

  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  y += 16;
  [c.legal_name, c.address, [c.postal_code, c.city].filter(Boolean).join(" "),
   c.nif ? `NIF: ${c.nif}` : null, c.phone, c.email]
    .filter(Boolean).forEach((l: any) => { doc.text(String(l), 40, y); y += 12; });

  // Título e Código
  doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(176, 141, 68); // Dourado
  doc.text(docTitle, W - 150, 95, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
  if (code) doc.text(`Nº ${code}`, W - 40, 110, { align: "right" });
  doc.text(new Date().toLocaleDateString("pt-PT"), W - 40, 125, { align: "right" });
  
  y = Math.max(y, 140);
  doc.setDrawColor(176, 141, 68); 
  doc.setLineWidth(1.5);
  doc.line(40, y, W - 40, y);

  // QR Code do Instagram — ao lado direito do bloco do cliente
  if (c.instagram_qr_url) {
    try {
      doc.addImage(c.instagram_qr_url, "PNG", W - 100, y + 20, 60, 60);
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120);
      doc.text("Siga-nos", W - 70, y + 90, { align: "center" });
    } catch (e) {}
  }

  // Rodapé
  footer(doc, c);

  return y + 25;
}

function footer(doc: jsPDF, c: any) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Dados de contato centralizados no rodapé (sem telefone — já consta no cabeçalho)
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  const contactLines = [
    c.website,
    c.facebook_url ? `Facebook: ${c.facebook_url.replace("https://", "")}` : null,
    c.instagram_url ? `Instagram: ${c.instagram_url.replace("https://", "")}` : null
  ].filter(Boolean).join("  |  ");

  doc.text(contactLines, W / 2, H - 42, { align: "center" });

  // Copyright
  doc.setFontSize(7);
  doc.text(`© ${new Date().getFullYear()} Mtour Portugal - Experiências Exclusivas`, W / 2, H - 28, { align: "center" });
}

function footerVoucher(doc: jsPDF, c: any) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  const website = c.website || "https://mtourportugal.com/";
  const instagram = c.instagram_url || "www.instagram.com/mtourportugal?utm_source=qr";
  const line1 = `${website} | Instagram: ${instagram.replace("https://", "")}`;
  doc.text(line1, W / 2, H - 42, { align: "center" });
  doc.setFontSize(7);
  doc.text(`© ${new Date().getFullYear()} Mtour Portugal - Experiências Exclusivas`, W / 2, H - 28, { align: "center" });
}

function applyFooterToAllPages(doc: jsPDF, company: any, mode: "default" | "voucher" = "default") {
  const total = doc.getNumberOfPages();
  const fn = mode === "voucher" ? footerVoucher : footer;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    fn(doc, company);
  }
}



/** Condições Gerais (Configurações) — sempre no final do documento. */
async function generalConditionsBlock(doc: jsPDF, y: number) {
  const { data: company } = await (supabase.from("company_settings") as any).select("*").maybeSingle();
  const text = (company as any)?.proposal_general_conditions;
  if (!text) return y;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  y += 24;
  if (y > H - 120) { doc.addPage(); y = 60; }
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(16, 33, 66);
  doc.text("Condições Gerais", 40, y); y += 8;
  doc.setDrawColor(176, 141, 68).setLineWidth(1);
  doc.line(40, y, W - 40, y); y += 16;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  doc.splitTextToSize(String(text), W - 80).forEach((l: string) => {
    if (y > H - 60) { doc.addPage(); y = 60; }
    doc.text(l, 40, y); y += 12;
  });
  doc.setTextColor(0);
  return y + 10;
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
      ["Chegada", fmtDate(p.arrival_date) || "—", p.arrival_time ?? "—", p.arrival_place ?? "—"],
      ["Partida", fmtDate(p.departure_date) || "—", p.departure_time ?? "—", p.departure_place ?? "—"],
    ],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [16, 33, 66], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },

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
      `Dia ${i + 1}\n${fmtDate(d.date) || "—"}`,
      (d.text && d.text.trim()) || ((d.mode ?? "sugestao") === "sugestao" ? fallback : "") || "—",
    ]),
    columnStyles: { 0: { cellWidth: 80 } },
    styles: { fontSize: 9, cellPadding: 5, valign: "top" },
    headStyles: { fillColor: [16, 33, 66], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },

    margin: { left: 40, right: 40 },
  });
  return (doc as any).lastAutoTable.finalY + 18;
}


/**
 * PDF do roteiro/proposta.
 * variant "roteiro" (validação do cliente): título "ROTEIRO", sem valores nem condições gerais.
 */
export async function generateProposalPdf(id: string, opts?: { variant?: "proposta" | "roteiro" }) {
  const isRoteiro = opts?.variant === "roteiro";
  const p = await loadProposal(id);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, isRoteiro ? "ROTEIRO" : "PROPOSTA", p.code);
  y = clientBlock(doc, p, y);
  y = travelBlock(doc, p, y);
  y = itineraryBlock(doc, p, y);
  if (p.descriptive) {
    doc.setFont("helvetica", "bold").setFontSize(11); doc.text("Descritivo", 40, y); y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.splitTextToSize(p.descriptive, doc.internal.pageSize.getWidth() - 80).forEach((l: string) => { doc.text(l, 40, y); y += 12; });
    y += 6;
  }

  if (!isRoteiro) {
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(16, 33, 66);
    doc.text(`Valor total: € ${Number(p.total_value || 0).toFixed(2)}`, 40, y); y += 16;
    doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
    doc.text(`Condições: ${p.payment_terms ?? suggestPaymentTerms(p.days_count ?? 1)}`, 40, y); y += 12;
    y = await generalConditionsBlock(doc, y);
  }

  doc.save(`${isRoteiro ? "Roteiro" : "Proposta"}-${p.code ?? p.id}.pdf`);
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
    styles: { fontSize: 9 }, 
    headStyles: { fillColor: [16, 33, 66], textColor: [255, 255, 255] }, 
    margin: { left: 40, right: 40 },

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
    styles: { fontSize: 9 }, 
    headStyles: { fillColor: [176, 141, 68], textColor: [255, 255, 255] }, 
    alternateRowStyles: { fillColor: [255, 252, 245] },
    margin: { left: 40, right: 40 },

  });
  y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (p.payment_terms) { doc.text(p.payment_terms, 40, y); y += 12; }
  y = await generalConditionsBlock(doc, y);
  doc.save(`Orcamento-${p.code ?? p.id}.pdf`);
}

export async function generateVoucherPdf(id: string, opts?: { output?: "save" | "bloburl" }) {
  const p = await loadProposal(id);
  const { data: company } = await (supabase.from("company_settings") as any).select("*").maybeSingle();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = await header(doc, "VOUCHER", p.code, { skipWatermark: true });
  y = clientBlock(doc, p, y);
  const c = p.clients ?? {};
  doc.setFont("helvetica", "normal").setFontSize(10);
  [c.address, [c.postal_code, c.city].filter(Boolean).join(" "), c.country,
   c.birth_date ? `Data de nascimento: ${fmtDate(c.birth_date)}` : null]
    .filter(Boolean).forEach((l: any) => { doc.text(String(l), 40, y); y += 12; });
  y += 8;
  y = travelBlock(doc, p, y);
  
  // No voucher, acrescentar também tudo que tem em Orçamento, inclusive os valores e formas de pagamento.
  y = itineraryBlock(doc, p, y, "Serviço contratado");

  // Adicionar orientações diárias se houver
  const dayNotes: any[] = Array.isArray(p.voucher_day_notes) ? p.voucher_day_notes : [];
  if (dayNotes.length > 0) {
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Orientações Importantes", 40, y); y += 14;
    dayNotes.forEach((dn) => {
      if (dn.note && dn.note.trim()) {
        doc.setFont("helvetica", "bold").setFontSize(9);
        doc.text(`${fmtDate(dn.date)}:`, 40, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(dn.note, doc.internal.pageSize.getWidth() - 120);
        doc.text(lines, 110, y);
        y += (lines.length * 12) + 6;
      }
    });
    y += 10;
  }

  // Tabela de Valores e Etapas (Igual ao Orçamento)
  const days = p.days_count ?? daysBetween(p.itinerary_start, p.itinerary_end) ?? 1;
  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Dias", "Pessoas", "Total (€)"]],
    body: [[
      p.descriptive || p.title || (p.proposal_kind === "servico_privado" ? "Serviço privado" : "Roteiro personalizado"),
      String(days || 1), String(p.passengers ?? "—"), Number(p.total_value || 0).toFixed(2),
    ]],
    styles: { fontSize: 9 }, 
    headStyles: { fillColor: [16, 33, 66], textColor: [255, 255, 255] }, 
    margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("Forma de Pagamento", 40, y); y += 6;
  const stages: any[] = Array.isArray(p.payment_stages) && p.payment_stages.length
    ? p.payment_stages.map((s: any) => ({ label: s.label ?? "Etapa", pct: Number(s.pct || 0), value: Number(p.total_value || 0) * Number(s.pct || 0) / 100 }))
    : paymentSchedule(days || 1, p.total_value);
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "%", "Valor (€)"]],
    body: stages.map((s) => [s.label, `${s.pct}%`, Number(s.value || 0).toFixed(2)]),
    styles: { fontSize: 9 }, 
    headStyles: { fillColor: [176, 141, 68], textColor: [255, 255, 255] }, 
    alternateRowStyles: { fillColor: [255, 252, 245] },
    margin: { left: 40, right: 40 },
  });
  y = (doc as any).lastAutoTable.finalY + 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (p.payment_terms) doc.text(p.payment_terms, 40, y);
  y += 20;

  if (p.voucher_final_note) {
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("Nota Final", 40, y); y += 14;
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.splitTextToSize(p.voucher_final_note, doc.internal.pageSize.getWidth() - 80).forEach((l: string) => { 
      doc.text(l, 40, y); y += 12; 
    });
  }

  y = await generalConditionsBlock(doc, y);

  // Aplicar rodapé do voucher em todas as páginas
  applyFooterToAllPages(doc, company, "voucher");

  if (opts?.output === "bloburl") return URL.createObjectURL(doc.output("blob"));
  doc.save(`Voucher-${p.code ?? p.id}.pdf`);
  return null;
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
  let y = await header(doc, "ORDEM DE SERVIÇO", shortCode(s.oc_code ?? s.voucher_code));
  y = clientBlock(doc, { clients: s.clients, passengers: s.passengers ?? s.proposals?.passengers, responsible: s.responsible }, y);
  autoTable(doc, {
    startY: y,
    head: [["Data", "Hora", "Origem", "Destino", "Veículo"]],
    body: [[
      fmtDate(s.proposals?.itinerary_start ?? s.service_date) || "—", s.start_time ?? "—", s.origin ?? "—", s.destination ?? "—",
      s.vehicles ? `${s.vehicles.plate}${s.vehicles.owner_company ? " — " + s.vehicles.owner_company : ""}` : "—",
    ]],
    headStyles: { fillColor: [16, 33, 66], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 },

  });
  y = (doc as any).lastAutoTable.finalY + 18;
  if (s.proposals) y = itineraryBlock(doc, s.proposals, y, "Serviço contratado");
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(`Valor: € ${Number(s.sale_value ?? s.proposals?.total_value ?? 0).toFixed(2)}`, 40, y); y += 16;
  doc.setFont("helvetica", "normal").setFontSize(10);
  if (s.payment_terms ?? s.proposals?.payment_terms) doc.text(String(s.payment_terms ?? s.proposals?.payment_terms), 40, y);
  doc.save(`OS-${shortCode(s.oc_code) ?? s.id}.pdf`);
}

