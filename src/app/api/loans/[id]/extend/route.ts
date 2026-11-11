import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";
import { extensionRequestSchema } from "@/lib/validators/schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = extensionRequestSchema.safeParse({ ...body, loan_id: id });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid extension request" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const { data: loan } = await supabase.from("loans").select("*").eq("id", id).single();
  if (!loan) return NextResponse.json({ error: "Loan not found" }, { status: 404 });

  if (loan.borrower_id !== context.userId) {
    return NextResponse.json({ error: "Only the borrower can request an extension." }, { status: 403 });
  }
  if (parsed.data.requested_due_date <= loan.due_date) {
    return NextResponse.json(
      { error: "Requested due date must be after the current due date." },
      { status: 400 }
    );
  }

  const { data: ext, error } = await supabase
    .from("extensions")
    .insert({
      loan_id: id,
      requested_by: context.userId,
      current_due_date: loan.due_date,
      requested_due_date: parsed.data.requested_due_date,
      reason: parsed.data.reason,
      status: "Pending",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: loan.laboratory_id,
    action: "extension_requested",
    entityType: "extension",
    entityId: ext.id,
    summary: `Requested due date extension for loan ${loan.loan_number} to ${parsed.data.requested_due_date}`,
  });

  return NextResponse.json({ extension: ext }, { status: 201 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: extensionId } = await params;
  const { context, errorResponse } = await requireRole(["staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const decision = body?.decision as "Approved" | "Rejected" | undefined;
  const reviewNotes = typeof body?.review_notes === "string" ? body.review_notes : "";

  if (decision !== "Approved" && decision !== "Rejected") {
    return NextResponse.json({ error: "Decision must be Approved or Rejected" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: ext } = await admin
    .from("extensions")
    .select("*, loans(*)")
    .eq("id", extensionId)
    .single();

  if (!ext || !ext.loans) {
    return NextResponse.json({ error: "Extension request not found" }, { status: 404 });
  }

  const allowed = await verifyStaffLabAccess(context.profile, ext.loans.laboratory_id);
  if (!allowed) return NextResponse.json({ error: "Forbidden for this lab" }, { status: 403 });

  await admin
    .from("extensions")
    .update({
      status: decision,
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq("id", extensionId);

  if (decision === "Approved") {
    await admin
      .from("loans")
      .update({ due_date: ext.requested_due_date, status: "Active" })
      .eq("id", ext.loan_id);
  }

  await createNotification({
    userId: ext.requested_by,
    type: decision === "Approved" ? "extension_approved" : "extension_rejected",
    title: `Loan extension ${decision.toLowerCase()}`,
    message:
      decision === "Approved"
        ? `Loan ${ext.loans.loan_number} extended until ${ext.requested_due_date}.`
        : `Extension for ${ext.loans.loan_number} was declined. ${reviewNotes}`,
    linkUrl: "/borrow",
  });

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: ext.loans.laboratory_id,
    action: `extension_${decision.toLowerCase()}`,
    entityType: "extension",
    entityId: extensionId,
    summary: `${decision} extension for loan ${ext.loans.loan_number}`,
  });

  return NextResponse.json({ ok: true, status: decision });
}
