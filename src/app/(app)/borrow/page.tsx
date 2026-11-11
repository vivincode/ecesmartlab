import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { BorrowClient } from "@/components/borrow/borrow-client";
import type { BorrowRequest, Loan, Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function BorrowPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  const [reqsRes, loansRes] = await Promise.all([
    supabase
      .from("borrow_requests")
      .select(
        "*, profiles!borrow_requests_requester_id_fkey(full_name, academic_id, email), laboratories(name, code), project_teams(name, code), borrow_request_items(*, components(id, name, sku, available_quantity, storage_location))"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("loans")
      .select(
        "*, profiles!loans_borrower_id_fkey(full_name, academic_id, email), laboratories(name, code), loan_items(*, components(name, sku, is_serialized), component_assets(asset_code, serial_number)), extensions(*)"
      )
      .order("checked_out_at", { ascending: false }),
  ]);

  return (
    <BorrowClient
      profile={profile as Profile}
      initialRequests={(reqsRes.data ?? []) as BorrowRequest[]}
      initialLoans={(loansRes.data ?? []) as Loan[]}
    />
  );
}
