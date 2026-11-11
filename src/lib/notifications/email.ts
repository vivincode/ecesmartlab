import nodemailer from "nodemailer";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminSupabase } from "@/lib/supabase/server";

type ResolvedMailTransport =
  | {
      provider: "smtp";
      host: string;
      port: number;
      secure: boolean;
      user: string;
      pass: string;
      fromAddress: string;
    }
  | {
      provider: "resend";
      apiKey: string;
      fromAddress: string;
    };

let cachedDbTransport: { expiresAt: number; value: ResolvedMailTransport | null } | null = null;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapSmartLabEmailHtml(subtitle: string, title: string, bodyHtml: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 2px solid #0f172a; background: #ffffff; color: #0f172a;">
      <div style="background: #0f172a; color: #ffffff; padding: 18px 24px;">
        <div style="font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #38bdf8;">
          PSG Institute of Technology and Applied Research
        </div>
        <div style="font-size: 20px; font-weight: 800; margin-top: 4px; text-transform: uppercase;">
          PSG iTech SmartLab
        </div>
        <div style="font-family: monospace; font-size: 11px; color: #cbd5e1; margin-top: 4px; text-transform: uppercase;">
          ${escapeHtml(subtitle)}
        </div>
      </div>
      <div style="padding: 24px;">
        <h1 style="font-size: 18px; margin: 0 0 14px 0; font-weight: 800;">
          ${escapeHtml(title)}
        </h1>
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim()
  );
}

export function isCustomEmailConfigured(): boolean {
  return isSmtpConfigured() || Boolean(process.env.RESEND_API_KEY?.trim());
}

export function buildVerificationEmailHtml(params: {
  recipientName?: string;
  verificationUrl: string;
  email: string;
}): string {
  const safeName = escapeHtml(params.recipientName?.trim() || "Student");
  const safeEmail = escapeHtml(params.email);
  const safeUrl = escapeHtml(params.verificationUrl);

  return wrapSmartLabEmailHtml(
    "Email Verification",
    "Verify your email address",
    `
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
        Hello <strong>${safeName}</strong>, complete your SmartLab registration for
        <strong>${safeEmail}</strong> by confirming your email address below.
      </p>
      <div style="margin: 22px 0;">
        <a href="${safeUrl}" style="display: inline-block; background: #0369a1; color: #ffffff; text-decoration: none; font-family: monospace; font-size: 13px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 12px 22px; border: 2px solid #0f172a;">
          Verify Email &amp; Activate Account
        </a>
      </div>
      <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 16px 0 6px 0;">
        If the button does not work, copy and paste this verification link into your browser:
      </p>
      <p style="font-family: monospace; font-size: 11px; word-break: break-all; background: #f8fafc; border: 1px solid #cbd5e1; padding: 10px; color: #0f172a;">
        ${safeUrl}
      </p>
    `
  );
}

export function buildBorrowRequestAdminEmailHtml(params: {
  requestNumber: string;
  studentName: string;
  academicId: string;
  studentEmail: string;
  laboratoryName: string;
  projectName: string;
  purpose: string;
  neededUntil: string;
  items: Array<{ name: string; sku: string; quantity: number }>;
  reviewUrl: string;
}): string {
  const rowsHtml = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 600;">${escapeHtml(item.name)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 12px;">${escapeHtml(item.sku)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 700; text-align: right;">${item.quantity}</td>
        </tr>
      `
    )
    .join("");

  return wrapSmartLabEmailHtml(
    `New Borrow Request // ${params.requestNumber}`,
    `Component Request from ${params.studentName}`,
    `
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">
        A student has submitted a component borrow request that requires review.
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc;">
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">REQUEST NO.</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 700;">${escapeHtml(params.requestNumber)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">STUDENT</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;"><strong>${escapeHtml(params.studentName)}</strong> (${escapeHtml(params.academicId)}) · ${escapeHtml(params.studentEmail)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">LABORATORY</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;">${escapeHtml(params.laboratoryName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">PROJECT / PURPOSE</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;"><strong>${escapeHtml(params.projectName)}</strong> — ${escapeHtml(params.purpose)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">REQUESTED DUE DATE</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 700;">${escapeHtml(params.neededUntil)}</td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-size: 11px;">COMPONENT</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-size: 11px;">SKU</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-size: 11px;">QTY</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <a href="${escapeHtml(params.reviewUrl)}" style="display: inline-block; background: #0369a1; color: #ffffff; text-decoration: none; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 11px 20px; border: 2px solid #0f172a;">
        Review Request in SmartLab
      </a>
    `
  );
}

