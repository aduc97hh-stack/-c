import { requireStaff } from "@/server/teaching";
import { TaskBoard } from "@/features/teaching/task-board";
import { AppShell } from "@/components/app-shell";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireStaff(["teacher"]);
  return (
    <AppShell
      role="teacher"
      name={profile.full_name}
      active="tasks"
      title="Việc cần kiểm tra"
      subtitle="Những học sinh cần xem lại bài, điểm số hoặc tình trạng học tập sau buổi học."
    >
      <TaskBoard filters={await searchParams} />
    </AppShell>
  );
}
