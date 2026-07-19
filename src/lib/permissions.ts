import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppRole = "admin" | "comercial" | "administrativo" | "motorista";
export type ModuleKey =
  | "dashboard" | "agenda" | "crm" | "propostas" | "oc" | "operacao" | "tvde"
  | "financeiro" | "conta_corrente" | "fechamento" | "relatorios"
  | "cadastros" | "pos_venda" | "importar" | "configuracoes" | "alertas";

export function usePermissions() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["perms", user?.id],
    queryFn: async () => {
      const [rolesRes, permsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("role_permissions").select("role,module"),
      ]);
      const roles = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
      const allowed = new Set<string>();
      for (const p of permsRes.data ?? []) {
        if (roles.includes(p.role as AppRole)) allowed.add(p.module);
      }
      return { roles, modules: allowed };
    },
  });
  const roles = data?.roles ?? [];
  const modules = data?.modules ?? new Set<string>();
  const isAdmin = roles.includes("admin");
  const can = (m: ModuleKey) => isAdmin || modules.has(m);
  return { loading: isLoading, roles, isAdmin, can };
}
