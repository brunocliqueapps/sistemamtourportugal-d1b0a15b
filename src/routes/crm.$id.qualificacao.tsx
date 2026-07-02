import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/crm/$id/qualificacao")({ component: Q });

function Q() {
  const { id } = Route.useParams();
  const [form, setForm] = useState({ passenger_count: 1, profile: "familia", language: "pt", special_needs: "", accommodation: "" });

  const { data: lead } = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => (await supabase.from("leads").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: existing } = useQuery({
    queryKey: ["qual", id],
    queryFn: async () => (await supabase.from("client_qualifications").select("*").eq("lead_id", id).maybeSingle()).data,
  });

  useEffect(() => { if (existing) setForm({ ...form, ...existing }); }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (existing?.id) {
        const { error } = await supabase.from("client_qualifications").update(form).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_qualifications").insert({ ...form, lead_id: id });
        if (error) throw error;
      }
      await supabase.from("leads").update({ status: "qualificado" }).eq("id", id);
    },
    onSuccess: () => toast.success("Qualificação guardada"),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <PageHeader title="Qualificação do Cliente" description={lead ? `Lead: ${lead.name}` : ""} />
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Nº de passageiros</Label><Input type="number" min={1} value={form.passenger_count} onChange={(e) => setForm({ ...form, passenger_count: Number(e.target.value) })} /></div>
          <div>
            <Label>Perfil</Label>
            <Select value={form.profile} onValueChange={(v) => setForm({ ...form, profile: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="familia">Família</SelectItem>
                <SelectItem value="casal">Casal</SelectItem>
                <SelectItem value="corporativo">Corporativo</SelectItem>
                <SelectItem value="grupo">Grupo</SelectItem>
                <SelectItem value="solo">Solo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Idioma</Label>
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="es">Espanhol</SelectItem>
                <SelectItem value="en">Inglês</SelectItem>
                <SelectItem value="fr">Francês</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Hospedagem</Label><Input value={form.accommodation} onChange={(e) => setForm({ ...form, accommodation: e.target.value })} /></div>
        </div>
        <div><Label>Necessidades especiais</Label><Input value={form.special_needs} onChange={(e) => setForm({ ...form, special_needs: e.target.value })} /></div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-gold text-gold-foreground">Salvar Qualificação</Button>
      </Card>
    </div>
  );
}
