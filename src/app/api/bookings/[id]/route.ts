import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const action = body?.action as "approve" | "reject" | "cancel" | undefined;
  const reviewNotes = typeof body?.review_notes === "string" ? body.review_notes : "";

  const admin = createAdminSupabase();
  const supabase = await createServerSupabase();

  const { data: booking } = await admin
    .from("lab_bookings")
    .select("*, laboratories(name)")
    .eq("id", id)
    .single();

  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  if (action === "cancel") {
    if (booking.user_id !== context.userId && context.profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (booking.status !== "Pending") {
      return NextResponse.json({ error: "Only pending bookings can be cancelled." }, { status: 400 });
    }
    await supabase.from("lab_bookings").update({ status: "Cancelled" }).eq("id", id);
    return NextResponse.json({ ok: true, status: "Cancelled" });
  }

  if (context.profile.role === "student") {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  const allowed = await verifyStaffLabAccess(context.profile, booking.laboratory_id);
  if (!allowed) return NextResponse.json({ error: "Not assigned to this laboratory" }, { status: 403 });

  if (action === "approve") {
    const { data: rpcRes, error } = await admin.rpc("approve_lab_booking", {
      p_booking_id: id,
      p_staff_id: context.userId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json(rpcRes);
  }

  if (action === "reject") {
    await admin
      .from("lab_bookings")
      .update({
        status: "Rejected",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes,
      })
      .eq("id", id);

    await createNotification({
      userId: booking.user_id,
      type: "booking_rejected",
      title: "Lab booking rejected",
      message: `Booking for ${booking.laboratories?.name ?? "laboratory"} on ${booking.booking_date} was declined. ${reviewNotes}`,
      linkUrl: "/bookings",
    });

    await logAuditEvent({
      actorId: context.userId,
      laboratoryId: booking.laboratory_id,
      action: "lab_booking_rejected",
      entityType: "lab_booking",
      entityId: id,
      summary: `Rejected booking on ${booking.booking_date}`,
    });

    return NextResponse.json({ ok: true, status: "Rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
