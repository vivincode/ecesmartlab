import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireRole, verifyStaffLabAccess } from "@/lib/auth/guards";
import { returnInspectionSchema } from "@/lib/validators/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = returnInspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid return inspection payload" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (d.returned_good + d.damaged + d.lost <= 0) {
    return NextResponse.json(
      { error: "Specify at least 1 returned, damaged, or lost unit." },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: loan } = await admin.from("loans").select("laboratory_id").eq("id", id).single();
  if (!loan) {
    return NextResponse.json({ error: "Loan not found" }, { status: 404 });
  }

  const allowed = await verifyStaffLabAccess(context.profile, loan.laboratory_id);
  if (!allowed) {
    return NextResponse.json({ error: "Not assigned to this laboratory" }, { status: 403 });
  }

  const { data: rpcRes, error } = await admin.rpc("process_return_inspection", {
    p_loan_id: id,
    p_staff_id: context.userId,
    p_returned_good: d.returned_good,
    p_damaged: d.damaged,
    p_lost: d.lost,
    p_notes: d.notes || null,
    p_photo_urls: d.photo_urls || [],
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  return NextResponse.json(rpcRes);
}
