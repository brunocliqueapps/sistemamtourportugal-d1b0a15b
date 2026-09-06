import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { usePermissions } from "@/lib/permissions";
import { useMemo } from "react";

/**
 * Âmbito do motorista: quando o utilizador é apenas motorista, devolve os IDs das
 * ordens de serviço, propostas e clientes que lhe estão atribuídos, para que as
 * páginas mostrem só o que é dele.
 */
export function useDriverScope() {
  const { user } = useAuth();
  const { roles, isAdmin } = usePermissions();
  const isDriverOnly = !isAdmin && roles.includes("motorista");

  const { data: driver } = useQuery({
    queryKey: ["driver-scope-driver", user?.id],
    enabled: isDriverOnly && !!user,
    queryFn: async () =>
      (await supabase.from("drivers").select("id,full_name").eq("user_id", user!.id).maybeSingle()).data,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["driver-scope-orders", driver?.id],
    enabled: !!driver?.id,
    queryFn: async () =>
      (await supabase.from("service_orders").select("id,proposal_id,client_id").eq("driver_id", driver!.id)).data ?? [],
  });

  return useMemo(() => {
    const orderIds = new Set((orders as any[]).map((o) => o.id));
    const proposalIds = new Set((orders as any[]).map((o) => o.proposal_id).filter(Boolean) as string[]);
    const clientIds = new Set((orders as any[]).map((o) => o.client_id).filter(Boolean) as string[]);
    return {
      isDriverOnly,
      driverId: driver?.id ?? null,
      orderIds,
      proposalIds,
      clientIds,
      /** Filtra uma lista de ordens de serviço. */
      allowOrder: (id: string) => !isDriverOnly || orderIds.has(id),
      /** Filtra uma lista de propostas/vouchers. */
      allowProposal: (id: string) => !isDriverOnly || proposalIds.has(id),
    };
  }, [isDriverOnly, driver?.id, orders]);
}
