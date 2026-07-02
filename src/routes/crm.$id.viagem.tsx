import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/crm/$id/viagem")({ component: V });

const INTERESSES = ["Gastronomia", "Vinhos", "História", "Praia", "Natureza", "Compras", "Fado", "Futebol"];

function V() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    arrival_datetime: "", arrival_flight: "", departure_datetime: "", departure_flight: "",
    objective: "lazer", interests: [] as string[],
  });

  const { data: existing } = useQuery({
    queryKey: ["travel", id],
    queryFn: async () => (await supabase.from("travels").select("*").eq("lead_id", id).maybeSingle()).data,
  });
  useEffect(() => { if (existing) setForm({ ...form, ...existing, interests: existing.interests ?? [] }); }, [existing]);

  const dias = form.arrival_datetime && form.departure_datetime
    ? Math.max(0, Math.ceil((new Date(form.departure_datetime).getTime() - new Date(form.arrival_datetime).getTime()) / 86400000))
    : 0;

  const save = useMutation({
    mutationFn: async () => {
      const payload = { ...form, lead_id: id, user_id: user?.id };
      if (existing?.id) {
        const { error } = await supabase.from("travels").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("travels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => toast.success("Viagem guardada"),
    onError: (e: any) => toast.error(e.message),
  });

  function toggle(i: string) {
    setForm((f: any) => ({ ...f, interests: f.interests.includes(i) ? f.interests.filter((x: string) => x !== i) : [...f.interests, i] }));
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl">
      <PageHeader title="Dados da Viagem" description={`Duração calculada: ${dias} dia(s)`} />
      <Card className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Chegada (data/hora)</Label><Input type="datetime-local" value={form.arrival_datetime?.slice(0,16) || ""} onChange={(e) => setForm({ ...form, arrival_datetime: e.target.value })} /></div>
          <div><Label>Voo Chegada</Label><Input value={form.arrival_flight} onChange={(e) => setForm({ ...form, arrival_flight: e.target.value })} /></div>
          <div><Label>Partida (data/hora)</Label><Input type="datetime-local" value={form.departure_datetime?.slice(0,16) || ""} onChange={(e) => setForm({ ...form, departure_datetime: e.target.value })} /></div>
          <div><Label>Voo Partida</Label><Input value={form.departure_flight} onChange={(e) => setForm({ ...form, departure_flight: e.target.value })} /></div>
        </div>
        <div>
          <Label>Objetivo da Viagem</Label>
          <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lazer">Lazer</SelectItem>
              <SelectItem value="negocios">Negócios</SelectItem>
              <SelectItem value="lua-de-mel">Lua-de-mel</SelectItem>
              <SelectItem value="familia">Família</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-2 block">Interesses</Label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INTERESSES.map((i) => (
              <label key={i} className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.interests.includes(i)} onCheckedChange={() => toggle(i)} />
                {i}
              </label>
            ))}
          </div>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gradient-gold text-gold-foreground">Salvar Viagem</Button>
      </Card>
    </div>
  );
}
