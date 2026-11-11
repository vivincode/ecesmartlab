import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import { logAuditEvent, requireRole } from "@/lib/auth/guards";
import { projectTeamSchema } from "@/lib/validators/schemas";

export async function GET() {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("project_teams")
    .select(
      "*, leader:profiles!project_teams_leader_id_fkey(full_name, academic_id), projects(title, course_code, faculty_mentor), team_members(id, user_id, role, can_borrow, profiles(full_name, academic_id, email))"
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ teams: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);

  // Join an existing team by invite code
  if (body?.action === "join" && typeof body?.code === "string") {
    const admin = createAdminSupabase();
    const { data: team } = await admin
      .from("project_teams")
      .select("id, name, allow_member_requests")
      .eq("code", body.code.trim().toUpperCase())
      .is("deleted_at", null)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team code not found." }, { status: 404 });
    }

    const { error: joinErr } = await admin.from("team_members").upsert(
      {
        team_id: team.id,
        user_id: context.userId,
        role: "member",
        can_borrow: team.allow_member_requests,
      },
      { onConflict: "team_id,user_id" }
    );

    if (joinErr) return NextResponse.json({ error: joinErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, teamId: team.id, teamName: team.name });
  }

  const parsed = projectTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid team payload" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .insert({
      title: d.project_title,
      description: d.description,
      course_code: d.course_code || null,
      faculty_mentor: d.faculty_mentor || null,
      department_id: d.department_id || null,
      created_by: context.userId,
    })
    .select("*")
    .single();

  if (projErr || !project) {
    return NextResponse.json({ error: projErr?.message || "Failed to create project" }, { status: 400 });
  }

  const teamCode = `TM-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  const { data: team, error: teamErr } = await supabase
    .from("project_teams")
    .insert({
      name: d.name,
      code: teamCode,
      description: d.description,
      department_id: d.department_id || null,
      project_id: project.id,
      leader_id: context.userId,
      allow_member_requests: d.allow_member_requests,
    })
    .select("*")
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message || "Failed to create team" }, { status: 400 });
  }

  await admin.from("team_members").insert({
    team_id: team.id,
    user_id: context.userId,
    role: "leader",
    can_borrow: true,
  });

  await logAuditEvent({
    actorId: context.userId,
    action: "project_team_created",
    entityType: "project_team",
    entityId: team.id,
    summary: `Created project team ${team.name} (${team.code})`,
  });

  return NextResponse.json({ team }, { status: 201 });
}
