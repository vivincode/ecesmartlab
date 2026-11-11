import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/security/rate-limit";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const { context, errorResponse } = await requireRole(["student", "staff", "admin"]);
  if (errorResponse || !context) return errorResponse!;

  const rl = checkRateLimit(`upload:${context.userId}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Upload rate limit exceeded." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const folder = String(form?.get("folder") || "general").replace(/[^a-zA-Z0-9_-]/g, "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Allowed: PNG, JPEG, WEBP, PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds 10 MB limit." }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  const path = `${folder}/${context.userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const admin = createAdminSupabase();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from("smartlab-files")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 400 });
  }

  const { data: pub } = admin.storage.from("smartlab-files").getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl, path });
}