export function buildBorrowReceiptEmailHtml(params: {
  stage: "approved" | "checked_out";
  receiptNumber: string;
  requestNumber: string;
  studentName: string;
  academicId: string;
  laboratoryName: string;
  projectName: string;
  dueDate: string;
  reviewedByName: string;
  overrideReason?: string | null;
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    storageLocation?: string | null;
    assetCode?: string | null;
  }>;
  portalUrl: string;
}): string {
  const isCheckout = params.stage === "checked_out";
  const statusBanner = isCheckout ? "CHECKED OUT // ACTIVE LOAN" : "APPROVED // READY FOR PICKUP";
  const heading = isCheckout ? "Equipment Loan Receipt" : "Borrow Request Approved Receipt";

  const rowsHtml = params.items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;">
            <strong>${escapeHtml(item.name)}</strong>
            ${item.assetCode ? `<div style="font-family: monospace; font-size: 11px; color: #0369a1;">Asset: ${escapeHtml(item.assetCode)}</div>` : ""}
          </td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 12px;">${escapeHtml(item.sku)}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 700; text-align: right;">${item.quantity}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 12px; color: #475569;">${escapeHtml(item.storageLocation || "Lab Counter")}</td>
        </tr>
      `
    )
    .join("");

  return wrapSmartLabEmailHtml(
    `Lending Receipt // ${params.receiptNumber}`,
    heading,
    `
      <div style="display: inline-block; background: #ecfdf5; border: 2px solid #047857; color: #065f46; font-family: monospace; font-size: 11px; font-weight: 800; padding: 5px 10px; margin-bottom: 14px;">
        ${statusBanner}
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">
        Hello <strong>${escapeHtml(params.studentName)}</strong>, ${
          isCheckout
            ? "the laboratory equipment listed below has been checked out to your account."
            : "your borrow request has been approved and the components below are reserved for pickup."
        }
      </p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; background: #f8fafc;">
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">${isCheckout ? "LOAN RECEIPT NO." : "REQUEST RECEIPT NO."}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 13px; font-weight: 700;">${escapeHtml(params.receiptNumber)} (Ref: ${escapeHtml(params.requestNumber)})</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">BORROWER</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;"><strong>${escapeHtml(params.studentName)}</strong> (${escapeHtml(params.academicId)})</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">LABORATORY</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;">${escapeHtml(params.laboratoryName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">PROJECT</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;">${escapeHtml(params.projectName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">RETURN DUE DATE</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 14px; font-weight: 800; color: #0369a1;">${escapeHtml(params.dueDate)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-family: monospace; font-size: 11px; color: #475569;">${isCheckout ? "ISSUED BY" : "APPROVED BY"}</td>
          <td style="padding: 8px 10px; border: 1px solid #cbd5e1; font-size: 13px;">${escapeHtml(params.reviewedByName)}</td>
        </tr>
      </table>

      ${
        params.overrideReason
          ? `<div style="margin-bottom: 14px; padding: 10px; background: #fffbeb; border: 1px solid #d97706; font-size: 12px; color: #92400e;"><strong>Admin Note:</strong> ${escapeHtml(params.overrideReason)}</div>`
          : ""
      }

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px;">
        <thead>
          <tr style="background: #e2e8f0;">
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-size: 11px;">COMPONENT</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-size: 11px;">SKU</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; font-size: 11px;">QTY</th>
            <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: left; font-family: monospace; font-size: 11px;">LOCATION</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <p style="font-size: 12px; color: #475569; margin: 0 0 16px 0;">
        Please return all borrowed equipment on or before the due date to keep your account in good standing.
      </p>

      <a href="${escapeHtml(params.portalUrl)}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; font-family: monospace; font-size: 12px; font-weight: 700; text-transform: uppercase; padding: 11px 20px;">
        View My Loans &amp; Requests
      </a>
    `
  );
}

