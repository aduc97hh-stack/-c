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
    Functions: Record<string, never>;
    Enums: { app_role: Role; media_permission: "yes" | "no" | "pending" };
    CompositeTypes: Record<string, never>;
  };
};
