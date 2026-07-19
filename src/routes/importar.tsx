import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePermissions } from "@/lib/permissions";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/importar")({ component: Importar });

type EntityKey = "clients" | "drivers" | "vehicles" | "expenses";

const SPECS: Record<EntityKey, { label: string; required: string[]; optional: string[]; hint?: string }> = {
  clients: { label: "Clientes", required: ["name"], optional: ["nif","email","phone","city","country","address","notes"] },
  drivers: { label: "Motoristas", required: ["full_name"], optional: ["phone","email","license_number","license_expiry","tvde_card_number","tvde_card_expiry","hire_date","active"] },
  vehicles: { label: "Veículos", required: ["plate"], optional: ["brand","model","year","color","seats","fuel_type","operates_tvde","insurance_expiry","inspection_expiry","iuc_expiry","tvde_license_expiry","active"] },
  expenses: { label: "Despesas (faturas de saída)", required: ["issue_date","entity_name","value_ex_vat"], optional: ["invoice_number","series","entity_nif","description","total","status","payment_method_id","cost_center_id"], hint: "Cria faturas com kind='saida'. Se 'total' vazio, é igual a value_ex_vat." },
};

function Importar() {
  const { isAdmin, loading } = usePermissions();
  const { user } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !isAdmin) nav({ to: "/dashboard" }); }, [loading, isAdmin, nav]);

  const [entity, setEntity] = useState<EntityKey>("clients");
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const spec = SPECS[entity];

  const onFile = (f: File | null) => {
    if (!f) return;
    Papa.parse(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        setHeaders(res.meta.fields ?? []);
        setRows(res.data as any[]);
      },
    });
  };

  const validateRow = (r: Record<string, any>) => {
    const missing = spec.required.filter((k) => !r[k] || String(r[k]).trim() === "");
    return missing.length ? `Faltam: ${missing.join(", ")}` : null;
  };

  const missingCols = spec.required.filter((c) => !headers.includes(c));

  const doImport = async () => {
    setBusy(true);
    try {
      const clean = rows.map((r) => {
        const obj: any = {};
        [...spec.required, ...spec.optional].forEach((k) => {
          if (r[k] !== undefined && r[k] !== "") obj[k] = r[k];
        });
        return obj;
      }).filter((r) => !validateRow(r));

      if (clean.length === 0) { toast.error("Nada válido para importar"); setBusy(false); return; }

      if (entity === "expenses") {
        const payload = clean.map((r) => ({
          ...r,
          kind: "saida",
          value_ex_vat: Number(r.value_ex_vat || 0),
          total: Number(r.total || r.value_ex_vat || 0),
          vat_amount: 0, vat_deductible: 0, vat_non_deductible: 0,
          created_by: user!.id,
        }));
        const { error } = await supabase.from("invoices").insert(payload);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(entity).insert(clean);
        if (error) throw error;
      }
      toast.success(`${clean.length} registos importados`);
      setRows([]); setHeaders([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const cols = [...spec.required, ...spec.optional];
    const csv = cols.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `template-${entity}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      <PageHeader title="Importação CSV" description="Importe clientes, motoristas, veículos ou despesas em lote." />
      <Card className="p-6 space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Entidade</Label>
            <Select value={entity} onValueChange={(v) => { setEntity(v as EntityKey); setRows([]); setHeaders([]); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(SPECS) as EntityKey[]).map((k) => <SelectItem key={k} value={k}>{SPECS[k].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ficheiro CSV</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="flex items-end"><Button variant="outline" onClick={downloadTemplate}>Baixar template</Button></div>
        </div>
        <div className="text-xs text-muted-foreground">
          Colunas obrigatórias: <b>{spec.required.join(", ")}</b>. Opcionais: {spec.optional.join(", ")}. {spec.hint}
        </div>
      </Card>

      {rows.length > 0 && (
        <Card>
          <div className="p-4 flex items-center justify-between">
            <div className="text-sm">
              Pré-visualização: <b>{rows.length}</b> linhas.{" "}
              {missingCols.length > 0 && <span className="text-destructive">Faltam colunas obrigatórias: {missingCols.join(", ")}</span>}
            </div>
            <Button className="gradient-gold text-gold-foreground" onClick={doImport} disabled={busy || missingCols.length > 0}>
              {busy ? "A importar…" : "Confirmar importação"}
            </Button>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader><TableRow>
                <TableHead>#</TableHead><TableHead>Estado</TableHead>
                {[...spec.required, ...spec.optional].map((c) => <TableHead key={c}>{c}</TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r, i) => {
                  const err = validateRow(r);
                  return (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{err ? <Badge variant="destructive">{err}</Badge> : <Badge>OK</Badge>}</TableCell>
                      {[...spec.required, ...spec.optional].map((c) => <TableCell key={c} className="text-xs">{r[c] ?? ""}</TableCell>)}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {rows.length > 200 && <div className="p-3 text-xs text-muted-foreground">Mostrando 200 de {rows.length}.</div>}
          </div>
        </Card>
      )}
    </div>
  );
}
