import { requireStaff } from "@/server/teaching";
import Link from "next/link";
import { TaskBoard } from "@/features/teaching/task-board";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff(["admin"]);
  return (
    <main className="shell">
      <Link href="/admin">← Dashboard</Link>
      <TaskBoard filters={await searchParams} />
    </main>
  );
}
