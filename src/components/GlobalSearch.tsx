import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Result = { module: string; label: string; sublabel?: string; to: string };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      if (!q && !from && !to) { setResults([]); return; }
      setLoading(true);
      const term = q ? `%${q}%` : "%";
      const or = (cols: string[]) => cols.map((c) => `${c}.ilike.${term}`).join(",");

      const rangeCol = (col: string, base: any) => {
        let x = base;
        if (from) x = x.gte(col, from);
        if (to) x = x.lte(col, to);
        return x;
      };

      const [leads, props, ocs, invs, clis] = await Promise.all([
        rangeCol("created_at", supabase.from("leads").select("id,code,name,email,phone,created_at").or(or(["name","email","phone","code"])).limit(10)),
        rangeCol("created_at", supabase.from("proposals").select("id,code,title,client_name,created_at").or(or(["code","title","client_name"])).limit(10)),
        rangeCol("service_date", supabase.from("service_orders").select("id,code,voucher_code,client_name,service_date").or(or(["code","voucher_code","client_name"])).limit(10)),
        rangeCol("issue_date", supabase.from("invoices").select("id,code,invoice_number,entity_name,entity_nif,issue_date").or(or(["code","invoice_number","entity_name","entity_nif"])).limit(10)),
        rangeCol("created_at", supabase.from("clients").select("id,name,email,nif,created_at").or(or(["name","email","nif","phone"])).limit(10)),
      ]);

      const out: Result[] = [];
      for (const l of leads.data ?? []) out.push({ module: "Lead", label: `${l.code} · ${l.name}`, sublabel: l.email, to: "/crm" });
      for (const p of props.data ?? []) out.push({ module: "Proposta", label: `${p.code} · ${p.title ?? p.client_name}`, to: "/propostas" });
      for (const o of ocs.data ?? []) out.push({ module: "OC / Voucher", label: `${o.code} · ${o.voucher_code ?? ""} · ${o.client_name ?? ""}`, sublabel: o.service_date, to: `/oc/${o.id}` });
      for (const i of invs.data ?? []) out.push({ module: "Fatura", label: `${i.code} · ${i.invoice_number ?? ""} · ${i.entity_name ?? ""}`, sublabel: `NIF ${i.entity_nif ?? "—"} · ${i.issue_date}`, to: "/financeiro" });
      for (const c of clis.data ?? []) out.push({ module: "Cliente", label: c.name, sublabel: `${c.email ?? ""} · NIF ${c.nif ?? "—"}`, to: "/cadastros" });
      setResults(out);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, from, to, open]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="gap-2 h-10 md:h-9 px-3 bg-transparent text-current border-current/40 hover:bg-current/10 hover:text-current"
      >
        <Search className="h-4 w-4 shrink-0 opacity-90" />
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden md:inline text-[10px] px-1 py-0.5 border border-current/40 rounded">⌘K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Busca global</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input autoFocus placeholder="Nome, email, NIF, código, voucher…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">De</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            </div>
            <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
              {loading && <div className="p-3 text-sm text-muted-foreground">A pesquisar…</div>}
              {!loading && results.length === 0 && <div className="p-3 text-sm text-muted-foreground">Sem resultados.</div>}
              {results.map((r, i) => (
                <button key={i} className="w-full text-left p-3 hover:bg-accent"
                  onClick={() => { setOpen(false); nav({ to: r.to }); }}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{r.module}</div>
                  <div className="text-sm font-medium">{r.label}</div>
                  {r.sublabel && <div className="text-xs text-muted-foreground">{r.sublabel}</div>}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
