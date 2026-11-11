import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { BookingsClient } from "@/components/bookings/bookings-client";
import type { LabBooking, Laboratory, Profile, ProjectTeam } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, bookingsRes, labsRes, teamsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("lab_bookings")
      .select(
        "*, profiles!lab_bookings_user_id_fkey(full_name, academic_id), laboratories(name, code, capacity)"
      )
      .order("booking_date", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("laboratories")
      .select("*")
      .is("deleted_at", null)
      .eq("is_active", true)
      .order("name"),
    supabase.from("project_teams").select("*").is("deleted_at", null).order("name"),
  ]);

  if (!profileRes.data) redirect("/login");

  return (
    <BookingsClient
      profile={profileRes.data as Profile}
      initialBookings={(bookingsRes.data ?? []) as LabBooking[]}
      laboratories={(labsRes.data ?? []) as Laboratory[]}
      teams={(teamsRes.data ?? []) as ProjectTeam[]}
    />
  );
}
