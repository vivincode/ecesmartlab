import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isServiceRoleConfigured, isSupabaseConfigured } from "./config";

export async function createServerSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Please copy .env.example to .env.local and provide Supabase credentials."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore cookie setting inside Server Components; middleware handles session refresh.
          }
        },
      },
    }
  );
}

/**
 * Server-only privileged client. NEVER import this module into a Client Component.
 */
export function createAdminSupabase() {
  if (typeof window !== "undefined") {
    throw new Error("SECURITY VIOLATION: Admin Supabase client cannot be used in browser.");
  }
  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Server-side admin operations require a valid service role key."
    );
  }

  return createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
