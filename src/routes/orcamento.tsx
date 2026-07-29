import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { daysBetween, paymentSchedule, suggestPaymentTerms } from "@/lib/payment-terms";
import { generateBudgetPdf } from "@/lib/proposal-pdf";

export const Route = createFileRoute("/orcamento")({
  component: Orcamento,
  head: () => ({
    meta: [
      { title: "Orçamento — Mtour Portugal" },
      { name: "description", content: "Gera orçamentos a partir das propostas com valores e condições de pagamento em PDF." },
      { property: "og:title", content: "Orçamento — Mtour Portugal" },
      { property: "og:description", content: "Orçamentos com valores e condições de pagamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Orcamento() {
  const [selected, setSelected] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [terms, setTerms] = useState<string>("");

  const { data: props = [], refetch } = useQuery({
    queryKey: ["proposals-orcamento"],
    queryFn: async () => (await supabase.from("proposals").select("*, clients(*)").order("created_at", { ascending: false })).data ?? [],
  });

  const p: any = useMemo(() => props.find((x: any) => x.id === selected), [props, selected]);
  const days = p ? (p.days_count ?? daysBetween(p.itinerary_start, p.itinerary_end) ?? 1) : 1;
  const total = Number(value || p?.total_value || 0);

  async function save() {
    if (!p) return;
    const { error } = await supabase.from("proposals")
      .update({ total_value: total, payment_terms: terms || p.payment_terms || suggestPaymentTerms(days || 1) })
      .eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Orçamento atualizado");
    refetch();
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Orçamento" description="Puxa os dados da proposta, define valor e condições de pagamento e gera o PDF." />

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2"><Label>Proposta</Label>
            <Select value={selected} onValueChange={(v) => {
              setSelected(v);
              const pr: any = props.find((x: any) => x.id === v);
              setValue(String(pr?.total_value ?? 0));
              setTerms(pr?.payment_terms ?? suggestPaymentTerms(pr?.days_count ?? 1));
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar proposta" /></SelectTrigger>
              <SelectContent>
                {props.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.code ?? "—"} · {x.clients?.name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor total (€)</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} /></div>
        </div>

        {p && (
          <>
            <div className="rounded-md border p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>Nº Cliente: <span className="font-medium">{p.clients?.client_number ?? "—"}</span></div>
              <div>Cliente: <span className="font-medium">{p.clients?.name ?? "—"}</span></div>
              <div>Responsável: <span className="font-medium">{p.responsible ?? "—"}</span></div>
              <div>Pessoas: <span className="font-medium">{p.passengers ?? "—"}</span></div>
              <div>Dias: <span className="font-medium">{days || "—"}</span></div>
              <div>Tipo: <span className="font-medium">{p.proposal_kind === "servico_privado" ? "Serviço Privado" : "Roteiro Personalizado"}</span></div>
              <div className="sm:col-span-3">Chegada: {[p.arrival_date, p.arrival_time, p.arrival_place].filter(Boolean).join(" · ") || "—"}</div>
              <div className="sm:col-span-3">Saída: {[p.departure_date, p.departure_time, p.departure_place].filter(Boolean).join(" · ") || "—"}</div>
            </div>

            <div><Label>Condições de pagamento</Label><Input value={terms} onChange={(e) => setTerms(e.target.value)} /></div>

            <Table>
              <TableHeader><TableRow><TableHead>Etapa</TableHead><TableHead>%</TableHead><TableHead className="text-right">Valor (€)</TableHead></TableRow></TableHeader>
              <TableBody>
                {paymentSchedule(days || 1, total).map((s) => (
                  <TableRow key={s.label}>
                    <TableCell>{s.label}</TableCell><TableCell>{s.pct}%</TableCell>
                    <TableCell className="text-right">{s.value.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={save}>Guardar</Button>
              <Button className="gradient-gold text-gold-foreground" onClick={async () => { await save(); generateBudgetPdf(p.id).catch((e) => toast.error(e.message)); }}>
                <FileDown className="h-4 w-4 mr-1" /> Gerar PDF do orçamento
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
