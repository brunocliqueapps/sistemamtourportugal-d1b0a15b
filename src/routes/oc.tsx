import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/oc")({ component: OCList });

function OCList() {
  const { data = [] } = useQuery({
    queryKey: ["service-orders"],
    queryFn: async () => (await supabase.from("service_orders").select("*, clients(name), drivers(full_name), vehicles(plate)").order("service_date", { ascending: false })).data ?? [],
  });
  return (
    <div className="p-6 md:p-8 space-y-4">
      <PageHeader title="Ordens de Serviço (OC)" description="Todas as OCs geradas pelas propostas aprovadas." />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>OC</TableHead><TableHead>Voucher</TableHead><TableHead>Data</TableHead>
            <TableHead>Cliente</TableHead><TableHead>Trajeto</TableHead>
            <TableHead>Motorista</TableHead><TableHead>Veículo</TableHead>
            <TableHead>Estado</TableHead><TableHead className="text-right">Valor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell><Link to="/oc/$id" params={{ id: s.id }} className="text-primary hover:underline font-mono text-xs">{s.oc_code}</Link></TableCell>
                <TableCell className="font-mono text-xs">{s.voucher_code}</TableCell>
                <TableCell>{s.service_date} {s.start_time?.slice(0,5) ?? ""}</TableCell>
                <TableCell>{s.clients?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">{s.origin} → {s.destination}</TableCell>
                <TableCell>{s.drivers?.full_name ?? "—"}</TableCell>
                <TableCell>{s.vehicles?.plate ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                <TableCell className="text-right">€ {Number(s.sale_value||0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhuma OC ainda. Aprove uma proposta para gerar automaticamente.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
