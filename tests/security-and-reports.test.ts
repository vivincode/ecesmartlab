import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/security/rate-limit";
import { generateCSV } from "@/lib/reports/export";
import {
  buildBorrowReceiptEmailHtml,
  buildBorrowRequestAdminEmailHtml,
  buildVerificationEmailHtml,
  isCustomEmailConfigured,
  isSmtpConfigured,
} from "@/lib/notifications/email";

describe("Security Rate Limiter & CSV Formula Protection", () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it("enforces request limits per key within the active window", () => {
    const r1 = checkRateLimit("ip:1.2.3.4", 2, 60_000);
    const r2 = checkRateLimit("ip:1.2.3.4", 2, 60_000);
    const r3 = checkRateLimit("ip:1.2.3.4", 2, 60_000);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("neutralizes spreadsheet formula injection in CSV exports", () => {
    const csv = generateCSV(
      ["Name", "Notes"],
      [
        ["Arduino Uno", "=CMD('calc')"],
        ["Resistor, 10k", 'Quote "test"'],
      ]
    );
    expect(csv).toContain("'=CMD('calc')");
    expect(csv).toContain('"Resistor, 10k"');
    expect(csv).toContain('"Quote ""test"""');
  });

  it("escapes user data in verification emails and detects custom mailer env vars", () => {
    const html = buildVerificationEmailHtml({
      recipientName: '<script>alert("x")</script>Vivin',
      verificationUrl: "https://smartlab.example/auth/callback?token_hash=abc&type=signup",
      email: "26l271@psgitech.ac.in",
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;Vivin");
    expect(html).toContain("token_hash=abc&amp;type=signup");
    expect(html).toContain("PSG iTech SmartLab");

    const origHost = process.env.SMTP_HOST;
    const origUser = process.env.SMTP_USER;
    const origPass = process.env.SMTP_PASS;
    const origResend = process.env.RESEND_API_KEY;

    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.RESEND_API_KEY;
    expect(isSmtpConfigured()).toBe(false);
    expect(isCustomEmailConfigured()).toBe(false);

    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_USER = "smartlab@gmail.com";
    process.env.SMTP_PASS = "app-pass";
    expect(isSmtpConfigured()).toBe(true);
    expect(isCustomEmailConfigured()).toBe(true);

    if (origHost !== undefined) process.env.SMTP_HOST = origHost;
    else delete process.env.SMTP_HOST;
    if (origUser !== undefined) process.env.SMTP_USER = origUser;
    else delete process.env.SMTP_USER;
    if (origPass !== undefined) process.env.SMTP_PASS = origPass;
    else delete process.env.SMTP_PASS;
    if (origResend !== undefined) process.env.RESEND_API_KEY = origResend;
    else delete process.env.RESEND_API_KEY;
  });

  it("renders borrow request admin alert and student receipt emails with escaped fields", () => {
    const adminHtml = buildBorrowRequestAdminEmailHtml({
      requestNumber: "REQ-20261112-AB12C",
      studentName: "Vivin <M>",
      academicId: "26L271",
      studentEmail: "26l271@psgitech.ac.in",
      laboratoryName: "ECE-204 — Embedded Systems Lab",
      projectName: "IoT Node",
      purpose: "Sensor calibration",
      neededUntil: "2026-11-25",
      items: [{ name: "ESP32-S3 DevKitC-1", sku: "EMB-ESP-021", quantity: 2 }],
      reviewUrl: "http://localhost:3000/borrow",
    });

    expect(adminHtml).toContain("REQ-20261112-AB12C");
    expect(adminHtml).toContain("Vivin &lt;M&gt;");
    expect(adminHtml).toContain("EMB-ESP-021");
    expect(adminHtml).toContain("2026-11-25");

    const receiptHtml = buildBorrowReceiptEmailHtml({
      stage: "approved",
      receiptNumber: "REQ-20261112-AB12C",
      requestNumber: "REQ-20261112-AB12C",
      studentName: "Vivin",
      academicId: "26L271",
      laboratoryName: "ECE-204 — Embedded Systems Lab",
      projectName: "IoT Node",
      dueDate: "2026-11-25",
      reviewedByName: "Lab Admin",
      items: [
        {
          name: "ESP32-S3 DevKitC-1",
          sku: "EMB-ESP-021",
          quantity: 2,
          storageLocation: "Rack E / Tray 02",
        },
      ],
      portalUrl: "http://localhost:3000/borrow",
    });

    expect(receiptHtml).toContain("APPROVED // READY FOR PICKUP");
    expect(receiptHtml).toContain("Borrow Request Approved Receipt");
    expect(receiptHtml).toContain("2026-11-25");
    expect(receiptHtml).toContain("Rack E / Tray 02");
  });
});
