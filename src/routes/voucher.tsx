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
import { generateVoucherPdf } from "@/lib/proposal-pdf";
import { shortCode } from "@/lib/codes";

export const Route = createFileRoute("/voucher")({
  component: Voucher,
  head: () => ({
    meta: [
      { title: "Voucher — Mtour Portugal" },
      { name: "description", content: "Descritivo completo da viagem por cliente com todos os dados e emissão de voucher em PDF." },
      { property: "og:title", content: "Voucher — Mtour Portugal" },
      { property: "og:description", content: "Descritivo completo da viagem por cliente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Voucher() {
  const [clientId, setClientId] = useState("");
  const [proposalId, setProposalId] = useState("");
  const [search, setSearch] = useState("");

  const { data: clients = [] } = useQuery({ queryKey: ["clients-voucher"], queryFn: async () => (await supabase.from("clients").select("*").order("name")).data ?? [] });
  const { data: props = [] } = useQuery({
    queryKey: ["proposals-voucher", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase.from("proposals").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });

  const c: any = useMemo(() => clients.find((x: any) => x.id === clientId), [clients, clientId]);
  const p: any = useMemo(() => props.find((x: any) => x.id === proposalId), [props, proposalId]);
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients as any[];
    return (clients as any[]).filter((x: any) =>
      [x.name, x.client_number, x.nif, x.email, x.phone].filter(Boolean).some((v: any) => String(v).toLowerCase().includes(q)));
  }, [clients, search]);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <PageHeader title="Voucher" description="Descritivo completo da viagem, com todos os dados do cliente." />

      <Card className="p-4 space-y-4">
        <div><Label>Buscar cliente</Label><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, nº cliente, NIF, email…" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><Label>Cliente</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setProposalId(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>{filteredClients.map((x: any) => <SelectItem key={x.id} value={x.id}>{x.client_number ? `${shortCode(x.client_number)} · ` : ""}{x.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Proposta / Roteiro</Label>
            <Select value={proposalId} onValueChange={setProposalId} disabled={!clientId}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{props.map((x: any) => <SelectItem key={x.id} value={x.id}>{shortCode(x.code)} · {x.title ?? ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {c && (
          <div className="rounded-md border p-3 text-sm grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>Nº Cliente: <span className="font-medium">{shortCode(c.client_number)}</span></div>
            <div>Nome: <span className="font-medium">{c.name}</span></div>
            <div>NIF/Passaporte: <span className="font-medium">{c.nif ?? "—"}</span></div>
            <div>Telefone: <span className="font-medium">{[c.phone_country, c.phone].filter(Boolean).join(" ") || "—"}</span></div>
            <div>Email: <span className="font-medium">{c.email ?? "—"}</span></div>
            <div>Nascimento: <span className="font-medium">{c.birth_date ?? "—"}</span></div>
            <div>Emergência: <span className="font-medium">{c.emergency_contact ?? "—"}</span></div>
            <div className="sm:col-span-2">Morada: <span className="font-medium">{[c.address, c.postal_code, c.city, c.country].filter(Boolean).join(", ") || "—"}</span></div>
          </div>
        )}

        {p && (
          <>
            <div className="rounded-md border p-3 text-sm grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>Pessoas: <span className="font-medium">{p.passengers ?? "—"}</span></div>
              <div>Responsável: <span className="font-medium">{p.responsible ?? "—"}</span></div>
              <div>Chegada: <span className="font-medium">{[p.arrival_date, p.arrival_time, p.arrival_place].filter(Boolean).join(" · ") || "—"}</span></div>
              <div>Saída: <span className="font-medium">{[p.departure_date, p.departure_time, p.departure_place].filter(Boolean).join(" · ") || "—"}</span></div>
            </div>

            {Array.isArray(p.itinerary) && p.itinerary.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead className="w-32">Data</TableHead><TableHead>Serviço contratado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {p.itinerary.map((d: any, i: number) => (
                    <TableRow key={i}><TableCell className="font-mono text-xs">{d.date}</TableCell><TableCell className="whitespace-pre-wrap">{d.text || "—"}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            )}


            <div className="flex justify-end">
              <Button className="gradient-gold text-gold-foreground" onClick={() => generateVoucherPdf(p.id).catch((e) => toast.error(e.message))}>
                <FileDown className="h-4 w-4 mr-1" /> Gerar Voucher PDF
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
