import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function toNum(v?: string | null) {
  if (!v) return 0;
  const m = String(v).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

export function formatClientNumber(n: number) {
  return `C${String(n).padStart(5, "0")}`;
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
