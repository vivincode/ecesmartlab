import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitStore } from "@/lib/security/rate-limit";
import { generateCSV } from "@/lib/reports/export";

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
});
