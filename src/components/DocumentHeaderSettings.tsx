import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/** Cabeçalho usado na Proposta, Orçamento, Voucher e restantes impressões. */
export function DocumentHeaderSettings() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company_settings").select("*").maybeSingle()).data,
  });
  const [f, setF] = useState<any>({});
  useEffect(() => { if (data) setF(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_settings")
        .update({ ...f, updated_at: new Date().toISOString() }).eq("id", (data as any)!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Cabeçalho guardado"); qc.invalidateQueries({ queryKey: ["company"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const F = (k: string, label: string, type = "text") => (
    <div><Label>{label}</Label><Input type={type} value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );

  const preview = [
    [f.legal_name, f.trade_name ? `"${f.trade_name}"` : null].filter(Boolean).join(" "),
    f.address,
    [f.postal_code, f.city].filter(Boolean).join(" "),
    f.nif ? `NIF: ${f.nif}` : null,
    f.phone, f.email, f.doc_header_extra,
  ].filter(Boolean);

  return (
    <Card className="p-4 sm:p-6 space-y-4">
      <div>
        <div className="font-semibold">Proposta Comercial — cabeçalho dos documentos</div>
        <p className="text-xs text-muted-foreground">Estes dados aparecem na Proposta, Orçamento, Voucher e outros documentos impressos.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {F("legal_name", "Nome fiscal (Ex.: Façanha Prospera Unipessoal Lda)")}
        {F("trade_name", "Nome comercial (Ex.: Mtour Portugal)")}
        {F("address", "Morada")}
        {F("postal_code", "Código postal")}
        {F("city", "Cidade")}
        {F("nif", "NIF")}
        {F("phone", "Telefone")}
        {F("email", "Email", "email")}
        {F("website", "Website")}
        {F("iban", "IBAN")}
        {F("logo_url", "Logo (URL)")}
        <div className="md:col-span-2"><Label>Linha extra do cabeçalho (opcional)</Label>
          <Input value={f.doc_header_extra ?? ""} onChange={(e) => setF({ ...f, doc_header_extra: e.target.value })} />
        </div>
        <div className="md:col-span-2"><Label>Rodapé dos documentos</Label>
          <Textarea rows={2} value={f.doc_footer ?? ""} onChange={(e) => setF({ ...f, doc_footer: e.target.value })} />
        </div>
      </div>
      <div className="rounded-md border p-3 text-xs">
        <div className="text-muted-foreground mb-1">Pré-visualização do cabeçalho</div>
        {preview.map((l: any, i: number) => <div key={i} className={i === 0 ? "font-semibold text-sm" : ""}>{String(l)}</div>)}
      </div>
      <Button className="gradient-gold text-gold-foreground" onClick={() => save.mutate()}>Guardar</Button>
    </Card>
  );
}