async function resolveMailTransport(): Promise<ResolvedMailTransport | null> {
  const defaultFrom =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "PSG iTech SmartLab <noreply@smartlab.edu>";

  if (isSmtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === "true"
        : port === 465;

    return {
      provider: "smtp",
      host: process.env.SMTP_HOST!.trim(),
      port,
      secure,
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!,
      fromAddress: defaultFrom,
    };
  }

  const envApiKey = process.env.RESEND_API_KEY?.trim();
  if (envApiKey) {
    return {
      provider: "resend",
      apiKey: envApiKey,
      fromAddress: defaultFrom,
    };
  }

  if (!isSupabaseConfigured() || !isServiceRoleConfigured()) {
    return null;
  }

  if (cachedDbTransport && cachedDbTransport.expiresAt > Date.now()) {
    return cachedDbTransport.value;
  }

  try {
    const admin = createAdminSupabase();
    const { data } = await admin
      .from("private_mailer_config")
      .select("provider, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_pass, from_address")
      .eq("is_enabled", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let resolved: ResolvedMailTransport | null = null;
    if (data?.provider === "smtp" && data.smtp_host && data.smtp_user && data.smtp_pass) {
      const port = Number(data.smtp_port || 465);
      resolved = {
        provider: "smtp",
        host: String(data.smtp_host).trim(),
        port,
        secure: data.smtp_secure ?? port === 465,
        user: String(data.smtp_user).trim(),
        pass: String(data.smtp_pass),
        fromAddress:
          data.from_address?.trim() ||
          `PSG iTech SmartLab <${String(data.smtp_user).trim()}>`,
      };
    }

    cachedDbTransport = { expiresAt: Date.now() + 60_000, value: resolved };
    return resolved;
  } catch {
    return null;
  }
}

export async function hasCustomEmailTransport(): Promise<boolean> {
  return (await resolveMailTransport()) !== null;
}

export async function getActiveEmailTransportLabel(): Promise<"smtp" | "resend" | "supabase-default"> {
  const transport = await resolveMailTransport();
  if (!transport) return "supabase-default";
  return transport.provider;
}

/**
 * Sends transactional email via configured SMTP (Nodemailer) or Resend API,
 * resolving credentials from environment variables or Supabase private_mailer_config.
 */
export async function sendEmailNotification(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; provider?: "smtp" | "resend"; reason?: string }> {
  const transport = await resolveMailTransport();
  if (!transport) {
    return { sent: false, reason: "No custom SMTP or RESEND_API_KEY configured" };
  }

  if (transport.provider === "smtp") {
    try {
      const transporter = nodemailer.createTransport({
        host: transport.host,
        port: transport.port,
        secure: transport.secure,
        auth: {
          user: transport.user,
          pass: transport.pass,
        },
      });

      await transporter.sendMail({
        from: transport.fromAddress,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });

      return { sent: true, provider: "smtp" };
    } catch (err) {
      return {
        sent: false,
        provider: "smtp",
        reason: err instanceof Error ? err.message : "SMTP delivery failed",
      };
    }
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${transport.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: transport.fromAddress,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        sent: false,
        provider: "resend",
        reason: errText ? `HTTP ${res.status}: ${errText}` : `HTTP ${res.status}`,
      };
    }
    return { sent: true, provider: "resend" };
  } catch (err) {
    return {
      sent: false,
      provider: "resend",
      reason: err instanceof Error ? err.message : "Network error",
    };
  }
}
