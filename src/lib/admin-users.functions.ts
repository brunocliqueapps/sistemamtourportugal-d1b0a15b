import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  role: z.enum(["admin", "comercial", "administrativo", "motorista"]),
  /** ID do motorista já registado a vincular, ou "new" para criar um novo registo de motorista. */
  driverId: z.string().optional(),
});

async function assertAdmin(context: any) {
  const { data: roles, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  if (error) throw new Error(error.message);
  if (!roles?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Apenas administradores podem gerir utilizadores.");
  }
}

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

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

    // Vínculo com o registo de motorista
    if (data.role === "motorista") {
      if (data.driverId === "new") {
        const { error: dErr } = await (supabaseAdmin.from("drivers") as any).insert({
          full_name: data.name ?? data.email,
          email: data.email,
          user_id: uid,
          active: true,
        });
        if (dErr) throw new Error(dErr.message);
      } else if (data.driverId) {
        // um utilizador por motorista
        await (supabaseAdmin.from("drivers") as any).update({ user_id: null }).eq("user_id", uid);
        const { error: dErr } = await (supabaseAdmin.from("drivers") as any)
          .update({ user_id: uid })
          .eq("id", data.driverId);
        if (dErr) throw new Error(dErr.message);
      }
    }

    return { id: uid };
  });

const linkSchema = z.object({
  userId: z.string().uuid(),
  /** null/"" desvincula */
  driverId: z.string().nullable().optional(),
});

export const linkUserToDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => linkSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // remove vínculos antigos deste utilizador
    await (supabaseAdmin.from("drivers") as any).update({ user_id: null }).eq("user_id", data.userId);

    if (data.driverId) {
      const { error } = await (supabaseAdmin.from("drivers") as any)
        .update({ user_id: data.userId })
        .eq("id", data.driverId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
