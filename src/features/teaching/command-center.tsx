import Link from "next/link";
import { required } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";

export async function CommandCenter() {
  const db = await supabaseServer();
  const stats = required(await db.rpc("command_summary", {}));

  return (
    <section className="command-center">
      <div className="command-header">
        <div>
          <p className="panel-kicker">COMMAND CENTER</p>
          <h2>Tình hình hôm nay</h2>
        </div>
        <div className="command-actions">
          <Link href="/admin/schedules">Lịch lớp</Link>
          <Link href="/admin/tasks">Mission Board</Link>
          <Link href="/admin/operations">Vận hành</Link>
        </div>
      </div>

      <div className="pulse-grid">
        <article>
          <span className="pulse-dot green" />
          <div>
            <strong>{stats.green}</strong>
            <p>Ổn định</p>
          </div>
        </article>
        <article>
          <span className="pulse-dot yellow" />
          <div>
            <strong>{stats.yellow}</strong>
            <p>Cần theo dõi</p>
          </div>
        </article>
        <article>
          <span className="pulse-dot red" />
          <div>
            <strong>{stats.red}</strong>
            <p>Cần xử lý</p>
          </div>
        </article>
      </div>

      <div className="ops-summary-grid">
        <article>
          <span>{stats.sessions}</span>
          <p>Buổi học hôm nay</p>
        </article>
        <article>
          <span>{stats.completed}</span>
          <p>Đã hoàn thành</p>
        </article>
        <article>
          <span>{stats.open}</span>
          <p>Việc đang mở</p>
        </article>
        <article className={stats.overdue ? "alert" : ""}>
          <span>{stats.overdue}</span>
          <p>Quá hạn</p>
        </article>
        <article className={stats.high ? "warning" : ""}>
          <span>{stats.high}</span>
          <p>Ưu tiên cao</p>
        </article>
      </div>

      {stats.pending.length > 0 && (
        <div className="pending-checkout">
          <div className="panel-heading compact">
            <div>
              <p className="panel-kicker">CẦN CHÚ Ý</p>
              <h3>Buổi học chưa checkout</h3>
            </div>
            <span className="mini-count">{stats.pending.length}</span>
          </div>
          <div className="simple-list">
            {stats.pending.map((s) => (
              <Link className="simple-list-row linked" href={`/teacher/sessions/${s.id}`} key={s.id}>
                <span className="dot-indicator warning" />
                <span>
                  <strong>{s.title}</strong>
                  <small>{s.teacher}</small>
                </span>
                <span className="row-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
