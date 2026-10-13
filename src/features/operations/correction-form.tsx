"use client";
import { useState } from "react";
import { OperationForm } from "./form";
import { correctionFields, correctionValueLabel } from "./model";
import type { CheckoutRecord } from "@/features/teaching/model";
export function CorrectionForm({
  sessionId,
  records,
  names,
  content,
  homework,
}: {
  sessionId: string;
  records: CheckoutRecord[];
  names: Record<string, string>;
  content: string;
  homework: string;
}) {
  const [field, setField] = useState("homework_status"),
    [record, setRecord] = useState(records[0]?.student_id ?? "");
  const sessionField = ["lesson_content", "homework_assigned"].includes(field);
  const item = records.find((r) => r.student_id === record);
  const old =
    field === "lesson_content"
      ? content
      : field === "homework_assigned"
        ? homework
        : String(item?.[field as keyof CheckoutRecord] ?? "");
  const options: Record<string, string[]> = {
    homework_status: ["done", "partial", "missing", "not_applicable"],
    attendance: ["present", "absent_excused", "absent_unexcused"],
    old_lesson_status: ["passed", "needs_review", "not_checked"],
    needs_attention: ["true", "false"],
  };
  return (
    <section className="card">
      <h2>Yêu cầu chỉnh sửa</h2>
      <p>Bản gốc vẫn được giữ. Admin phê duyệt mới có hiệu lực.</p>
      <OperationForm command="correction">
        <input type="hidden" name="session" value={sessionId} />
        <input
          type="hidden"
          name="record"
          value={
            sessionField
              ? ""
              : ((item as CheckoutRecord & { id: string })?.id ?? "")
          }
        />
        <label>
          Phần cần sửa
          <select
            name="field"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            {Object.entries(correctionFields).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        {!sessionField && (
          <label>
            Học sinh
            <select value={record} onChange={(e) => setRecord(e.target.value)}>
              {records.map((r) => (
                <option key={r.student_id} value={r.student_id}>
                  {names[r.student_id]}
                </option>
              ))}
            </select>
          </label>
        )}
        <p>Giá trị hiện tại: {correctionValueLabel(field, old) || "(trống)"}</p>
        <label>
          Giá trị đề nghị
          {options[field] ? (
            <select name="value" key={field + record}>
              {options[field].map((v) => (
                <option key={v} value={v}>
                  {correctionValueLabel(field, v)}
                </option>
              ))}
            </select>
          ) : (
            <textarea
              key={field + record}
              name="value"
              maxLength={field === "lesson_content" ? 5000 : 2000}
            />
          )}
        </label>
        <label>
          Lý do
          <textarea name="reason" required minLength={5} maxLength={1000} />
        </label>
        <button>Gửi yêu cầu</button>
      </OperationForm>
    </section>
  );
}
