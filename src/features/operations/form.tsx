"use client";
import { useState, useRef, type FormEvent } from "react";
import { operate } from "./actions";
import { recurrencePreview, type ActionState } from "./model";
export function OperationForm({
  children,
  command,
}: {
  children: React.ReactNode;
  command: string;
}) {
  const [state, setState] = useState<ActionState>({ ok: true, message: "" }),
    [pending, setPending] = useState(false),
    [preview, setPreview] = useState<string[]>([]);
  const busy = useRef(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    const form = new FormData(e.currentTarget);
    setPending(true);
    try {
      setState(await operate(state, form));
    } catch {
      setState({
        ok: false,
        message: "Mất kết nối. Form vẫn còn; thử lại khi online.",
      });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <form
      method="post"
      onSubmit={submit}
      onChange={(e) => {
        if (command !== "schedule") return;
        const f = new FormData(e.currentTarget);
        setPreview(
          recurrencePreview(
            String(f.get("from")),
            String(f.get("until")),
            f.getAll("weekday").map(Number),
            String(f.get("start")),
            String(f.get("end")),
          ),
        );
      }}
    >
      <input type="hidden" name="command" value={command} />
      <fieldset disabled={pending}>{children}</fieldset>
      {command === "schedule" && (
        <p>
          Preview: {preview.length} buổi trong cửa sổ ≤56 ngày.{" "}
          {preview.slice(0, 3).join(", ")}
        </p>
      )}
      {(pending || state.message) && (
        <p role={pending || state.ok ? "status" : "alert"}>
          {pending ? "Đang lưu…" : state.message}
        </p>
      )}
    </form>
  );
}
