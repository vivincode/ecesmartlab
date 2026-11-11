import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileDown, ShieldCheck, Wrench } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { BrutalCard, MonoLabel, StatusBadge } from "@/components/ui/primitives";
import { QrCodeBadge } from "@/components/catalog/qr-code-badge";
import { formatDate } from "@/lib/utils";
import type { ComponentRecord } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("components")
    .select(
      "*, departments(id, name, code), laboratories(id, name, code), categories!components_category_id_fkey(id, name, slug), component_assets(*)"
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!data) notFound();
  const comp = data as ComponentRecord;
  const specEntries = Object.entries(comp.specifications || {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/catalog"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black text-slate-700 uppercase hover:text-sky-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Catalog
        </Link>
        <StatusBadge status={comp.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <BrutalCard className="p-6">
            <MonoLabel>
              {comp.sku} // {comp.laboratories?.code ?? "LAB"} // {comp.departments?.code ?? "DEPT"}
            </MonoLabel>
            <h1 className="font-display mt-1 text-2xl font-black text-slate-950 uppercase sm:text-3xl">
              {comp.name}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {comp.description || "No description provided."}
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="border-2 border-slate-900 bg-slate-50 p-3">
                <span className="block font-mono text-[9px] font-black text-slate-500 uppercase">
                  TOTAL STOCK
                </span>
                <span className="font-display text-xl font-black">{comp.total_quantity}</span>
              </div>
              <div className="border-2 border-slate-900 bg-emerald-50 p-3">
                <span className="block font-mono text-[9px] font-black text-emerald-800 uppercase">
                  AVAILABLE
                </span>
                <span className="font-display text-xl font-black text-emerald-950">
                  {comp.available_quantity}
                </span>
              </div>
              <div className="border-2 border-slate-900 bg-amber-50 p-3">
                <span className="block font-mono text-[9px] font-black text-amber-800 uppercase">
                  RESERVED
                </span>
                <span className="font-display text-xl font-black text-amber-950">
                  {comp.reserved_quantity}
                </span>
              </div>
              <div className="border-2 border-slate-900 bg-sky-50 p-3">
                <span className="block font-mono text-[9px] font-black text-sky-800 uppercase">
                  BORROWED
                </span>
                <span className="font-display text-xl font-black text-sky-950">
                  {comp.borrowed_quantity}
                </span>
              </div>
            </div>

            {comp.image_urls && comp.image_urls.length > 0 && (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {comp.image_urls.map((url, idx) => (
                  <div key={idx} className="border-2 border-slate-900 bg-slate-50 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`${comp.name} photo ${idx + 1}`}
                      className="h-44 w-full object-contain"
                    />
                  </div>
                ))}
              </div>
            )}
          </BrutalCard>

          <BrutalCard className="p-6">
            <div className="flex items-center gap-2 border-b-2 border-slate-900 pb-2.5">
              <ShieldCheck className="h-4 w-4 text-sky-700" />
              <h2 className="text-sm font-black uppercase">
                Technical Specifications &amp; Usage Guidelines
              </h2>
            </div>

            {specEntries.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {specEntries.map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs"
                  >
                    <span className="font-bold text-slate-500 uppercase">{k}</span>
                    <span className="font-black text-slate-950">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 border-2 border-slate-900 bg-amber-50/70 p-4">
              <span className="block font-mono text-[10px] font-black text-amber-900 uppercase">
                HANDLING &amp; SAFETY INSTRUCTIONS
              </span>
              <p className="mt-1 text-xs leading-relaxed text-slate-800">
                {comp.usage_instructions || "Follow standard ESD and lab safety protocols."}
              </p>
            </div>
          </BrutalCard>

          {comp.component_assets && comp.component_assets.length > 0 && (
            <BrutalCard className="overflow-x-auto p-5">
              <h2 className="mb-3 text-sm font-black uppercase">
                Serialized Asset Registry ({comp.component_assets.length})
              </h2>
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 bg-slate-100 font-mono text-[10px] uppercase">
                    <th className="px-3 py-2">Asset Code</th>
                    <th className="px-3 py-2">Serial #</th>
                    <th className="px-3 py-2">Condition</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {comp.component_assets.map((a) => (
                    <tr key={a.id}>
                      <td className="px-3 py-2 font-mono font-black">{a.asset_code}</td>
                      <td className="px-3 py-2 font-mono">{a.serial_number || "—"}</td>
                      <td className="px-3 py-2">{a.condition}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BrutalCard>
          )}
        </div>

        <div className="space-y-5">
          <BrutalCard className="p-5 text-center">
            <MonoLabel>SCAN / PRINT ASSET QR</MonoLabel>
            <div className="mt-3 flex justify-center">
              <QrCodeBadge value={`SMARTLAB:SKU:${comp.sku}:${comp.id}`} label={comp.sku} size={150} />
            </div>
            <p className="mt-3 font-mono text-[10px] text-slate-500">
              Location: {comp.laboratories?.name} · {comp.storage_location}
            </p>
          </BrutalCard>

          <BrutalCard className="space-y-3 p-5 text-xs">
            <h3 className="border-b-2 border-slate-900 pb-2 font-mono text-xs font-black uppercase">
              Metadata
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500">Manufacturer</span>
              <span className="font-bold">{comp.manufacturer || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Model</span>
              <span className="font-mono font-bold">{comp.model || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Condition</span>
              <span className="font-bold">{comp.condition}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Updated</span>
              <span className="font-mono">{formatDate(comp.updated_at)}</span>
            </div>

            {comp.datasheet_url && (
              <a
                href={comp.datasheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="press mt-2 flex w-full items-center justify-center gap-2 border-2 border-slate-900 bg-slate-900 px-3 py-2 font-mono text-xs font-black text-white uppercase"
              >
                <FileDown className="h-4 w-4" />
                Download Datasheet
              </a>
            )}

            <Link
              href={`/maintenance?component=${comp.id}`}
              className="flex w-full items-center justify-center gap-2 border-2 border-slate-900 bg-white px-3 py-2 font-mono text-xs font-black text-slate-900 uppercase hover:bg-slate-50"
            >
              <Wrench className="h-3.5 w-3.5" />
              Report Defect
            </Link>
          </BrutalCard>
        </div>
      </div>
    </div>
  );
}
