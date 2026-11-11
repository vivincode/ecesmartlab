import nodemailer from "nodemailer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; border: 2px solid #0f172a; background: #ffffff; color: #0f172a;">
      <div style="background: #0f172a; color: #ffffff; padding: 18px 24px;">
        <div style="font-family: monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #38bdf8;">
          PSG Institute of Technology and Applied Research
        </div>
        <div style="font-size: 20px; font-weight: 800; margin-top: 4px; text-transform: uppercase;">
          PSG iTech SmartLab
        </div>
      </div>
      <div style="padding: 24px;">
        <h1 style="font-size: 18px; margin: 0 0 12px 0; font-weight: 800;">
          Verify your email address
        </h1>
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
      </div>
    </div>
  `;
}

/**
 * Sends transactional email via configured SMTP (Nodemailer) or Resend API.
 * Falls back gracefully with `{ sent: false }` if neither transport is configured.
 */
export async function sendEmailNotification(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; provider?: "smtp" | "resend"; reason?: string }> {
  const fromAddress =
    process.env.SMTP_FROM?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    process.env.SMTP_USER?.trim() ||
    "PSG iTech SmartLab <noreply@smartlab.edu>";

  if (isSmtpConfigured()) {
    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const secure =
        process.env.SMTP_SECURE !== undefined
          ? process.env.SMTP_SECURE === "true"
          : port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST!.trim(),
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER!.trim(),
          pass: process.env.SMTP_PASS!,
        },
      });

      await transporter.sendMail({
        from: fromAddress,
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

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { sent: false, reason: "No custom SMTP or RESEND_API_KEY configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
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
