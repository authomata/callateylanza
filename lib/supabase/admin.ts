import { createClient } from "@supabase/supabase-js";

// Service-role client. SERVER-ONLY: bypasses RLS. Never import into client components.
// Used by privileged routes (approval gate, generation) after an explicit role check.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
