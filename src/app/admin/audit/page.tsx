import { AppShell } from "@/components/app-shell";\nimport Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { displayTime } from "@/features/teaching/model";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff(["admin"]);
  const filters = await searchParams;
  const db = await supabaseServer();
  const page = Math.max(0, Math.floor(Number(filters.page) || 0));
  let q = db
    .from("audit_events")
    .select("*", { count: "exact" })
    .order("id", { ascending: false })
    .range(page * 50, page * 50 + 49);
  if (filters.entity) q = q.eq("entity_type", filters.entity);
  if (filters.actor) q = q.eq("actor_id", filters.actor);
  const result = await q;
  const events = checked(result) ?? [];
  const profiles =
    checked(await db.from("profiles").select("id,full_name")) ?? [];
  return (
    <AppShell role="admin" name={profile.full_name} active="operations" title="Nhật ký vận hành" subtitle="Theo dõi thay đổi và dấu vết xử lý trong hệ thống.">
      <Link href="/admin/operations">← Vận hành</Link>
      <h1>Audit trail</h1>
      <form method="GET" className="card">
        <label>
          Entity
          <select name="entity" defaultValue={filters.entity ?? ""}>
            <option value="">Tất cả</option>
            {[
              "class_sessions",
              "tasks",
              "profiles",
              "session_corrections",
              "schedule",
              "class",
              "operations",
            ].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Actor
          <select name="actor" defaultValue={filters.actor ?? ""}>
            <option value="">Tất cả</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <button>Lọc audit</button>
      </form>
      <p>{result.count} audit entries</p>
      <ul>
        {events.map((e) => (
          <li key={e.id}>
            {displayTime(e.created_at)} ·{" "}
            {profiles.find((p) => p.id === e.actor_id)?.full_name ?? "System"} ·{" "}
            {e.action} · {e.entity_id}
            <pre>{JSON.stringify(e.metadata)}</pre>
          </li>
        ))}
      </ul>
      <nav>
        {page > 0 && (
          <Link
            href={
              "?" +
              new URLSearchParams({
                ...filters,
                page: String(page - 1),
              } as Record<string, string>)
            }
          >
            Trang trước
          </Link>
        )}
        {(page + 1) * 50 < (result.count ?? 0) && (
          <Link
            href={
              "?" +
              new URLSearchParams({
                ...filters,
                page: String(page + 1),
              } as Record<string, string>)
            }
          >
            Trang sau
          </Link>
        )}
      </nav>
    </AppShell>
  );
}
