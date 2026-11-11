import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";
import { reviewRequestSchema } from "@/lib/validators/schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = reviewRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid action payload" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  const { data: reqRow, error: fetchErr } = await admin
    .from("borrow_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !reqRow) {
    return NextResponse.json({ error: "Borrow request not found" }, { status: 404 });
  }

  const { action, rejection_reason, override_reason } = parsed.data;

  // Student cancel own pending request
  if (action === "cancel") {
    if (reqRow.requester_id !== context.userId && context.profile.role !== "admin") {
      return NextResponse.json({ error: "Only the requester can cancel this request." }, { status: 403 });
    }
    if (reqRow.status !== "Pending") {
      return NextResponse.json(
        { error: "Only pending requests can be cancelled." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("borrow_requests")
      .update({ status: "Cancelled" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAuditEvent({
      actorId: context.userId,
      laboratoryId: reqRow.laboratory_id,
      action: "borrow_request_cancelled",
      entityType: "borrow_request",
      entityId: id,
      summary: `Cancelled request ${reqRow.request_number}`,
    });

    return NextResponse.json({ ok: true, status: "Cancelled" });
  }

  // Staff / Admin actions
  if (context.profile.role === "student") {
    return NextResponse.json(
      { error: "Students cannot approve, reject, or check out requests." },
      { status: 403 }
    );
  }

  if (reqRow.requester_id === context.userId && action !== "override_approve") {
    return NextResponse.json(
      { error: "You cannot review or approve your own borrow request." },
      { status: 403 }
    );
  }

  const hasLabAccess = await verifyStaffLabAccess(context.profile, reqRow.laboratory_id);
  if (!hasLabAccess) {
    return NextResponse.json(
      { error: "You are not assigned to manage this laboratory." },
      { status: 403 }
    );
  }

  if (action === "approve" || action === "override_approve") {
    if (action === "override_approve" && context.profile.role !== "admin") {
      return NextResponse.json({ error: "Only administrators can override requests." }, { status: 403 });
    }

    const { data: rpcRes, error: rpcErr } = await admin.rpc("approve_borrow_request", {
      p_request_id: id,
      p_staff_id: context.userId,
    });

    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 409 });
    }

    if (action === "override_approve" && override_reason) {
      await admin
        .from("borrow_requests")
        .update({ override_reason })
        .eq("id", id);

      await logAuditEvent({
        actorId: context.userId,
        laboratoryId: reqRow.laboratory_id,
        action: "admin_override_approve",
        entityType: "borrow_request",
        entityId: id,
        summary: `Admin override on ${reqRow.request_number}: ${override_reason}`,
      });
    }

    return NextResponse.json(rpcRes);
  }

  if (action === "reject") {
    if (!rejection_reason || rejection_reason.length < 3) {
      return NextResponse.json(
        { error: "Please provide a clear rejection reason." },
        { status: 400 }
      );
    }
    if (reqRow.status !== "Pending") {
      return NextResponse.json({ error: "Only pending requests can be rejected." }, { status: 400 });
    }

    const { error } = await admin
      .from("borrow_requests")
      .update({
        status: "Rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        rejection_reason,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await createNotification({
      userId: reqRow.requester_id,
      type: "request_rejected",
      title: "Borrow request rejected",
      message: `Request ${reqRow.request_number} was declined: ${rejection_reason}`,
      linkUrl: "/borrow",
      metadata: { request_id: id },
    });

    await logAuditEvent({
      actorId: context.userId,
      laboratoryId: reqRow.laboratory_id,
      action: "borrow_request_rejected",
      entityType: "borrow_request",
      entityId: id,
      summary: `Rejected request ${reqRow.request_number}: ${rejection_reason}`,
    });

    return NextResponse.json({ ok: true, status: "Rejected" });
  }

  if (action === "checkout") {
    const { data: rpcRes, error: rpcErr } = await admin.rpc("checkout_borrow_request", {
      p_request_id: id,
      p_staff_id: context.userId,
    });
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 409 });
    }
    return NextResponse.json(rpcRes);
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
