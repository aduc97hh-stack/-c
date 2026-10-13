"use client";
import { useEffect, useState } from "react";
import { saveCheckout } from "./actions";
import type { CheckoutData, CheckoutRecord, Session } from "./model";
import Link from "next/link";
export function Checkout({
  session,
  initial,
  names,
  uploading = false,
  lowScore,
  onComplete,
}: {
  session: Session;
  initial: CheckoutData;
  names: Record<string, string>;
  uploading?: boolean;
  lowScore: number;
  onComplete?: () => void;
}) {
  const [data, setData] = useState(initial),
    [version, setVersion] = useState(session.version),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [done, setDone] = useState(session.status === "completed"),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [message, setMessage] = useState("Draft đã tải từ server");
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const dirty = JSON.stringify(data) !== saved;
  async function persist(complete = false) {
    if (busy || (complete && uploading)) return;
    setBusy(true);
    setError("");
    try {
      const r = await saveCheckout(session.id, version, data, complete);
      if (!r.ok) {
        setError(r.error ?? "Không lưu được");
        setPaused(true);
      } else {
        setSaved(JSON.stringify(data));
        setVersion(r.version!);
        setDone(!!r.completed);
        if (r.completed) onComplete?.();
        setMessage(
          r.completed
            ? "Buổi dạy đã hoàn tất. Lịch sử được khóa."
            : "Draft đã lưu trên server",
        );
      }
    } catch {
      setError(
        "Kết nối bị gián đoạn. Nội dung vẫn còn trên màn hình. Bấm thử lại.",
      );
      setPaused(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!dirty || busy || paused || done || confirm) return;
    const timer = setTimeout(() => void persist(), 1000);
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty && !done) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, done]);
  function change(index: number, patch: Partial<CheckoutRecord>) {
    setData((d) => ({
      ...d,
      records: d.records.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
    setPaused(false);
  }
  function bulk(
    field: "attendance" | "homework_status" | "old_lesson_status",
    value: string,
  ) {
    setData((d) => ({
      ...d,
      records: d.records.map((r) => ({ ...r, [field]: value })),
    }));
    setPaused(false);
  }
  const exceptions = data.records.filter(
    (r) =>
      r.attendance !== "present" ||
      r.homework_status === "missing" ||
      (r.quick_score !== null && r.quick_score < lowScore) ||
      r.needs_attention,
  ).length;
  return (
    <>
      <p role="status">
        {busy ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu" : message}
      </p>
      {error && (
        <div role="alert" className="notice">
          {error}{" "}
          <button
            onClick={() => {
              setPaused(false);
              void persist();
            }}
            disabled={busy}
          >
            Thử lại
          </button>
        </div>
      )}
      {done ? (
        <section className="card">
          <h2>Đã hoàn thành</h2>
          <p>
            Records, timeline và công việc đã được lưu cùng transaction. Không
            sửa âm thầm lịch sử.
          </p>
          {session.status !== "completed" ? (
            <p>Đang tải dữ liệu đã chốt…</p>
          ) : (
            <ul>
              {data.records.map((r) => (
                <li key={r.student_id}>
                  <Link href={`/students/${r.student_id}`}>
                    {names[r.student_id] ?? "Học sinh trong roster"}
                  </Link>{" "}
                  · {r.attendance} · BTVN {r.homework_status} · Điểm{" "}
                  {r.quick_score ?? "Chưa kiểm"}
                  {r.teacher_note && <p>Ghi chú riêng: {r.teacher_note}</p>}
                </li>
              ))}
            </ul>
          )}
          <Link href="/teacher/today">Về Hôm nay</Link>
        </section>
      ) : (
        <>
          <div className="bulk">
            <button
              disabled={busy}
              onClick={() => bulk("attendance", "present")}
            >
              Tất cả có mặt
            </button>
            <button
              disabled={busy}
              onClick={() => bulk("homework_status", "done")}
            >
              Tất cả đã làm BTVN
            </button>
            <button
              disabled={busy}
              onClick={() => bulk("old_lesson_status", "passed")}
            >
              Tất cả đạt bài cũ
            </button>
          </div>
          <p>
            Mặc định: có mặt, đủ BTVN, đạt bài cũ. Chỉ sửa ngoại lệ.{" "}
            {data.records.length} học sinh.
          </p>
          {data.records.map((r, index) => (
            <article
              className="card student-checkout"
              key={r.student_id}
              data-student={r.student_id}
            >
              <details>
                <summary>
                  <h2>{names[r.student_id] ?? "Học sinh trong roster"}</h2> ·{" "}
                  {r.attendance === "present"
                    ? "Có mặt"
                    : r.attendance === "absent_excused"
                      ? "Vắng CP"
                      : "Vắng KP"}{" "}
                  ·{" "}
                  {r.homework_status === "done"
                    ? "Đủ BTVN"
                    : r.homework_status === "missing"
                      ? "Thiếu BTVN"
                      : r.homework_status === "partial"
                        ? "Một phần BTVN"
                        : "Không giao BTVN"}
                </summary>
                <fieldset>
                  <legend>Đi học</legend>
                  {(
                    [
                      ["present", "Có mặt"],
                      ["absent_excused", "Vắng CP"],
                      ["absent_unexcused", "Vắng KP"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      aria-pressed={r.attendance === value}
                      key={value}
                      onClick={() => change(index, { attendance: value })}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>BTVN</legend>
                  {(
                    [
                      ["done", "Đủ"],
                      ["partial", "Một phần"],
                      ["missing", "Thiếu"],
                      ["not_applicable", "Không giao"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      aria-pressed={r.homework_status === value}
                      key={value}
                      onClick={() => change(index, { homework_status: value })}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Bài cũ</legend>
                  {(
                    [
                      ["passed", "Đạt"],
                      ["needs_review", "Chưa đạt"],
                      ["not_checked", "Chưa kiểm"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      type="button"
                      aria-pressed={r.old_lesson_status === value}
                      key={value}
                      onClick={() =>
                        change(index, { old_lesson_status: value })
                      }
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
                <label>
                  Điểm nhanh /10
                  <input
                    aria-label={`Điểm ${names[r.student_id]}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={10}
                    step={0.5}
                    value={r.quick_score ?? ""}
                    onChange={(e) =>
                      change(index, {
                        quick_score:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <details>
                  <summary>Ghi chú / cần lưu ý</summary>
                  <label>
                    <input
                      type="checkbox"
                      checked={r.needs_attention}
                      onChange={(e) =>
                        change(index, {
                          needs_attention: e.target.checked,
                          attention_reasons: e.target.checked ? ["other"] : [],
                        })
                      }
                    />{" "}
                    Cần lưu ý
                  </label>
                  {r.needs_attention && (
                    <fieldset>
                      <legend>Lý do</legend>
                      {[
                        ["homework", "BTVN"],
                        ["old_lesson", "Bài cũ"],
                        ["low_score", "Điểm thấp"],
                        ["focus", "Mất tập trung"],
                        ["other", "Khác"],
                      ].map(([value, label]) => (
                        <label key={value}>
                          <input
                            type="checkbox"
                            checked={r.attention_reasons.includes(value)}
                            onChange={(e) =>
                              change(index, {
                                attention_reasons: e.target.checked
                                  ? [...r.attention_reasons, value]
                                  : r.attention_reasons.filter(
                                      (x) => x !== value,
                                    ),
                              })
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <label>
                    Ghi chú riêng giáo viên
                    <textarea
                      maxLength={2000}
                      value={r.teacher_note}
                      onChange={(e) =>
                        change(index, { teacher_note: e.target.value })
                      }
                    />
                  </label>
                </details>
              </details>
            </article>
          ))}
          <section className="card">
            <label>
              Nội dung đã dạy
              <textarea
                value={data.lesson_content}
                maxLength={5000}
                onChange={(e) => {
                  setData({ ...data, lesson_content: e.target.value });
                  setPaused(false);
                }}
              />
            </label>
            <label>
              BTVN mới
              <textarea
                value={data.homework_assigned}
                maxLength={2000}
                onChange={(e) => {
                  setData({ ...data, homework_assigned: e.target.value });
                  setPaused(false);
                }}
              />
            </label>
          </section>
          <footer className="checkout-footer">
            {confirm ? (
              <>
                <p>
                  Xác nhận {data.records.length} học sinh, {exceptions} ngoại
                  lệ. Sau hoàn tất không sửa lịch sử.
                </p>
                <button
                  disabled={busy || uploading}
                  onClick={() => void persist(true)}
                >
                  Xác nhận hoàn thành
                </button>
                <button
                  disabled={busy || uploading}
                  onClick={() => setConfirm(false)}
                >
                  Quay lại
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={busy || uploading}
                  onClick={() => void persist()}
                >
                  Lưu draft
                </button>
                <button
                  disabled={busy || uploading}
                  onClick={() => setConfirm(true)}
                >
                  Hoàn thành buổi dạy
                </button>
              </>
            )}
          </footer>
        </>
      )}
    </>
  );
}
