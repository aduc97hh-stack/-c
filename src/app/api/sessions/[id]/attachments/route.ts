import { NextResponse, type NextRequest } from "next/server";
import { currentProfile } from "@/server/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { storageUploader } from "@/server/storage";
import { inspectAttachment, uploadLimits } from "@/features/teaching/model";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== request.headers.get("host"))
        return json({ error: "Origin không hợp lệ" }, 403);
    } catch {
      return json({ error: "Origin không hợp lệ" }, 403);
    }
  }
  const profile = await currentProfile();
  if (!profile) return json({ error: "Cần đăng nhập" }, 401);
  if (!["admin", "teacher"].includes(profile.role))
    return json({ error: "Không có quyền" }, 403);
  const { id } = await params;
  if (!uuid.test(id)) return json({ error: "Session không hợp lệ" }, 404);
  const db = await supabaseServer();
  const result = await db
    .from("class_sessions")
    .select("teacher_id,status")
    .eq("id", id)
    .maybeSingle();
  if (
    result.error ||
    !result.data ||
    result.data.status !== "in_progress" ||
    (profile.role !== "admin" && result.data.teacher_id !== profile.id)
  )
    return json({ error: "Session không được upload hoặc đã khóa" }, 403);
  const limit = uploadLimits.video + 1024 * 1024;
  if (Number(request.headers.get("content-length")) > limit)
    return json({ error: "File quá lớn" }, 413);
  try {
    if (!request.body) return json({ error: "Thiếu file" }, 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) {
        await reader.cancel();
        return json({ error: "File quá lớn" }, 413);
      }
      chunks.push(value);
    }
    const form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: Buffer.concat(chunks),
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "Thiếu file" }, 400);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { mime, extension } = inspectAttachment(bytes);
    const path = `${id}/${randomUUID()}.${extension}`;
    const storage = storageUploader();
    const upload = await storage.upload(path, bytes, {
      contentType: mime,
      cacheControl: "0",
      upsert: false,
      metadata: { uploaded_by: profile.id },
    });
    if (upload.error)
      return json({ error: "Storage không lưu được file. Hãy thử lại." }, 502);
    const registration = await db.rpc("register_session_attachment", {
      p_session: id,
      p_path: path,
      p_mime: mime,
      p_size: bytes.length,
    });
    if (registration.error) {
      const cleanup = await storage.remove([path]);
      if (cleanup.error) console.error("Attachment orphan cleanup failed");
      return json(
        { error: "Không ghi được metadata; session có thể vừa được hoàn tất." },
        409,
      );
    }
    const attachment = await db
      .from("session_attachments")
      .select("*")
      .eq("id", registration.data)
      .single();
    if (attachment.error)
      return json(
        { error: "Không tải được metadata. Refresh để kiểm tra." },
        502,
      );
    return json({ attachment: attachment.data }, 201);
  } catch (e) {
    return json(
      {
        error:
          e instanceof Error && e.message.startsWith("Storage upload")
            ? e.message
            : "File không hợp lệ hoặc vượt giới hạn: JPEG/PNG/WEBP ≤10 MB, MP4 ≤40 MB.",
      },
      400,
    );
  }
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const profile = await currentProfile();
  if (!profile) return json({ error: "Cần đăng nhập" }, 401);
  if (!["teacher", "admin"].includes(profile.role))
    return json({ error: "Không có quyền" }, 403);
  const { id } = await params;
  const attachmentId = request.nextUrl.searchParams.get("id");
  if (!uuid.test(id) || !attachmentId || !uuid.test(attachmentId))
    return json({ error: "Không tìm thấy" }, 404);
  const db = await supabaseServer();
  const record = await db
    .from("session_attachments")
    .select("storage_path,mime_type")
    .eq("id", attachmentId)
    .eq("session_id", id)
    .maybeSingle();
  if (record.error || !record.data)
    return json({ error: "Không tìm thấy hoặc không có quyền" }, 404);
  const contentUrl = `/api/sessions/${id}/attachments?id=${attachmentId}&content=1`;
  if (request.nextUrl.searchParams.get("content") !== "1")
    return json({ url: contentUrl });
  // Upstream signed responses may omit cache headers; keep the capability server-side.
  const signed = await db.storage
    .from("session-attachments")
    .createSignedUrl(record.data.storage_path, 60);
  if (signed.error) return json({ error: "Không tạo được link xem" }, 502);
  try {
    const file = await fetch(signed.data.signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!file.ok || !file.body)
      return json({ error: "Không tải được file" }, 502);
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": record.data.mime_type,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store, max-age=0",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return json({ error: "Storage không phản hồi. Hãy thử lại." }, 502);
  }
}
