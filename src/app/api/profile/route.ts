import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/guards";
import { createServerSupabase } from "@/lib/supabase/server";
import { profileUpdateSchema } from "@/lib/validators/schemas";

export async function GET() {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;
  return NextResponse.json({ profile: context.profile });
}

export async function PATCH(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = profileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid profile data" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone ?? null,
      year_of_study: parsed.data.year_of_study ?? null,
      department_id: parsed.data.department_id ?? null,
    })
    .eq("id", context.userId)
    .select("*, departments(id, name, code)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ profile: data });
}
