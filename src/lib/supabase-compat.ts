import { supabase } from "@/integrations/supabase/client";

/**
 * Standard fix for "Invalid RelationName" error by using `as any` on table names.
 * This should be used when types.ts is out of sync or missing tables.
 */
export const sb = {
  from: (table: string) => supabase.from(table as any),
};
