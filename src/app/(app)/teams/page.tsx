import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { TeamsClient } from "@/components/teams/teams-client";
import type { Department, Profile, ProjectTeam } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profileRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("project_teams")
      .select(
        "*, leader:profiles!project_teams_leader_id_fkey(full_name, academic_id), projects(title, course_code, faculty_mentor), team_members(id, user_id, role, can_borrow, profiles(full_name, academic_id, email))"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("*").is("deleted_at", null).order("name"),
  ]);

  if (!profileRes.data) redirect("/login");

  return (
    <TeamsClient
      profile={profileRes.data as Profile}
      initialTeams={(teamsRes.data ?? []) as ProjectTeam[]}
      departments={(deptsRes.data ?? []) as Department[]}
    />
  );
}
