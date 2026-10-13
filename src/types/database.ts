import type {
  ScheduleTemplate,
  ScheduleRule,
  Correction,
  Notice,
  PilotEvent,
  AuditEvent,
  OperationRules,
  PilotMetrics,
  OperationsSummary,
} from "@/features/operations/model";
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
      class_schedule_templates: Table<
        ScheduleTemplate,
        "class_id" | "teacher_id" | "starts_on" | "ends_on" | "created_by"
      >;
      schedule_rules: Table<
        ScheduleRule,
        "template_id" | "weekday" | "starts_local" | "ends_local"
      >;
      session_corrections: Table<
        Correction,
        | "session_id"
        | "field_name"
        | "old_value"
        | "new_value"
        | "reason"
        | "requested_by"
      >;
      notifications: Table<
        Notice,
        | "user_id"
        | "type"
        | "title"
        | "message"
        | "link"
        | "entity_type"
        | "entity_id"
        | "dedupe_key"
      >;
      audit_events: Table<AuditEvent, "action" | "entity_type" | "entity_id">;
      pilot_config: Table<{ id: boolean; pilot_mode: boolean }, "id">;
      pilot_assignments: Table<
        { teacher_id: string; class_id: string },
        "teacher_id" | "class_id"
      >;
      pilot_events: Table<
        PilotEvent,
        | "attempt_id"
        | "session_id"
        | "user_id"
        | "event_type"
        | "student_count"
        | "exception_count"
        | "device_category"
      >;
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
    Views: {
      effective_session_records: { Row: LearningRecord; Relationships: [] };
    };
    Functions: {
      session_effective_content: {
        Args: { p_session: string };
        Returns: {
          lesson_content: string;
          homework_assigned: string;
          notes: { record_id: string; teacher_note: string }[];
        };
      };
      request_correction: {
        Args: {
          p_session: string;
          p_record: string | null;
          p_field: string;
          p_value: string;
          p_reason: string;
        };
        Returns: string;
      };
      review_correction: {
        Args: { p_id: string; p_approve: boolean; p_note: string };
        Returns: undefined;
      };
      save_schedule: {
        Args: {
          p_class: string;
          p_teacher: string;
          p_from: string;
          p_until: string;
          p_weekdays: number[];
          p_start: string;
          p_end: string;
          p_replace?: string | null;
          p_version?: number | null;
        };
        Returns: string;
      };
      generate_schedule: {
        Args: { p_template: string; p_from: string; p_until: string };
        Returns: { generated: number; conflicts: string[] };
      };
      session_exception: {
        Args: {
          p_session: string;
          p_version: number;
          p_cancel: boolean;
          p_teacher?: string | null;
          p_reason: string;
        };
        Returns: undefined;
      };
      mark_notification: { Args: { p_id: string }; Returns: undefined };
      configure_pilot: {
        Args: {
          p_mode: boolean;
          p_teacher: string;
          p_class: string;
          p_enable: boolean;
        };
        Returns: undefined;
      };
      open_pilot_checkout: {
        Args: { p_session: string; p_device: string };
        Returns: string | null;
      };
      record_pilot_error: {
        Args: { p_attempt: string; p_error: string };
        Returns: undefined;
      };
      operations_configuration: {
        Args: Record<string, never>;
        Returns: OperationRules;
      };
      configure_operations: {
        Args: {
          p_teacher_hours: number;
          p_session_admin: number;
          p_owner_hours: number;
          p_task_admin: number;
          p_high: number;
          p_horizon: number;
        };
        Returns: undefined;
      };
      run_daily_operations: {
        Args: Record<string, never>;
        Returns: {
          generated: number;
          conflicts: number;
          notifications: number;
        };
      };
      pilot_metrics: { Args: Record<string, never>; Returns: PilotMetrics };
      operations_summary: {
        Args: Record<string, never>;
        Returns: OperationsSummary;
      };
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
