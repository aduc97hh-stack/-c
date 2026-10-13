"use client";
import { useState } from "react";
import type { Attachment } from "./model";
export function Attachments({
  sessionId,
  initial,
  locked,
  onBusyChange,
}: {
  sessionId: string;
  initial: Attachment[];
  locked: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [files, setFiles] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function upload(file: File) {
    setBusy(true);
    onBusyChange?.(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch(`/api/sessions/${sessionId}/attachments`, {
        method: "POST",
        body,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Upload thất bại");
      setFiles([...files, result.attachment]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi mạng. Hãy thử lại.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function view(id: string) {
    setError("");
    // Open inside the user gesture; Safari blocks popups opened after await.
    const popup = window.open("about:blank", "_blank");
    if (!popup) {
      setError("Cho phép mở tab để xem attachment.");
      return;
    }
    popup.opener = null;
    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/attachments?id=${id}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error("Không có quyền xem hoặc không tạo được link");
      popup.location.replace(result.url);
    } catch (e) {
      popup.close();
      setError(e instanceof Error ? e.message : "Không mở được attachment");
    }
  }
  return (
    <section className="card">
      <h2>Ảnh/video private</h2>
      <p>
        Chỉ giáo viên đúng lớp và admin được xem. JPEG/PNG/WEBP ≤10 MB; MP4 ≤40
        MB.
      </p>
      {!locked && (
        <label>
          Thêm ảnh/video
          <input
            type="file"
            disabled={busy}
            accept="image/jpeg,image/png,image/webp,video/mp4"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {busy && <p role="status">Đang upload…</p>}
      {error && <p role="alert">{error}</p>}
      <ul>
        {files.map((file, i) => (
          <li key={file.id}>
            <button onClick={() => void view(file.id)}>
              Xem attachment {i + 1}
            </button>{" "}
            · {file.mime_type}
          </li>
        ))}
      </ul>
      {files.length === 0 && <p>Chưa có attachment.</p>}
    </section>
  );
}
