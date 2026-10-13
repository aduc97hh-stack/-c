export type ScheduleTemplate = {
  id: string;
  class_id: string;
  teacher_id: string;
  starts_on: string;
  ends_on: string;
  active: boolean;
  version: number;
  created_by: string;
  created_at: string;
};
export type ScheduleRule = {
  template_id: string;
  weekday: number;
  starts_local: string;
  ends_local: string;
};
export type Correction = {
  id: string;
  session_id: string;
  record_id: string | null;
  field_name: string;
  old_value: string;
  new_value: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};
export type Notice = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  entity_type: string;
  entity_id: string;
  critical: boolean;
  dedupe_key: string;
  read_at: string | null;
  resolved_at: string | null;
  created_at: string;
};
export type PilotEvent = {
  id: string;
  attempt_id: string;
  session_id: string;
  user_id: string;
  event_type: "checkout_opened" | "checkout_completed" | "save_error";
  duration_seconds: number | null;
  student_count: number;
  exception_count: number;
  device_category: string;
  error_key: string | null;
  created_at: string;
};
export type AuditEvent = {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
export type OperationRules = {
  session_teacher_hours: number;
  session_admin_hours: number;
  task_owner_hours: number;
  task_admin_hours: number;
  high_hours: number;
  horizon_days: number;
};
export type PilotMetrics = {
  sessions: number;
  median_seconds: number | null;
  p90_seconds: number | null;
  average_exceptions: number | null;
  save_errors: number;
};
export type OperationsSummary = {
  as_of: string;
  corrections: number;
  critical_unread: number;
  pilot: PilotMetrics;
  sessions: { id: string; status: string; title: string; ends_at: string }[];
};
export type ActionState = { ok: boolean; message: string };
export const weekdayLabels = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];
export const correctionFields: Record<string, string> = {
  homework_status: "BTVN",
  attendance: "Đi học",
  old_lesson_status: "Bài cũ",
  quick_score: "Điểm nhanh",
  needs_attention: "Cần lưu ý",
  teacher_note: "Ghi chú riêng",
  lesson_content: "Nội dung buổi học",
  homework_assigned: "BTVN mới",
};
export function recurrencePreview(
  from: string,
  until: string,
  days: number[],
  start: string,
  end: string,
) {
  const a = new Date(from + "T00:00:00+07:00"),
    b = new Date(until + "T00:00:00+07:00");
  if (
    !Number.isFinite(+a) ||
    !Number.isFinite(+b) ||
    b < a ||
    +b - +a > 56 * 86400000 ||
    end <= start ||
    days.length === 0
  )
    return [];
  const results: string[] = [];
  for (let t = +a; t <= +b; t += 86400000) {
    const d = new Date(t + 7 * 3600000);
    if (days.includes(d.getUTCDay()))
      results.push(d.toISOString().slice(0, 10));
  }
  return results;
}
export function correctionDecision(status: string, approve: boolean) {
  return status === "pending" ? (approve ? "approved" : "rejected") : status;
}
export function escalationLevel(
  ageHours: number,
  ownerHours: number,
  adminHours: number,
) {
  return ageHours >= adminHours
    ? "admin"
    : ageHours >= ownerHours
      ? "owner"
      : "none";
}
export function noticeKey(entity: string, id: string, level: string) {
  return `${entity}:${id}:${level}`;
}
export function durationSeconds(opened: string, completed: string) {
  return Math.max(0, (+new Date(completed) - +new Date(opened)) / 1000);
}

export const thresholdLabels: Record<string, string> = {
  session_teacher_hours: "Nhắc giáo viên sau giờ kết thúc (giờ)",
  session_admin_hours: "Báo admin khi chưa checkout (giờ)",
  task_owner_hours: "Nhắc owner sau deadline (giờ)",
  task_admin_hours: "Báo admin sau deadline (giờ)",
  high_hours: "Cảnh báo việc ưu tiên cao chưa xử lý (giờ)",
  horizon_days: "Tạo lịch trước bao nhiêu ngày",
};
export function correctionValueLabel(field: string, value: string) {
  const map: Record<string, Record<string, string>> = {
    homework_status: {
      done: "Đủ BTVN",
      partial: "Một phần",
      missing: "Thiếu BTVN",
      not_applicable: "Không giao",
    },
    attendance: {
      present: "Có mặt",
      absent_excused: "Vắng có phép",
      absent_unexcused: "Vắng không phép",
    },
    old_lesson_status: {
      passed: "Đạt",
      needs_review: "Cần kiểm tra lại",
      not_checked: "Chưa kiểm",
    },
    needs_attention: { true: "Cần lưu ý", false: "Không có lưu ý" },
  };
  return map[field]?.[value] ?? value;
}
