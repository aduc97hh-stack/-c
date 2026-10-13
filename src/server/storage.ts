import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
// Privileged key is used only for byte-validated uploads and orphan cleanup.
// All authorization and metadata registration use the caller's authenticated client.
export function storageUploader() {
  const config = supabaseConfig(),
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !key)
    throw new Error("Storage upload chưa được cấu hình phía server.");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from("session-attachments");
}
