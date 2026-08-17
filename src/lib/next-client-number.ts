import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Só aceita o padrão curto C1..C99999 — ignora números antigos em formato de data. */
function toNum(v?: string | null) {
  const m = String(v ?? "").match(/^C(\d{1,5})$/i);
  return m ? Number(m[1]) : 0;
}

export function formatClientNumber(n: number) {
  return `C${String(n).padStart(2, "0")}`;
}

/** Próximo nº de cliente da sequência partilhada leads + clientes. */
export function useNextClientNumber() {
  const { data } = useQuery({
    queryKey: ["next-client-number"],
    queryFn: async () => {
      const [c, l] = await Promise.all([
        supabase.from("clients").select("client_number"),
        supabase.from("leads").select("client_number"),
      ]);
      const all = [...(c.data ?? []), ...(l.data ?? [])].map((r: any) => toNum(r.client_number));
      const max = all.length ? Math.max(...all) : 0;
      return formatClientNumber(max + 1);
    },
    staleTime: 0,
  });
  return data ?? null;
}
