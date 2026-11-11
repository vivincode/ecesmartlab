import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  getAssignedLabIds,
  logAuditEvent,
  requireRole,
  verifyStaffLabAccess,
} from "@/lib/auth/guards";
import { labBookingSchema } from "@/lib/validators/schemas";
import { checkBookingCapacityAndOverlap } from "@/lib/domain/lending";
import { todayISO } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const labId = request.nextUrl.searchParams.get("labId");
  const supabase = await createServerSupabase();

  let query = supabase
    .from("lab_bookings")
    .select(
      "*, profiles!lab_bookings_user_id_fkey(full_name, academic_id), laboratories(name, code, capacity)"
    )
    .order("booking_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);

  if (context.profile.role === "staff") {
    const labIds = await getAssignedLabIds(context.profile);
    if (labIds && labIds.length > 0) {
      query = query.in("laboratory_id", labIds);
    } else if (labIds && labIds.length === 0) {
      return NextResponse.json({ bookings: [] });
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ bookings: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const body = await request.json().catch(() => null);
  const parsed = labBookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid booking payload" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (d.booking_date < todayISO()) {
    return NextResponse.json({ error: "Cannot book a date in the past." }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  if (d.is_maintenance_block) {
    const allowed = await verifyStaffLabAccess(context.profile, d.laboratory_id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Only assigned staff or admins can block lab slots." },
        { status: 403 }
      );
    }
  }

  const { data: lab } = await supabase
    .from("laboratories")
    .select("id, name, capacity, open_time, close_time")
    .eq("id", d.laboratory_id)
    .single();

  if (!lab) {
    return NextResponse.json({ error: "Laboratory not found" }, { status: 404 });
  }

  const { data: existing } = await admin
    .from("lab_bookings")
    .select("booking_date, start_time, end_time, seats_requested, status")
    .eq("laboratory_id", d.laboratory_id)
    .eq("booking_date", d.booking_date)
    .in("status", ["Approved", "Blocked"]);

  if (!d.is_maintenance_block) {
    const check = checkBookingCapacityAndOverlap(
      existing ?? [],
      {
        booking_date: d.booking_date,
        start_time: d.start_time,
        end_time: d.end_time,
        seats_requested: d.seats_requested,
      },
      lab.capacity
    );

    if (!check.allowed) {
      return NextResponse.json({ error: check.reason }, { status: 409 });
    }
  }

  const { data: created, error } = await supabase
    .from("lab_bookings")
    .insert({
      laboratory_id: d.laboratory_id,
      user_id: context.userId,
      team_id: d.team_id || null,
      session_purpose: d.session_purpose,
      booking_date: d.booking_date,
      start_time: d.start_time,
      end_time: d.end_time,
      seats_requested: d.is_maintenance_block ? lab.capacity : d.seats_requested,
      status: d.is_maintenance_block ? "Blocked" : "Pending",
      is_maintenance_block: d.is_maintenance_block,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (!d.is_maintenance_block) {
    const { data: staffRows } = await admin
      .from("lab_staff_assignments")
      .select("staff_id")
      .eq("laboratory_id", d.laboratory_id);

    for (const s of staffRows ?? []) {
      await createNotification({
        userId: s.staff_id,
        type: "booking_requested",
        title: "New lab booking request",
        message: `${context.profile.full_name} requested ${lab.name} on ${d.booking_date} (${d.start_time}-${d.end_time}).`,
        linkUrl: "/bookings",
      });
    }
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: d.laboratory_id,
    action: d.is_maintenance_block ? "lab_slot_blocked" : "lab_booking_requested",
    entityType: "lab_booking",
    entityId: created.id,
    summary: `${d.is_maintenance_block ? "Blocked" : "Requested"} ${lab.name} on ${d.booking_date}`,
  });

  return NextResponse.json({ booking: created }, { status: 201 });
}
