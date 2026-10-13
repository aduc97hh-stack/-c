export const roles = ["admin", "teacher", "cskh", "media"] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  admin: "Quản trị",
  teacher: "Giáo viên",
  cskh: "Chăm sóc học sinh",
  media: "Truyền thông",
};
export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.some((role) => role === value);
}
export function canAccessRole(actual: Role, requested: Role) {
  return actual === requested;
}
