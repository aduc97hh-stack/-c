"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";
import type { Database } from "@/types/database";
export function supabaseBrowser() {
  const config = supabaseConfig();
  if (!config) throw new Error("Supabase chưa được cấu hình.");
  return createBrowserClient<Database>(config.url, config.key);
}
