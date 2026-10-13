import { redirect } from "next/navigation";
import { currentProfile } from "@/server/auth";
export default async function Home() {
  const profile = await currentProfile();
  redirect(profile ? `/${profile.role}` : "/login");
}
