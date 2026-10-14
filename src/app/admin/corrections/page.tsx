import { AppShell } from "@/components/app-shell";\nimport Link from "next/link";
import { requireStaff, checked } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { OperationForm } from "@/features/operations/form";
import {
  correctionFields,
  correctionValueLabel,
} from "@/features/operations/model";
import { displayTime } from "@/features/teaching/model";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff(["admin"]);
  const db = await supabaseServer();
  const raw = (await searchParams).status;
  const filter =
    raw === "approved" || raw === "rejected" || raw === "all" ? raw : "pending";
  let query = db
    .from("session_corrections")
    .select("*")
    .order("created_at", { ascending: filter === "pending" })
    .limit(50);
  if (filter !== "all") query = query.eq("status", filter);
  const corrections = checked(await query) ?? [];
  const records =
    checked(
      await db
        .from("session_student_records")
        .select("id,student_id")
        .in(
          "id",
          corrections
            .map((c) => c.record_id)
            .filter((id): id is string => !!id),
        ),
    ) ?? [];
  const [s, p] = await Promise.all([
    db
      .from("students")
      .select("id,full_name")
      .in(
        "id",
        records.map((r) => r.student_id),
      ),
    db.from("profiles").select("id,full_name"),
  ]);
  const students = checked(s) ?? [],
    profiles = checked(p) ?? [];
  return (
    <AppShell role="admin" name={profile.full_name} active="operations" title="Corrections" subtitle="Xem xét và phê duyệt các điều chỉnh dữ liệu sau buổi học.">
      <Link href="/admin/operations">← Vận hành</Link>
      <h1>Correction requests</h1>
      <p>
        Phê duyệt thêm amendment có audit; bản completed gốc không bị ghi đè.
      </p>
      <form method="GET">
        <label>
          Trạng thái yêu cầu
          <select name="status" defaultValue={filter}>
            {["pending", "approved", "rejected", "all"].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <button>Lọc yêu cầu</button>
      </form>
      {corrections.map((c) => (
        <section className="card" key={c.id} data-correction={c.id}>
          <h2>
            {correctionFields[c.field_name]} · {c.status}
          </h2>
          <p>
            {students.find(
              (s) =>
                s.id === records.find((r) => r.id === c.record_id)?.student_id,
            )?.full_name ?? "Cả buổi học"}{" "}
            · {profiles.find((p) => p.id === c.requested_by)?.full_name} ·{" "}
            {displayTime(c.created_at)}
          </p>
          <Link href={"/teacher/sessions/" + c.session_id}>Xem session</Link>
          <p>
            Cũ: {correctionValueLabel(c.field_name, c.old_value) || "(trống)"}
          </p>
          <p>
            Đề nghị:{" "}
            {correctionValueLabel(c.field_name, c.new_value) || "(trống)"}
          </p>
          <p>Lý do: {c.reason}</p>
          {c.status === "pending" ? (
            <OperationForm command="review">
              <input type="hidden" name="id" value={c.id} />
              <label>
                Quyết định
                <select name="approve">
                  <option value="yes">Phê duyệt</option>
                  <option value="no">Từ chối</option>
                </select>
              </label>
              <label>
                Ghi chú xét duyệt (bắt buộc khi từ chối)
                <textarea name="note" maxLength={1000} />
              </label>
              <button>Xét duyệt</button>
            </OperationForm>
          ) : (
            <p>
              {c.review_note} · {c.reviewed_at && displayTime(c.reviewed_at)}
            </p>
          )}
        </section>
      ))}
      {!corrections.length && <p>Không có yêu cầu.</p>}
      <p>Tối đa 50 yêu cầu theo bộ lọc; pending ưu tiên cũ nhất.</p>
    </AppShell>
  );
}
