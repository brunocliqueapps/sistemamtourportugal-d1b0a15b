import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "admin" | "comercial" | "administrativo" | "motorista";
export type ModuleKey =
  | "dashboard" | "agenda" | "crm" | "propostas" | "voucher" | "oc" | "operacao" | "tvde"
  | "financeiro" | "conta_corrente" | "fechamento" | "relatorios"
  | "cadastros" | "pos_venda" | "importar" | "configuracoes" | "alertas";

/** Mapa de rota -> módulo de permissão (rotas não listadas são livres) */
export const ROUTE_MODULES: Record<string, ModuleKey> = {
  "/dashboard": "dashboard",
  "/clientes": "cadastros",
  "/propostas": "propostas",
  "/orcamento": "propostas",
  "/voucher": "voucher",
  "/oc": "oc",
  "/agenda": "agenda",
  "/relatorio-diario": "agenda",
  "/roteiro": "operacao",
  "/servicos-privados": "operacao",
  "/tvde": "tvde",
  "/financeiro": "financeiro",
  "/conta-corrente": "conta_corrente",
  "/custos-fixos": "conta_corrente",
  "/comissoes": "conta_corrente",
  "/fechamento": "fechamento",
  "/relatorios": "relatorios",
  "/pos-venda": "pos_venda",
  "/cadastros": "cadastros",
  "/alertas": "alertas",
  "/importar": "importar",
  "/configuracoes": "configuracoes",
};

export function moduleForPath(pathname: string): ModuleKey | null {
  const hit = Object.keys(ROUTE_MODULES)
    .filter((p) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? ROUTE_MODULES[hit]! : null;
}

export function usePermissions() {
  const { user } = useAuth();
  const { data, isLoading, isFetching, isError } = useQuery({
    enabled: !!user,
    queryKey: ["perms", user?.id],
    queryFn: async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user?.id ?? ""),
        supabase.from("role_permissions").select("role,module"),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (permsRes.error) throw permsRes.error;
      const roles = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
      const allowed = new Set<string>();
      for (const p of permsRes.data ?? []) {
        if (roles.includes(p.role as AppRole)) allowed.add(p.module);
      }
      return { roles, modules: allowed };
    },
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
  });
  const roles = data?.roles ?? [];
  const modules = data?.modules ?? new Set<string>();
  const isAdmin = roles.includes("admin");
  const can = (m: ModuleKey) => isAdmin || modules.has(m);
  return { loading: isLoading || (isFetching && !data), error: isError, roles, isAdmin, can };
}
