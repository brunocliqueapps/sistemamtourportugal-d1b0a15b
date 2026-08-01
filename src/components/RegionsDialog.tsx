import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function RegionsDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data: regions = [] } = useQuery({
    queryKey: ["regions"],
    queryFn: async () => (await supabase.from("regions").select("*").order("name")).data ?? [],
  });

  const add = useMutation({
    mutationFn: async () => {
      const value = name.trim();
      if (!value) throw new Error("Indique o nome da região");
      const { error } = await supabase.from("regions").insert({ name: value });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Região incluída");
      setName("");
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["crud-remote-options"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("regions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Região removida");
      qc.invalidateQueries({ queryKey: ["regions"] });
      qc.invalidateQueries({ queryKey: ["crud-remote-options"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <MapPin className="h-4 w-4 mr-1" /> Incluir Região
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Regiões</DialogTitle></DialogHeader>
          <div className="flex gap-2">
            <Input placeholder="Nova região (ex.: Lisboa)" value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add.mutate(); }} />
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="gradient-gold text-gold-foreground">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="divide-y rounded-md border">
            {regions.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sem regiões.</p>}
            {regions.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>{r.name}</span>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover região?")) del.mutate(r.id); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
