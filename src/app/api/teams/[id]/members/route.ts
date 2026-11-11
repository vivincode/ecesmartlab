import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const academicId = typeof body?.academic_id === "string" ? body.academic_id.trim().toUpperCase() : "";
  const canBorrow = body?.can_borrow !== false;

  if (!academicId) {
    return NextResponse.json({ error: "Academic ID is required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: team } = await admin.from("project_teams").select("*").eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (team.leader_id !== context.userId && context.profile.role !== "admin") {
    return NextResponse.json({ error: "Only team leaders can add members" }, { status: 403 });
  }

  const { data: memberProfile } = await admin
    .from("profiles")
    .select("id, full_name, academic_id")
    .eq("academic_id", academicId)
    .single();

  if (!memberProfile) {
    return NextResponse.json({ error: `No user found with ID ${academicId}` }, { status: 404 });
  }

  const { error } = await admin.from("team_members").upsert(
    {
      team_id: teamId,
      user_id: memberProfile.id,
      role: "member",
      can_borrow: canBorrow,
    },
    { onConflict: "team_id,user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, member: memberProfile });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: teamId } = await params;
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: team } = await admin.from("project_teams").select("leader_id").eq("id", teamId).single();
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  if (
    team.leader_id !== context.userId &&
    userId !== context.userId &&
    context.profile.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId === team.leader_id) {
    return NextResponse.json({ error: "Team leader cannot be removed" }, { status: 400 });
  }

  await admin.from("team_members").delete().eq("team_id", teamId).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
