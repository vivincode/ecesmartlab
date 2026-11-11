export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(
    url &&
      anon &&
      url.startsWith("http") &&
      !url.includes("your-project-ref") &&
      !anon.includes("your-supabase-anon-key")
  );
}

export function isServiceRoleConfigured(): boolean {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(key && !key.includes("your-supabase-service-role-key"));
}
