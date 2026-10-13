import Link from "next/link";
import { sessionData } from "@/server/teaching";
import { startSession } from "@/features/teaching/actions";
import { Workbench } from "@/features/teaching/workbench";
import { Attachments } from "@/features/teaching/attachments";
import { displayTime } from "@/features/teaching/model";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await sessionData(id);
  const { session, profile } = data;
  const mayEdit = profile.role === "admin" || session.teacher_id === profile.id;
  const names = Object.fromEntries(
    data.students.map((s) => [s.id, s.full_name]),
  );
  const notes = Object.fromEntries(
    data.notes.map((n) => [n.record_id, n.teacher_note]),
  );
  return (
    <main className="shell">
      <Link
        href={profile.role === "admin" ? "/admin/sessions" : "/teacher/today"}
      >
        ← Lịch dạy
      </Link>
      <h1>{session.lesson_title}</h1>
      <p>
        {displayTime(session.starts_at)} — {displayTime(session.ends_at)}
      </p>
      {!mayEdit && session.status !== "completed" ? (
        <section className="card">
          <h2>Chỉ xem buổi học</h2>
          <p>Giáo viên phụ trách buổi học hoặc admin mới có thể cập nhật.</p>
          <ul>
            {data.records.map((r) => (
              <li key={r.id}>{names[r.student_id]}</li>
            ))}
          </ul>
          <Attachments sessionId={id} initial={data.attachments} locked />
        </section>
      ) : session.status === "scheduled" ? (
        <form action={startSession.bind(null, id)}>
          <p>Roster được chốt khi bắt đầu lớp.</p>
          <button>Bắt đầu lớp</button>
        </form>
      ) : session.status === "cancelled" ? (
        <p>Buổi học đã hủy.</p>
      ) : (
        <Workbench
          session={session}
          attachments={data.attachments}
          lowScore={data.config.low_score}
          names={names}
          initial={{
            lesson_content: session.lesson_content,
            homework_assigned: session.homework_assigned,
            records: data.records.map((r) => ({
              ...r,
              teacher_note: notes[r.id] ?? "",
            })),
          }}
        />
      )}
      {session.status === "scheduled" || session.status === "cancelled" ? (
        <Attachments sessionId={id} initial={data.attachments} locked />
      ) : null}
    </main>
  );
}
