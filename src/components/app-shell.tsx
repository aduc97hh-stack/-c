import Link from "next/link";
import { logout } from "@/app/actions";
import { roleLabels, type Role } from "@/config/roles";

const adminNav = [
  { href: "/admin", label: "Tổng quan", icon: "⌂", key: "dashboard" },
  { href: "/admin/schedules", label: "Lịch dạy", icon: "◫", key: "schedule" },
  { href: "/admin/tasks", label: "Công việc", icon: "✓", key: "tasks" },
  { href: "/admin/operations", label: "Vận hành", icon: "◎", key: "operations" },
  { href: "/notifications", label: "Thông báo", icon: "◉", key: "notifications" },
] as const;

const roleNav: Record<Role, ReadonlyArray<{ href: string; label: string; icon: string; key: string }>> = {
  admin: adminNav,
  teacher: [
    { href: "/teacher", label: "Tổng quan", icon: "⌂", key: "dashboard" },
    { href: "/teacher/today", label: "Hôm nay", icon: "◫", key: "today" },
    { href: "/teacher/tasks", label: "Công việc", icon: "✓", key: "tasks" },
    { href: "/notifications", label: "Thông báo", icon: "◉", key: "notifications" },
  ],
  cskh: [
    { href: "/cskh", label: "Tổng quan", icon: "⌂", key: "dashboard" },
    { href: "/cskh/tasks", label: "Mission Board", icon: "✓", key: "tasks" },
    { href: "/notifications", label: "Thông báo", icon: "◉", key: "notifications" },
  ],
  media: [
    { href: "/media", label: "Media Hub", icon: "▣", key: "dashboard" },
  ],
};

export function AppShell({
  role,
  name,
  active = "dashboard",
  title,
  subtitle,
  children,
}: {
  role: Role;
  name: string;
  active?: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">G</div>
          <div>
            <strong>GAMI OS</strong>
            <span>English Center</span>
          </div>
        </div>

        <nav className="side-nav" aria-label="Điều hướng chính">
          {roleNav[role].map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={active === item.key ? "active" : ""}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-user">
          <div className="avatar">{name.trim().slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{name}</strong>
            <span>{roleLabels[role]}</span>
          </div>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <div>
            <p className="page-kicker">GAMI ENGLISH · OPERATIONS</p>
            <h1>{title}</h1>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          <form action={logout}>
            <button className="button-secondary">Đăng xuất</button>
          </form>
        </header>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}
