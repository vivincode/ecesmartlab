import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";
import {
  createNotification,
  getAssignedLabIds,
  logAuditEvent,
  requireRole,
} from "@/lib/auth/guards";
import { borrowRequestSchema } from "@/lib/validators/schemas";
import { canBorrowComponent } from "@/lib/domain/lending";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { todayISO } from "@/lib/utils";
import {
  buildBorrowRequestAdminEmailHtml,
  isCustomEmailConfigured,
  sendEmailNotification,
} from "@/lib/notifications/email";

export async function GET(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const sp = request.nextUrl.searchParams;
  const status = sp.get("status");
  const labId = sp.get("labId");

  const supabase = await createServerSupabase();
  let query = supabase
    .from("borrow_requests")
    .select(
      "*, profiles!borrow_requests_requester_id_fkey(full_name, academic_id, email), laboratories(name, code), project_teams(name, code), borrow_request_items(*, components(id, name, sku, available_quantity, storage_location))"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (labId && labId !== "all") query = query.eq("laboratory_id", labId);

  if (context.profile.role === "staff") {
    const labIds = await getAssignedLabIds(context.profile);
    if (labIds && labIds.length > 0) {
      query = query.in("laboratory_id", labIds);
    } else if (labIds && labIds.length === 0) {
      return NextResponse.json({ requests: [] });
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ requests: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const rl = checkRateLimit(`borrow:${context.userId}`, 15, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Rate limit exceeded. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = borrowRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid borrow request" },
      { status: 400 }
    );
  }

  const d = parsed.data;
  if (d.needed_until < todayISO()) {
    return NextResponse.json(
      { error: "Expected return date cannot be in the past." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabase();
  const admin = createAdminSupabase();

  // Check institutional policies
  const { data: settings } = await admin
    .from("institutional_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  const maxQty = settings?.max_borrow_qty_per_request ?? 10;
  const maxActiveLoans = settings?.max_active_loans_per_student ?? 5;
  const maxDurationDays = settings?.max_loan_duration_days ?? 14;

  const totalRequestedUnits = d.items.reduce((sum, i) => sum + i.requested_qty, 0);
  if (totalRequestedUnits > maxQty) {
    return NextResponse.json(
      { error: `Institutional policy limits a single request to ${maxQty} total units.` },
      { status: 400 }
    );
  }

  const diffDays = Math.ceil(
    (new Date(`${d.needed_until}T12:00:00`).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays > maxDurationDays) {
    return NextResponse.json(
      { error: `Maximum loan duration is ${maxDurationDays} days.` },
      { status: 400 }
    );
  }

  const { count: activeLoanCount } = await supabase
    .from("loans")
    .select("id", { count: "exact", head: true })
    .eq("borrower_id", context.userId)
    .in("status", ["Active", "Due soon", "Overdue", "Partially returned"]);

  if ((activeLoanCount ?? 0) >= maxActiveLoans) {
    return NextResponse.json(
      { error: `You have reached the maximum of ${maxActiveLoans} active loans.` },
      { status: 400 }
    );
  }

  // Team authorization & duplicate borrowing prevention
  if (d.team_id) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("can_borrow")
      .eq("team_id", d.team_id)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!membership || !membership.can_borrow) {
      return NextResponse.json(
        { error: "You are not authorized to submit borrow requests for this team." },
        { status: 403 }
      );
    }

    const componentIds = d.items.map((i) => i.component_id);
    const { data: teamActive } = await admin
      .from("borrow_requests")
      .select("id, borrow_request_items(component_id)")
      .eq("team_id", d.team_id)
      .in("status", ["Pending", "Approved", "Ready for pickup", "Checked out"]);

    const alreadyRequested = new Set<string>();
    (teamActive ?? []).forEach((req) => {
      (req.borrow_request_items ?? []).forEach((bri: { component_id: string }) => {
        alreadyRequested.add(bri.component_id);
      });
    });

    const duplicate = componentIds.find((cid) => alreadyRequested.has(cid));
    if (duplicate) {
      return NextResponse.json(
        {
          error:
            "Your project team already has an active or pending reservation for one of the selected components.",
        },
        { status: 409 }
      );
    }
  }

  // Validate component availability and lab ownership
  const componentIds = d.items.map((i) => i.component_id);
  const { data: comps, error: compErr } = await supabase
    .from("components")
    .select("id, name, sku, laboratory_id, available_quantity, condition")
    .in("id", componentIds)
    .is("deleted_at", null);

  if (compErr || !comps || comps.length !== componentIds.length) {
    return NextResponse.json(
      { error: "One or more selected components could not be found." },
      { status: 404 }
    );
  }

  for (const reqItem of d.items) {
    const comp = comps.find((c) => c.id === reqItem.component_id);
    if (!comp) continue;
    if (comp.laboratory_id !== d.laboratory_id) {
      return NextResponse.json(
        { error: `Component "${comp.name}" belongs to a different laboratory.` },
        { status: 400 }
      );
    }
    const check = canBorrowComponent(comp.available_quantity, reqItem.requested_qty, comp.condition);
    if (!check.allowed) {
      return NextResponse.json({ error: `${comp.name}: ${check.reason}` }, { status: 400 });
    }
  }

  const requestNumber = `REQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;

  const { data: createdReq, error: insertErr } = await supabase
    .from("borrow_requests")
    .insert({
      request_number: requestNumber,
      requester_id: context.userId,
      team_id: d.team_id || null,
      laboratory_id: d.laboratory_id,
      project_name: d.project_name,
      purpose: d.purpose,
      description: d.description,
      needed_until: d.needed_until,
      status: "Pending",
    })
    .select("*")
    .single();

  if (insertErr || !createdReq) {
    return NextResponse.json(
      { error: insertErr?.message || "Failed to submit borrow request" },
      { status: 400 }
    );
  }

  const { error: itemsErr } = await supabase.from("borrow_request_items").insert(
    d.items.map((item) => ({
      request_id: createdReq.id,
      component_id: item.component_id,
      requested_qty: item.requested_qty,
      approved_qty: 0,
    }))
  );

  if (itemsErr) {
    return NextResponse.json({ error: itemsErr.message }, { status: 400 });
  }

  // Notify assigned lab staff and administrators
  const [{ data: labStaff }, { data: adminProfiles }, { data: labInfo }] = await Promise.all([
    admin.from("lab_staff_assignments").select("staff_id").eq("laboratory_id", d.laboratory_id),
    admin
      .from("profiles")
      .select("id, email")
      .eq("role", "admin")
      .eq("is_active", true)
      .is("deleted_at", null),
    admin.from("laboratories").select("name, code").eq("id", d.laboratory_id).maybeSingle(),
  ]);

  const notifyIds = new Set<string>();
  for (const s of labStaff ?? []) {
    if (s.staff_id && s.staff_id !== context.userId) notifyIds.add(s.staff_id);
  }
  for (const a of adminProfiles ?? []) {
    if (a.id && a.id !== context.userId) notifyIds.add(a.id);
  }

  for (const uid of notifyIds) {
    await createNotification({
      userId: uid,
      type: "request_submitted",
      title: "New borrow request",
      message: `${context.profile.full_name} (${context.profile.academic_id}) submitted ${requestNumber}.`,
      linkUrl: "/borrow",
      metadata: { request_id: createdReq.id },
    });
  }

  if (settings?.enable_email_notifications !== false && isCustomEmailConfigured()) {
    const staffIds = (labStaff ?? []).map((s) => s.staff_id).filter(Boolean);
    const { data: staffProfiles } =
      staffIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, email")
            .in("id", staffIds)
            .eq("is_active", true)
            .is("deleted_at", null)
        : { data: [] as Array<{ id: string; email: string }> };

    const recipientEmails = new Set<string>();
    for (const a of adminProfiles ?? []) {
      if (a.email && a.id !== context.userId) recipientEmails.add(a.email.toLowerCase());
    }
    for (const s of staffProfiles ?? []) {
      if (s.email && s.id !== context.userId) recipientEmails.add(s.email.toLowerCase());
    }

    if (recipientEmails.size > 0) {
      const origin =
        request.nextUrl.origin && !request.nextUrl.origin.includes("0.0.0.0")
          ? request.nextUrl.origin
          : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const reviewUrl = `${origin.replace(/\/$/, "")}/borrow`;
      const laboratoryName = labInfo ? `${labInfo.code} — ${labInfo.name}` : "Laboratory";
      const emailItems = d.items.map((reqItem) => {
        const comp = comps.find((c) => c.id === reqItem.component_id);
        return {
          name: comp?.name || "Component",
          sku: comp?.sku || "-",
          quantity: reqItem.requested_qty,
        };
      });

      const html = buildBorrowRequestAdminEmailHtml({
        requestNumber,
        studentName: context.profile.full_name,
        academicId: context.profile.academic_id,
        studentEmail: context.profile.email,
        laboratoryName,
        projectName: d.project_name,
        purpose: d.purpose,
        neededUntil: d.needed_until,
        items: emailItems,
        reviewUrl,
      });

      await Promise.allSettled(
        Array.from(recipientEmails).map((to) =>
          sendEmailNotification({
            to,
            subject: `New Component Request (${requestNumber}) — ${context.profile.full_name}`,
            html,
          })
        )
      );
    }
  }

  await logAuditEvent({
    actorId: context.userId,
    laboratoryId: d.laboratory_id,
    action: "borrow_request_submitted",
    entityType: "borrow_request",
    entityId: createdReq.id,
    summary: `Submitted borrow request ${requestNumber} for ${d.project_name}`,
  });

  return NextResponse.json({ request: createdReq }, { status: 201 });
}
