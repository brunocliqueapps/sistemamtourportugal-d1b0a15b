import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, Check, Eye } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import { generateVoucherPdf } from "@/lib/proposal-pdf";
import { shortCode } from "@/lib/codes";
import { fmtDate } from "@/lib/format-date";
import { useUnsavedChanges } from "@/lib/unsaved-changes-context";
import { paymentSchedule } from "@/lib/payment-terms";
import { useFinalizedProposalIds } from "@/lib/finalized";


import { QuickViewDialog } from "@/components/QuickViewDialog";


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
  const { hasUnsavedChanges, setHasUnsavedChanges } = useUnsavedChanges();
  const [clientId, setClientId] = useState("");

  const [proposalId, setProposalId] = useState("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any | null>(null);

  const { data: clients = [] } = useQuery({ queryKey: ["clients-voucher"], queryFn: async () => (await (supabase.from("clients") as any).select("*").order("name")).data ?? [] });
  const { data: props = [] } = useQuery({
    queryKey: ["proposals-voucher", clientId],
    enabled: !!clientId,
    queryFn: async () => (await (supabase.from("proposals") as any).select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: validated = [], refetch: refetchValidated } = useQuery({
    queryKey: ["proposals-voucher-validated"],
    queryFn: async () => (await (supabase.from("proposals") as any).select("*,clients(*)").not("voucher_validated_at", "is", null).order("voucher_validated_at", { ascending: false })).data ?? [],
  });


  const c: any = useMemo(() => clients.find((x: any) => x.id === clientId), [clients, clientId]);
  const p: any = useMemo(() => props.find((x: any) => x.id === proposalId), [props, proposalId]);
  const [localNotes, setLocalNotes] = useState<any[]>([]);
  const [localFinalNote, setLocalFinalNote] = useState("");

  useEffect(() => {
    if (p) {
      setLocalNotes(Array.isArray(p.voucher_day_notes) ? p.voucher_day_notes : []);
      setLocalFinalNote(p.voucher_final_note || "");
    }
  }, [p]);

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
            <Select value={clientId} onValueChange={(v) => { 
              if (hasUnsavedChanges && !confirm("Deseja sair sem validar/guardar?")) return;
              setClientId(v); setProposalId(""); setHasUnsavedChanges(false);
            }}>
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
              <div>Chegada: <span className="font-medium">{[fmtDate(p.arrival_date), p.arrival_time, p.arrival_place].filter(Boolean).join(" · ") || "—"}</span></div>
              <div>Saída: <span className="font-medium">{[fmtDate(p.departure_date), p.departure_time, p.departure_place].filter(Boolean).join(" · ") || "—"}</span></div>
            </div>

            {Array.isArray(p.itinerary) && p.itinerary.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead className="w-32">Data</TableHead><TableHead>Serviço contratado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {p.itinerary.map((d: any, i: number) => {
                    const currentNote = localNotes.find((n: any) => n.date === d.date)?.note || "";
                    
                    return (
                      <TableRow key={i}>
                        <TableCell className="align-top">
                          <div className="font-mono text-xs">{fmtDate(d.date)}</div>
                        </TableCell>
                        <TableCell className="space-y-3">
                          <div className="whitespace-pre-wrap text-sm">{d.text || "—"}</div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase text-muted-foreground">Orientações para este dia</Label>
                            <Textarea 
                              placeholder="Escreva orientações específicas para este dia..."
                              value={currentNote}
                              className="min-h-[80px] text-sm"
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                const newNote = e.target.value;
                                setHasUnsavedChanges(true);
                                setLocalNotes(prev => {
                                  const next = [...prev];
                                  const idx = next.findIndex((n: any) => n.date === d.date);
                                  if (idx >= 0) next[idx] = { ...next[idx], note: newNote };
                                  else next.push({ date: d.date, note: newNote });
                                  return next;
                                });
                              }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            <div className="rounded-md border p-3 space-y-2">
              <div className="font-semibold text-sm">Proposta de pagamento</div>
              <div className="text-sm">Valor total: <span className="font-medium">€ {Number(p.total_value || 0).toFixed(2)}</span></div>
              <Table>
                <TableHeader><TableRow><TableHead>Etapa</TableHead><TableHead className="w-20">%</TableHead><TableHead className="text-right w-32">Valor (€)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(Array.isArray(p.payment_stages) && p.payment_stages.length
                    ? p.payment_stages.map((s: any) => ({ label: s.label ?? "Etapa", pct: Number(s.pct || 0), value: Number(p.total_value || 0) * Number(s.pct || 0) / 100 }))
                    : paymentSchedule(p.days_count ?? 1, p.total_value)
                  ).map((s: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{s.label}</TableCell>
                      <TableCell>{s.pct}%</TableCell>
                      <TableCell className="text-right">{Number(s.value || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {p.payment_terms && <div className="text-sm text-muted-foreground">{p.payment_terms}</div>}
            </div>

            <div className="space-y-2 mt-4">
              <Label>Nota Final</Label>
              <Textarea 
                placeholder="Escrita final para o voucher..."
                value={localFinalNote}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setHasUnsavedChanges(true);
                  setLocalFinalNote(e.target.value);
                }}
              />
            </div>



            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => generateVoucherPdf(p.id).catch((e) => toast.error(e.message))}>
                <FileDown className="h-4 w-4 mr-1" /> Descarregar PDF
              </Button>
              <Button className="gradient-gold text-gold-foreground" onClick={async () => {
                const { error } = await (supabase.from("proposals") as any).update({ 
                  voucher_validated_at: new Date().toISOString(),
                  voucher_final_note: localFinalNote,
                  voucher_day_notes: localNotes
                }).eq("id", p.id);
                if (error) return toast.error(error.message);
                toast.success("Voucher guardado e validado");
                setHasUnsavedChanges(false);
                refetchValidated();
              }}><Check className="h-4 w-4 mr-1" /> Guardar e Validar Voucher</Button>
            </div>
          </>
        )}
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-semibold text-sm mb-2">Vouchers validados</div>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Validado</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {activeVouchers.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{new Date(x.voucher_validated_at).toLocaleString("pt-PT")}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" title="Visualizar Voucher" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Descarregar PDF" onClick={() => generateVoucherPdf(x.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {activeVouchers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Nenhum voucher validado em atendimento.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="p-4 mt-4">
        <div className="font-semibold text-sm">Histórico</div>
        <div className="text-xs text-muted-foreground mb-2">Vouchers de serviços já finalizados.</div>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Cliente</TableHead><TableHead>Validado</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
          <TableBody>
            {historyVouchers.map((x: any) => (
              <TableRow key={x.id}>
                <TableCell className="font-mono text-xs">{shortCode(x.code)}</TableCell>
                <TableCell>{x.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-xs">{new Date(x.voucher_validated_at).toLocaleString("pt-PT")}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" title="Visualizar Voucher" onClick={() => setViewing(x)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Descarregar PDF" onClick={() => generateVoucherPdf(x.id).catch((e) => toast.error(e.message))}><FileDown className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
            {historyVouchers.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">Sem serviços finalizados.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>


      <QuickViewDialog
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Voucher"
        record={viewing}
        fields={[
          { key: "code", label: "Nº do Voucher", format: (v: any) => shortCode(v) },
          { key: "clients", label: "Cliente", format: (v: any) => v?.name ?? "—" },
          { key: "passengers", label: "Nº de pessoas" },
          { key: "responsible", label: "Responsável" },
          { key: "arrival_date", label: "Chegada", format: (v: any, r: any) => [fmtDate(v), r?.arrival_time, r?.arrival_place].filter(Boolean).join(" · ") || "—" },
          { key: "departure_date", label: "Saída", format: (v: any, r: any) => [fmtDate(v), r?.departure_time, r?.departure_place].filter(Boolean).join(" · ") || "—" },
          {
            key: "itinerary",
            label: "Serviços contratados",
            fullWidth: true,
            format: (v: any) => {
              const list = Array.isArray(v) ? v.filter((d: any) => !d.deleted) : [];
              if (!list.length) return "—";
              return (
                <div className="space-y-2">
                  {list.map((d: any, i: number) => (
                    <div key={`${d.date}-${i}`} className="border-b border-border/50 pb-2 last:border-0">
                      <div className="text-xs text-muted-foreground">Dia {i + 1} · {fmtDate(d.date) || "—"}</div>
                      <div className="break-words">{d.text?.trim() || "—"}</div>
                    </div>
                  ))}
                </div>
              );
            },
          },
          {
            key: "voucher_day_notes",
            label: "Orientações por dia",
            fullWidth: true,
            format: (v: any) => {
              const notes = Array.isArray(v) ? v.filter((n: any) => n.note?.trim()) : [];
              if (!notes.length) return "—";
              return (
                <div className="space-y-2">
                  {notes.map((n: any, i: number) => (
                    <div key={`${n.date}-${i}`}><span className="text-xs text-muted-foreground">{fmtDate(n.date) || "—"}</span><div>{n.note}</div></div>
                  ))}
                </div>
              );
            },
          },
          { key: "total_value", label: "Valor total", format: (v: any) => `€ ${Number(v || 0).toFixed(2)}` },
          { key: "payment_terms", label: "Forma de pagamento", fullWidth: true },
          { key: "voucher_final_note", label: "Nota final", fullWidth: true },
          { key: "voucher_validated_at", label: "Validado em", format: (v: any) => v ? new Date(v).toLocaleString("pt-PT") : "—" },
        ]}
      />
    </div>
  );
}
