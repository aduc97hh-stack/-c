"use server";
import { requireStaff } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import type { CheckoutData, TaskStatus } from "./model";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
export async function startSession(id: string) {
  await requireStaff(["teacher", "admin"]);
  const db = await supabaseServer();
  const r = await db.rpc("start_class_session", { p_session: id });
  if (r.error)
    throw new Error(
      "Không thể bắt đầu buổi học. Kiểm tra phân công và trạng thái.",
    );
  revalidatePath("/teacher/today");
  revalidatePath(`/teacher/sessions/${id}`);
}
export async function saveCheckout(
  id: string,
  version: number,
  data: CheckoutData,
  complete: boolean,
) {
  await requireStaff(["teacher", "admin"]);
  const db = await supabaseServer();
  const result = await db.rpc("save_session_checkout", {
    p_session: id,
    p_version: version,
    p_data: data,
    p_complete: complete,
  });
  if (result.error || !result.data)
    return {
      ok: false as const,
      error:
        result.error?.code === "40001"
          ? "Draft đã thay đổi ở tab khác. Giữ nội dung đang nhập và tải lại để đối chiếu."
          : "Không lưu được. Kiểm tra dữ liệu, quyền và trạng thái buổi học rồi thử lại.",
    };
  revalidatePath("/teacher/today");
  revalidatePath("/admin");
  revalidatePath(`/teacher/sessions/${id}`);
  return { ok: true as const, ...result.data };
}
export async function createSession(form: FormData) {
  await requireStaff(["admin"]);
  const db = await supabaseServer();
  const value = (key: string) => String(form.get(key) ?? "");
  const day = value("date");
  const r = await db.rpc("create_class_session", {
    p_class: value("class_id"),
    p_teacher: value("teacher_id"),
    p_start: new Date(`${day}T${value("start")}:00+07:00`).toISOString(),
    p_end: new Date(`${day}T${value("end")}:00+07:00`).toISOString(),
    p_title: value("title"),
  });
  if (r.error)
    throw new Error(
      "Lịch không hợp lệ: giáo viên phải được giao lớp, giờ kết thúc sau giờ bắt đầu và không trùng buổi.",
    );
  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}
export async function changeTask(form: FormData) {
  await requireStaff(["admin", "cskh", "teacher"]);
  const db = await supabaseServer();
  const follow = String(form.get("follow_up") ?? "");
  const result = await db.rpc("update_task", {
    p_task: String(form.get("id")),
    p_version: Number(form.get("version")),
    p_status: String(form.get("status")) as TaskStatus,
    p_result: String(form.get("result") ?? ""),
    p_follow_up: follow ? new Date(follow + "+07:00").toISOString() : null,
    p_owner: String(form.get("owner") ?? "") || null,
  });
  if (result.error)
    throw new Error(
      "Không thể cập nhật. Kiểm tra quyền, phiên bản, trạng thái, kết quả và lịch hẹn.",
    );
  revalidatePath("/cskh/tasks");
  revalidatePath("/admin");
  redirect("/tasks/" + String(form.get("id")));
}
