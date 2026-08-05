import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";

export async function generateInvoicePdf(invoiceId: string) {
  const [{ data: inv }, { data: company }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", invoiceId).single(),
    supabase.from("company_settings").select("*").maybeSingle(),
  ]);
  if (!inv) throw new Error("Fatura não encontrada");

  const [{ data: cc }, { data: pm }, { data: vat }] = await Promise.all([
    inv.cost_center_id ? supabase.from("cost_centers").select("name").eq("id", inv.cost_center_id).maybeSingle() : Promise.resolve({ data: null } as any),
    inv.payment_method_id ? supabase.from("payment_methods").select("name").eq("id", inv.payment_method_id).maybeSingle() : Promise.resolve({ data: null } as any),
    inv.vat_rate_id ? supabase.from("vat_rates").select("name,rate").eq("id", inv.vat_rate_id).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 40;

  // Marca d'água
  doc.saveGraphicsState();
  doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
  doc.setFont("helvetica", "bold").setFontSize(60);
  doc.setTextColor(150);
  doc.text("MTOUR PORTUGAL", W/2, H/2, { align: "center", angle: 45 });
  doc.restoreGraphicsState();

  // Logo Direito Superior
  if (company?.logo_url) {
    try { doc.addImage(company.logo_url, "PNG", W - 140, 30, 100, 45); } catch(e){}
  }

  // Cabeçalho — empresa
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(16, 33, 66);
  doc.text(company?.name ?? "Mtour Portugal", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(80);
  y += 16;
  const emitter = [
    company?.address, [company?.postal_code, company?.city].filter(Boolean).join(" "),
    company?.country, company?.nif ? `NIF: ${company.nif}` : null,
    company?.phone ? `Tel: ${company.phone}` : null, company?.email,
  ].filter(Boolean) as string[];
  emitter.forEach((line) => { doc.text(line, 40, y); y += 12; });


  // Título doc
  doc.setFont("helvetica", "bold").setFontSize(14);
  const title = `${(inv.doc_type ?? "fatura").toString().replace(/_/g, " ").toUpperCase()} ${inv.kind === "entrada" ? "· EMITIDA" : "· RECEBIDA"}`;
  doc.text(title, W - 40, 50, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`Código interno: ${inv.code}`, W - 40, 66, { align: "right" });
  if (inv.invoice_number) doc.text(`Nº: ${inv.series ? inv.series + "/" : ""}${inv.invoice_number}`, W - 40, 80, { align: "right" });
  doc.text(`Emissão: ${inv.issue_date}`, W - 40, 94, { align: "right" });
  if (inv.due_date) doc.text(`Vencimento: ${inv.due_date}`, W - 40, 108, { align: "right" });

  y = Math.max(y, 130);
  doc.setDrawColor(200); doc.line(40, y, W - 40, y); y += 14;

  // Entidade
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(inv.kind === "entrada" ? "Cliente" : "Fornecedor", 40, y);
  doc.setFont("helvetica", "normal").setFontSize(10);
  y += 14;
  doc.text(`${inv.entity_name ?? "—"}`, 40, y); y += 12;
  doc.text(`NIF: ${inv.entity_nif ?? "—"}`, 40, y); y += 12;
  if (inv.description) { doc.text(`Descrição: ${inv.description}`, 40, y); y += 12; }
  y += 6;

  const vatRate = vat?.rate ?? 0;
  autoTable(doc, {
    startY: y,
    head: [["Descrição", "Base (€)", `Taxa IVA`, "IVA (€)", "Total (€)"]],
    body: [[
      inv.description ?? "—",
      Number(inv.value_ex_vat ?? 0).toFixed(2),
      vat?.name ?? (vatRate ? `${vatRate}%` : "—"),
      Number(inv.vat_amount ?? 0).toFixed(2),
      Number(inv.total ?? 0).toFixed(2),
    ]],
    theme: "striped",
    headStyles: { fillColor: [30, 60, 120] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });

  y = (doc as any).lastAutoTable.finalY + 16;

  // Bloco IVA + centro custo
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("Detalhe fiscal", 40, y); y += 12;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const fiscal = [
    `IVA total: € ${Number(inv.vat_amount ?? 0).toFixed(2)}`,
    `IVA dedutível: € ${Number(inv.vat_deductible ?? 0).toFixed(2)}   (${inv.deduction_pct ?? 0}%)`,
    `IVA não dedutível: € ${Number(inv.vat_non_deductible ?? 0).toFixed(2)}`,
    `Centro de custo: ${cc?.name ?? "—"}`,
    `Forma de pagamento: ${pm?.name ?? "—"}`,
    `Estado: ${inv.status}`,
  ];
  fiscal.forEach((l) => { doc.text(l, 40, y); y += 12; });

  // Total destacado
  y += 8;
  doc.setDrawColor(30, 60, 120); doc.setLineWidth(1);
  doc.line(W - 220, y, W - 40, y); y += 16;
  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text(`TOTAL: € ${Number(inv.total ?? 0).toFixed(2)}`, W - 40, y, { align: "right" });

  // Rodapé dinâmico
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(100);
  
  if (company?.instagram_qr_url) {
    try { doc.addImage(company.instagram_qr_url, "PNG", W - 80, footerY - 50, 50, 50); } catch(e){}
  }

  const foot = [
    company?.iban ? `IBAN: ${company.iban}` : null,
    company?.website,
    company?.phone,
    company?.instagram_url ? `Instagram: ${company.instagram_url}` : null,
    company?.invoice_footer
  ].filter(Boolean) as string[];
  
  foot.forEach((l, i) => doc.text(l, 40, footerY + i * 10));


  doc.save(`${inv.code}.pdf`);
}
