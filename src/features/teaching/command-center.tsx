import Link from "next/link";
import { required } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
export async function CommandCenter() {
  const db = await supabaseServer();
  const stats = required(await db.rpc("command_summary", {}));
  return (
    <section className="card">
      <h2>Command Center</h2>
      <p>
        Hôm nay: {stats.sessions} session · {stats.completed} hoàn thành
      </p>
      <p>
        Pulse: Xanh {stats.green} · Vàng {stats.yellow} · Đỏ {stats.red}
      </p>
      <p>
        Tasks: {stats.open} mở · {stats.overdue} quá hạn · {stats.high} ưu tiên
        cao · {stats.unassigned} chưa có owner hợp lệ
      </p>
      <nav>
        <Link href="/admin/sessions">Lịch lớp</Link>
        <Link href="/admin/tasks">Mission Board / phân công</Link>
      </nav>
      <h3>Buổi học chưa checkout ({stats.pending.length})</h3>
      <ul>
        {stats.pending.map((s) => (
          <li key={s.id}>
            <Link href={`/teacher/sessions/${s.id}`}>
              {s.teacher} · {s.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
