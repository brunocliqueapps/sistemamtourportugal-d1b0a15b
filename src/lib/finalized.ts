import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Estado operacional que marca um atendimento como concluído (vai para o Histórico). */
export const FINALIZED_STATUS = "atendimento_finalizado";

/**
 * IDs das propostas cujo atendimento (OS) já foi finalizado.
 * Usado para separar "Histórico" dos serviços futuros ou em atendimento.
 */
export function useFinalizedProposalIds() {
  const { data = [] } = useQuery({
    queryKey: ["finalized-proposal-ids"],
    queryFn: async () =>
      (await supabase
        .from("service_orders")
        .select("proposal_id")
        .eq("status", FINALIZED_STATUS)).data ?? [],
  });
  return new Set(
    (data as any[]).map((r: any) => r.proposal_id).filter(Boolean) as string[],
  );
}
