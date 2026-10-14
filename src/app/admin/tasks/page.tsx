import { requireStaff } from "@/server/teaching";
import { TaskBoard } from "@/features/teaching/task-board";
import { AppShell } from "@/components/app-shell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff(["admin"]);
  return (
    <AppShell
      role="admin"
      name={profile.full_name}
      active="tasks"
      title="Công việc hôm nay"
      subtitle="Theo dõi việc quá hạn, việc cần phụ huynh phản hồi và các trường hợp cần xử lý ưu tiên."
    >
      <TaskBoard filters={await searchParams} />
    </AppShell>
  );
}
