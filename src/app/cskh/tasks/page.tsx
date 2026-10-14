import { requireStaff } from "@/server/teaching";
import { TaskBoard } from "@/features/teaching/task-board";
import { AppShell } from "@/components/app-shell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff(["cskh"]);
  return (
    <AppShell
      role="cskh"
      name={profile.full_name}
      active="tasks"
      title="Mission Board"
      subtitle="Tất cả công việc chăm sóc học sinh cần xử lý, theo dõi và phản hồi."
    >
      <TaskBoard filters={await searchParams} />
    </AppShell>
  );
}
