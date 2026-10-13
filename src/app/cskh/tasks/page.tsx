import { requireStaff } from "@/server/teaching";
import Link from "next/link";
import { TaskBoard } from "@/features/teaching/task-board";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireStaff(["cskh"]);
  return (
    <main className="shell">
      <Link href="/cskh">← Dashboard</Link>
      <TaskBoard filters={await searchParams} />
    </main>
  );
}
