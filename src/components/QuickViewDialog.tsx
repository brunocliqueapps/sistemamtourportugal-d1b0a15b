import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface QuickViewField {
  key: string;
  label: string;
  format?: (value: any, row: any) => any;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  record: any | null;
  fields?: QuickViewField[]; // se omitido mostra tudo
  hideKeys?: string[];
}

const HIDDEN_DEFAULT = ["id", "created_by", "updated_by", "user_id", "created_at", "updated_at"];

function fmtValue(v: any) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) { try { return new Date(v).toLocaleString("pt-PT"); } catch { return v; } }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v).toLocaleDateString("pt-PT");
    return v;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function humanize(k: string) {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function QuickViewDialog({ open, onClose, title, record, fields, hideKeys = [] }: Props) {
  if (!record) return null;
  const entries: { label: string; value: any }[] = fields
    ? fields.map((f) => ({ label: f.label, value: f.format ? f.format(record[f.key], record) : fmtValue(record[f.key]) }))
    : Object.keys(record)
        .filter((k) => !HIDDEN_DEFAULT.includes(k) && !hideKeys.includes(k))
        .map((k) => ({ label: humanize(k), value: fmtValue(record[k]) }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {title ?? "Detalhes"}
            {record.code && <Badge variant="outline" className="font-mono text-xs">{record.code}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {entries.map((e, i) => (
            <div key={i} className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{e.label}</div>
              <div className="font-medium break-words">{e.value ?? "—"}</div>
            </div>
          ))}
        </div>
        {record.created_at && (
          <div className="mt-2 border-t pt-3 text-xs text-muted-foreground">
            Registado em {fmtValue(record.created_at)}
            {record.updated_at && record.updated_at !== record.created_at && (
              <> · Última atualização: {fmtValue(record.updated_at)}</>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
