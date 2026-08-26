import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "./format-date";

const NAVY: [number, number, number] = [16, 33, 66];
const GOLD: [number, number, number] = [176, 141, 68];

export interface SettlementLine {
  label: string;
  date?: string | null;
  detail?: string;
  amount: number;
}

export interface SettlementPdfData {
  weekStart: string;
  weekEnd: string;
  vehicleLabel: string;
  ownership: string;
  driverName: string;
  incomes: SettlementLine[];
  expenses: SettlementLine[];
  incomeTotal: number;
  expenseTotal: number;
  rentalCost: number;
  netProfit: number;
  driverPct: number | null;
  driverAmount: number;
  companyAmount: number;
  details?: string | null;
  closedAt?: string | null;
}

const eur = (n: number) => `€ ${Number(n || 0).toFixed(2)}`;

export async function generateSettlementPdf(d: SettlementPdfData) {
  const { data: company } = await supabase.from("company_settings").select("*").maybeSingle();
  const c: any = company ?? {};
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Marca d'água
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.setFont("helvetica", "bold").setFontSize(60).setTextColor(150);
  doc.text("MTOUR PORTUGAL", W / 2, H / 2, { align: "center", angle: 45 });
  doc.restoreGraphicsState();

  if (c.logo_url) {
    try { doc.addImage(c.logo_url, "PNG", W - 110, 28, 70, 70); } catch { /* logo opcional */ }
  }

  let y = 45;
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...NAVY);
  doc.text(String(c.trade_name ?? c.name ?? "Mtour Portugal"), 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  y += 16;
  [c.legal_name, c.address, [c.postal_code, c.city].filter(Boolean).join(" "), c.nif ? `NIF: ${c.nif}` : null, c.phone, c.email]
    .filter(Boolean)
    .forEach((l: any) => { doc.text(String(l), 40, y); y += 12; });

  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...GOLD);
  doc.text("ACERTO DO CARRO", W - 40, 95, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(80);
  doc.text(`${fmtDate(d.weekStart)} a ${fmtDate(d.weekEnd)}`, W - 40, 112, { align: "right" });

  y = Math.max(y, 140);
  doc.setDrawColor(...GOLD).setLineWidth(1.5);
  doc.line(40, y, W - 40, y);
  y += 22;

  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
  doc.text(`Viatura: ${d.vehicleLabel}`, 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
  y += 14;
  doc.text(`Identificação: ${d.ownership}`, 40, y);
  y += 12;
  doc.text(`Motorista: ${d.driverName || "—"}`, 40, y);
  y += 20;

  autoTable(doc, {
    startY: y,
    head: [["Data", "Entradas", "Detalhe", "Valor"]],
    body: d.incomes.length
      ? d.incomes.map((l) => [l.date ? fmtDate(l.date) : "—", l.label, l.detail ?? "—", eur(l.amount)])
      : [["—", "Sem entradas registadas", "—", eur(0)]],
    foot: [["", "Total entradas", "", eur(d.incomeTotal)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Data", "Saídas", "Detalhe", "Valor"]],
    body: d.expenses.length
      ? d.expenses.map((l) => [l.date ? fmtDate(l.date) : "—", l.label, l.detail ?? "—", eur(l.amount)])
      : [["—", "Sem saídas registadas", "—", eur(0)]],
    foot: [["", "Total saídas", "", eur(d.expenseTotal)]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: NAVY, textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const resume: string[][] = [
    ["Total entradas", eur(d.incomeTotal)],
    ["Total saídas", `- ${eur(d.expenseTotal)}`],
  ];
  if (d.rentalCost > 0) resume.push(["Aluguer da viatura", `- ${eur(d.rentalCost)}`]);
  resume.push(["Lucro líquido", eur(d.netProfit)]);
  if (d.driverPct !== null && d.driverPct !== undefined) {
    resume.push([`Crédito a empresa (${d.driverPct}%)`, eur(d.companyAmount)]);
  }
  resume.push(["A pagar ao motorista", eur(d.driverAmount)]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 16,
    head: [["Resumo", "Valor"]],
    body: resume,
    styles: { fontSize: 10 },
    headStyles: { fillColor: GOLD, textColor: 255 },
    columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: 40, right: 40 },
  });

  let yy = (doc as any).lastAutoTable.finalY + 24;
  if (d.details) {
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...NAVY);
    doc.text("Detalhes", 40, yy);
    yy += 14;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60);
    doc.splitTextToSize(String(d.details), W - 80).forEach((line: string) => {
      if (yy > H - 80) { doc.addPage(); yy = 60; }
      doc.text(line, 40, yy);
      yy += 12;
    });
  }
  if (d.closedAt) {
    doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(110);
    doc.text(`Semana fechada em ${fmtDate(d.closedAt.slice(0, 10))}`, 40, yy + 8);
  }

  // Rodapé em todas as páginas
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD).setLineWidth(0.8);
    doc.line(40, H - 50, W - 40, H - 50);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(110);
    const parts = [c.website, c.instagram_url ? `Instagram: ${c.instagram_url}` : null].filter(Boolean);
    doc.text(parts.join("  ·  ") || "Mtour Portugal", 40, H - 36);
    doc.text(`Página ${i}/${pages}`, W - 40, H - 36, { align: "right" });
  }

  doc.save(`acerto-${d.vehicleLabel.replace(/\s+/g, "-")}-${d.weekStart}.pdf`);
}
