import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";
import { reviewRequestSchema } from "@/lib/validators/schemas";
import {
  buildBorrowReceiptEmailHtml,
  isCustomEmailConfigured,
  sendEmailNotification,
} from "@/lib/notifications/email";

async function dispatchStudentBorrowReceipt(params: {
  request: NextRequest;
  admin: ReturnType<typeof createAdminSupabase>;
  reqRow: {
    id: string;
    request_number: string;
    requester_id: string;
    laboratory_id: string;
    project_name: string;
    needed_until: string;
    override_reason?: string | null;
  };
  reviewerName: string;
  stage: "approved" | "checked_out";
  loanId?: string;
  loanNumber?: string;
  overrideReason?: string | null;
}) {
  if (!isCustomEmailConfigured()) return;

  const { data: settings } = await params.admin
    .from("institutional_settings")
    .select("enable_email_notifications")
    .limit(1)
    .maybeSingle();

  if (settings?.enable_email_notifications === false) return;

  const [{ data: student }, { data: labInfo }] = await Promise.all([
    params.admin
      .from("profiles")
      .select("full_name, academic_id, email")
      .eq("id", params.reqRow.requester_id)
      .maybeSingle(),
    params.admin
      .from("laboratories")
      .select("name, code")
      .eq("id", params.reqRow.laboratory_id)
      .maybeSingle(),
  ]);

  if (!student?.email) return;

  let items: Array<{
    name: string;
    sku: string;
    quantity: number;
    storageLocation?: string | null;
    assetCode?: string | null;
  }> = [];

  if (params.stage === "checked_out" && params.loanId) {
    const { data: loanItems } = await params.admin
      .from("loan_items")
      .select("quantity_borrowed, components(name, sku, storage_location), component_assets(asset_code)")
      .eq("loan_id", params.loanId);

    items = (loanItems ?? []).map((li) => {
      const comp = li.components as unknown as {
        name?: string;
        sku?: string;
        storage_location?: string | null;
      } | null;
      const asset = li.component_assets as unknown as { asset_code?: string | null } | null;
      return {
        name: comp?.name || "Component",
        sku: comp?.sku || "-",
        quantity: Number(li.quantity_borrowed || 0),
        storageLocation: comp?.storage_location ?? null,
        assetCode: asset?.asset_code ?? null,
      };
    });
  } else {
    const { data: reqItems } = await params.admin
      .from("borrow_request_items")
      .select("requested_qty, approved_qty, components(name, sku, storage_location)")
      .eq("request_id", params.reqRow.id);

    items = (reqItems ?? []).map((ri) => {
      const comp = ri.components as unknown as {
        name?: string;
        sku?: string;
        storage_location?: string | null;
      } | null;
      return {
        name: comp?.name || "Component",
        sku: comp?.sku || "-",
        quantity: Number(ri.approved_qty > 0 ? ri.approved_qty : ri.requested_qty),
        storageLocation: comp?.storage_location ?? null,
      };
    });
  }

  const origin =
    params.request.nextUrl.origin && !params.request.nextUrl.origin.includes("0.0.0.0")
      ? params.request.nextUrl.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const portalUrl = `${origin.replace(/\/$/, "")}/borrow`;
  const receiptNumber =
    params.stage === "checked_out" && params.loanNumber
      ? params.loanNumber
      : params.reqRow.request_number;
  const laboratoryName = labInfo ? `${labInfo.code} — ${labInfo.name}` : "Laboratory";

  const html = buildBorrowReceiptEmailHtml({
    stage: params.stage,
    receiptNumber,
    requestNumber: params.reqRow.request_number,
    studentName: student.full_name,
    academicId: student.academic_id,
    laboratoryName,
    projectName: params.reqRow.project_name,
    dueDate: params.reqRow.needed_until,
    reviewedByName: params.reviewerName,
    overrideReason: params.overrideReason ?? params.reqRow.override_reason ?? null,
    items,
    portalUrl,
  });

  const subject =
    params.stage === "checked_out"
      ? `PSG iTech SmartLab // Equipment Checkout Receipt (${receiptNumber})`
      : `PSG iTech SmartLab // Approved Borrow Receipt (${params.reqRow.request_number})`;

  await sendEmailNotification({
    to: student.email,
    subject,
    html,
  }).catch(() => {});
}

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

    await dispatchStudentBorrowReceipt({
      request,
      admin,
      reqRow,
      reviewerName: context.profile.full_name,
      stage: "approved",
      overrideReason: override_reason,
    });

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

    const checkoutPayload = (rpcRes ?? {}) as { loan_id?: string; loan_number?: string };
    await dispatchStudentBorrowReceipt({
      request,
      admin,
      reqRow,
      reviewerName: context.profile.full_name,
      stage: "checked_out",
      loanId: checkoutPayload.loan_id,
      loanNumber: checkoutPayload.loan_number,
    });

    return NextResponse.json(rpcRes);
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
