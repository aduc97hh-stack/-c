"use server";
import { requireStaff } from "@/server/teaching";
import { supabaseServer } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ActionState } from "./model";
export async function operate(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const command = String(form.get("command"));
  await requireStaff(
    command === "correction"
      ? ["teacher"]
      : command === "read"
        ? ["admin", "teacher", "cskh", "media"]
        : ["admin"],
  );
  const db = await supabaseServer();
  const val = (k: string) => String(form.get(k) ?? "");
  const num = (k: string) => Number(val(k));
  try {
    let error: { code?: string } | null = null;
    let message = "Đã lưu.";
    if (command === "schedule") {
      const r = await db.rpc("save_schedule", {
        p_class: val("class"),
        p_teacher: val("teacher"),
        p_from: val("from"),
        p_until: val("until"),
        p_weekdays: form.getAll("weekday").map(Number),
        p_start: val("start"),
        p_end: val("end"),
        p_replace: val("replace") || null,
        p_version: val("replace") ? num("version") : null,
      });
      error = r.error;
      if (!error)
        message =
          "Đã lưu template. Bấm Tạo sessions hoặc chạy vận hành để tạo lịch.";
    } else if (command === "generate") {
      const r = await db.rpc("generate_schedule", {
        p_template: val("template"),
        p_from: val("from"),
        p_until: val("until"),
      });
      error = r.error;
      if (r.data)
        message = `Đã tạo ${r.data.generated} sessions. Conflict: ${r.data.conflicts.length ? r.data.conflicts.join(", ") : "không có"}.`;
    } else if (command === "exception")
      error = (
        await db.rpc("session_exception", {
          p_session: val("session"),
          p_version: num("version"),
          p_cancel: val("cancel") === "yes",
          p_teacher: val("teacher") || null,
          p_reason: val("reason"),
        })
      ).error;
    else if (command === "correction")
      error = (
        await db.rpc("request_correction", {
          p_session: val("session"),
          p_record: val("record") || null,
          p_field: val("field"),
          p_value: val("value"),
          p_reason: val("reason"),
        })
      ).error;
    else if (command === "review")
      error = (
        await db.rpc("review_correction", {
          p_id: val("id"),
          p_approve: val("approve") === "yes",
          p_note: val("note"),
        })
      ).error;
    else if (command === "read")
      error = (await db.rpc("mark_notification", { p_id: val("id") })).error;
    else if (command === "pilot")
      error = (
        await db.rpc("configure_pilot", {
          p_mode: val("mode") === "on",
          p_teacher: val("teacher"),
          p_class: val("class"),
          p_enable: val("enable") === "yes",
        })
      ).error;
    else if (command === "thresholds")
      error = (
        await db.rpc("configure_operations", {
          p_teacher_hours: num("session_teacher_hours"),
          p_session_admin: num("session_admin_hours"),
          p_owner_hours: num("task_owner_hours"),
          p_task_admin: num("task_admin_hours"),
          p_high: num("high_hours"),
          p_horizon: num("horizon_days"),
        })
      ).error;
    else if (command === "run") {
      const r = await db.rpc("run_daily_operations", {});
      error = r.error;
      if (r.data)
        message = `Đã chạy: ${r.data.generated} sessions mới, ${r.data.conflicts} conflict, ${r.data.notifications} notifications mới.`;
    } else return { ok: false, message: "Thao tác không hợp lệ." };
    if (error)
      console.error("operation_failed", {
        operation: command,
        code: error.code ?? "unknown",
      });
    if (error)
      return {
        ok: false,
        message:
          error.code === "40001"
            ? "Dữ liệu đã đổi. Tải lại để đối chiếu."
            : "Không lưu được. Kiểm tra phân công, phạm vi pilot, giá trị, lịch trùng và trạng thái.",
      };
    for (const path of [
      "/admin",
      "/admin/operations",
      "/admin/schedules",
      "/admin/corrections",
      "/admin/audit",
      "/notifications",
      "/teacher/today",
    ])
      revalidatePath(path);
    if (val("session")) revalidatePath("/teacher/sessions/" + val("session"));
    return { ok: true, message };
  } catch {
    return {
      ok: false,
      message:
        "Kết nối gián đoạn hoặc dữ liệu không hợp lệ. Giữ form và thử lại.",
    };
  }
}
export async function openPilot(id: string, device: string) {
  const p = await requireStaff(["admin", "teacher"]);
  if (p.role !== "teacher") return null;
  const db = await supabaseServer();
  const r = await db.rpc("open_pilot_checkout", {
    p_session: id,
    p_device: device,
  });
  return r.error ? null : r.data;
}
export async function pilotError(attempt: string, errorId: string) {
  await requireStaff(["teacher"]);
  const db = await supabaseServer();
  const r = await db.rpc("record_pilot_error", {
    p_attempt: attempt,
    p_error: errorId,
  });
  return !r.error;
}
