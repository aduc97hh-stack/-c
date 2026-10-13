export type SessionStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";
export type TaskStatus =
  | "open"
  | "in_progress"
  | "waiting_parent"
  | "waiting_teacher"
  | "done"
  | "cancelled";
export type TaskType =
  | "homework_followup"
  | "absence_followup"
  | "low_score_followup"
  | "teacher_review"
  | "general_attention";
export type Session = {
  id: string;
  class_id: string;
  teacher_id: string;
  starts_at: string;
  ends_at: string;
  lesson_title: string;
  lesson_content: string;
  homework_assigned: string;
  status: SessionStatus;
  version: number;
  completed_at: string | null;
  completed_by: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type LearningRecord = {
  id: string;
  session_id: string;
  student_id: string;
  attendance: "present" | "absent_excused" | "absent_unexcused";
  homework_status: "done" | "partial" | "missing" | "not_applicable";
  old_lesson_status: "passed" | "needs_review" | "not_checked";
  quick_score: number | null;
  needs_attention: boolean;
  attention_reasons: string[];
  created_at: string;
  updated_at: string;
};
export type CheckoutRecord = Pick<
  LearningRecord,
  | "student_id"
  | "attendance"
  | "homework_status"
  | "old_lesson_status"
  | "quick_score"
  | "needs_attention"
  | "attention_reasons"
> & { teacher_note: string };
export type CheckoutData = {
  records: CheckoutRecord[];
  lesson_content: string;
  homework_assigned: string;
};
export type Task = {
  id: string;
  student_id: string;
  source_session_id: string | null;
  source_record_id: string | null;
  type: TaskType;
  owner_id: string | null;
  backup_owner_id: string | null;
  priority: "normal" | "high" | "urgent";
  status: TaskStatus;
  title: string;
  description: string;
  due_at: string;
  completed_at: string | null;
  result: string | null;
  follow_up_at: string | null;
  version: number;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
export type StudentEvent = {
  id: string;
  student_id: string;
  session_id: string | null;
  task_id: string | null;
  event_type: string;
  summary: string;
  idempotency_key: string;
  created_by: string;
  created_at: string;
};
export type Attachment = {
  id: string;
  session_id: string;
  student_id: string | null;
  uploaded_by: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};
export type Pulse = { color: "green" | "yellow" | "red"; reasons: string[] };
export type StudentContext = {
  class_name: string | null;
  teachers: string[] | null;
  cskh: string[] | null;
};
export const schoolZone = "Asia/Bangkok";
export function schoolDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: schoolZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function todayBounds(date = new Date()) {
  const start = new Date(schoolDate(date) + "T00:00:00+07:00");
  return [
    start.toISOString(),
    new Date(start.getTime() + 86400000).toISOString(),
  ];
}
export function displayTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: schoolZone,
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
export const statusLabels: Record<TaskStatus, string> = {
  open: "Mở",
  in_progress: "Đang xử lý",
  waiting_parent: "Chờ phụ huynh",
  waiting_teacher: "Chờ giáo viên",
  done: "Đã hoàn thành",
  cancelled: "Đã hủy",
};
export function taskGroup(task: Task, now = new Date()) {
  if (task.status === "done" || task.status === "cancelled")
    return "Đã hoàn thành";
  if (task.status === "waiting_parent" || task.status === "waiting_teacher")
    return statusLabels[task.status];
  if (new Date(task.due_at) < now) return "Quá hạn";
  return schoolDate(new Date(task.due_at)) === schoolDate(now)
    ? "Hôm nay"
    : "Sắp tới";
}
export function canTransition(from: TaskStatus, to: TaskStatus, admin = false) {
  return !["done", "cancelled"].includes(from) && (to !== "cancelled" || admin);
}
export const uploadLimits = {
  image: 10 * 1024 * 1024,
  video: 40 * 1024 * 1024,
};
export function inspectAttachment(bytes: Uint8Array) {
  const ascii = (start: number, end: number) =>
    new TextDecoder().decode(bytes.slice(start, end));
  let mime = "",
    extension = "";
  if (
    bytes.length >= 24 &&
    ascii(12, 16) === "IHDR" &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  ) {
    mime = "image/png";
    extension = "png";
  } else if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes.at(-2) === 255 &&
    bytes.at(-1) === 217
  ) {
    mime = "image/jpeg";
    extension = "jpg";
  } else if (
    bytes.length >= 12 &&
    ascii(0, 4) === "RIFF" &&
    ascii(8, 12) === "WEBP"
  ) {
    mime = "image/webp";
    extension = "webp";
  } else if (
    bytes.length >= 16 &&
    ascii(4, 8) === "ftyp" &&
    ["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(ascii(8, 12))
  ) {
    mime = "video/mp4";
    extension = "mp4";
  } else throw new Error("Chỉ nhận JPEG, PNG, WEBP hoặc MP4 hợp lệ.");
  if (
    bytes.length >
    (mime.startsWith("video") ? uploadLimits.video : uploadLimits.image)
  )
    throw new Error("Ảnh tối đa 10 MB, video tối đa 40 MB.");
  return { mime, extension };
}
