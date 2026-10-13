import type {
  Session,
  LearningRecord,
  Task,
  StudentEvent,
  Attachment,
  CheckoutData,
  Pulse,
  StudentContext,
  TaskStatus,
} from "@/features/teaching/model";
import type { Role } from "@/config/roles";
type Table<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};
export type Database = {
  public: {
    Tables: {
      class_sessions: Table<
        Session,
        | "class_id"
        | "teacher_id"
        | "starts_at"
        | "ends_at"
        | "lesson_title"
        | "created_by"
      >;
      session_student_records: Table<
        LearningRecord,
        "session_id" | "student_id"
      >;
      record_notes: Table<
        { record_id: string; teacher_note: string },
        "record_id" | "teacher_note"
      >;
      tasks: Table<
        Task,
        "student_id" | "type" | "title" | "due_at" | "created_by"
      >;
      student_events: Table<
        StudentEvent,
        | "student_id"
        | "event_type"
        | "summary"
        | "idempotency_key"
        | "created_by"
      >;
      session_attachments: Table<
        Attachment,
        | "session_id"
        | "uploaded_by"
        | "storage_path"
        | "mime_type"
        | "size_bytes"
      >;
      profiles: Table<
        {
          id: string;
          full_name: string;
          role: Role;
          active: boolean;
          created_at: string;
          updated_at: string;
        },
        "id" | "full_name" | "role"
      >;
      classes: Table<
        {
          id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        },
        "name"
      >;
      students: Table<
        {
          id: string;
          student_code: string;
          full_name: string;
          date_of_birth: string | null;
          class_id: string | null;
          media_permission: "yes" | "no" | "pending";
          active: boolean;
          created_at: string;
          updated_at: string;
        },
        "student_code" | "full_name"
      >;
      student_contacts: Table<
        {
          student_id: string;
          parent_name: string;
          parent_phone: string;
          created_at: string;
          updated_at: string;
        },
        "student_id" | "parent_name" | "parent_phone"
      >;
      teacher_class_assignments: Table<
        { teacher_id: string; class_id: string; created_at: string },
        "teacher_id" | "class_id"
      >;
      cskh_student_assignments: Table<
        { cskh_id: string; student_id: string; created_at: string },
        "cskh_id" | "student_id"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      student_session_history: {
        Args: { p_student: string };
        Returns: {
          id: string;
          status: import("@/features/teaching/model").SessionStatus;
          starts_at: string;
        }[];
      };
      session_roster: {
        Args: { p_session: string };
        Returns: { id: string; full_name: string; student_code: string }[];
      };
      teaching_configuration: {
        Args: Record<string, never>;
        Returns: {
          window_days: number;
          repeat_count: number;
          low_score: number;
          due_hours: number;
        };
      };
      class_directory: {
        Args: Record<string, never>;
        Returns: { id: string; name: string }[];
      };
      command_summary: {
        Args: Record<string, never>;
        Returns: {
          green: number;
          yellow: number;
          red: number;
          sessions: number;
          completed: number;
          pending: { id: string; title: string; teacher: string }[];
          open: number;
          overdue: number;
          high: number;
          unassigned: number;
        };
      };
      create_class_session: {
        Args: {
          p_class: string;
          p_teacher: string;
          p_start: string;
          p_end: string;
          p_title: string;
        };
        Returns: string;
      };
      start_class_session: { Args: { p_session: string }; Returns: number };
      save_session_checkout: {
        Args: {
          p_session: string;
          p_version: number;
          p_data: CheckoutData;
          p_complete: boolean;
        };
        Returns: { version: number; completed: boolean; replayed: boolean };
      };
      update_task: {
        Args: {
          p_task: string;
          p_version: number;
          p_status: TaskStatus;
          p_result?: string | null;
          p_follow_up?: string | null;
          p_owner?: string | null;
        };
        Returns: number;
      };
      student_context: { Args: { p_student: string }; Returns: StudentContext };
      student_pulse: { Args: { p_student: string }; Returns: Pulse };
      register_session_attachment: {
        Args: {
          p_session: string;
          p_path: string;
          p_mime: string;
          p_size: number;
          p_student?: string | null;
        };
        Returns: string;
      };
    };
    Enums: { app_role: Role; media_permission: "yes" | "no" | "pending" };
    CompositeTypes: Record<string, never>;
  };
};
