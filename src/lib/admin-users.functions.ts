import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["admin", "comercial", "administrativo", "motorista"]),
});

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    // Só administradores podem criar utilizadores
    const { data: roles, error: rolesError } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error(rolesError.message);
    if (!roles?.some((r: { role: string }) => r.role === "admin")) {
      throw new Error("Apenas administradores podem criar utilizadores.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name ?? null },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Não foi possível criar o utilizador.");

    await (supabaseAdmin.from("profiles") as any).upsert({
      id: uid,
      email: data.email,
      full_name: data.name ?? null,
    });
    await (supabaseAdmin.from("user_roles") as any).delete().eq("user_id", uid);
    const { error: roleError } = await (supabaseAdmin.from("user_roles") as any).insert({
      user_id: uid,
      role: data.role,
    });
    if (roleError) throw new Error(roleError.message);

    return { id: uid };
  });
