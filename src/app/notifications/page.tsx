import Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { OperationForm } from "@/features/operations/form";
import { displayTime } from "@/features/teaching/model";
export default async function Page() {
  const p = await requireStaff(["admin", "teacher", "cskh", "media"]);
  const db = await supabaseServer();
  const notices =
    checked(
      await db
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ) ?? [];
  return (
    <main className="shell">
      <Link href={"/" + p.role}>← Dashboard</Link>
      <h1>Thông báo</h1>
      {!notices.length && <p>Chưa có thông báo.</p>}
      {notices.map((n) => (
        <section className="card" key={n.id} data-notification={n.id}>
          <h2>
            {n.critical ? "Ưu tiên · " : ""}
            {n.title}
          </h2>
          <p>{n.message}</p>
          <p>
            {displayTime(n.created_at)} ·{" "}
            {n.resolved_at ? "Đã xử lý" : n.read_at ? "Đã đọc" : "Chưa đọc"}
          </p>
          <Link className="button-link" href={n.link}>
            Mở để xử lý
          </Link>
          {!n.read_at && (
            <OperationForm command="read">
              <input type="hidden" name="id" value={n.id} />
              <button>Đánh dấu đã đọc</button>
            </OperationForm>
          )}
        </section>
      ))}
      <p>100 thông báo gần nhất.</p>
    </main>
  );
}
