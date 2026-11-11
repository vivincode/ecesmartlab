import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { BrutalCard, EmptyState, MonoLabel } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";
import type { NotificationRecord } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as NotificationRecord[];

  return (
    <div className="space-y-6">
      <div className="border-b-2 border-slate-900 pb-4">
        <MonoLabel>REALTIME ALERT HISTORY</MonoLabel>
        <h1 className="font-display mt-1 text-2xl font-black uppercase sm:text-3xl">
          Notification Center
        </h1>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="You are all caught up"
          description="Approvals, overdue warnings, maintenance resolutions, and lab booking updates appear here."
        />
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => (
            <BrutalCard
              key={n.id}
              className={`p-4 ${!n.is_read ? "bg-sky-50/70" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <MonoLabel>{n.type.replaceAll("_", " ")}</MonoLabel>
                  <h2 className="mt-0.5 text-sm font-black text-slate-950">{n.title}</h2>
                  <p className="mt-1 text-xs text-slate-600">{n.message}</p>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[10px] text-slate-400">
                    {formatDateTime(n.created_at)}
                  </span>
                  {n.link_url && (
                    <Link
                      href={n.link_url}
                      className="mt-2 inline-block font-mono text-[11px] font-black text-sky-700 uppercase hover:underline"
                    >
                      Open →
                    </Link>
                  )}
                </div>
              </div>
            </BrutalCard>
          ))}
        </div>
      )}
    </div>
  );
}
