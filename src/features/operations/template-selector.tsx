"use client";
import { useState } from "react";
export function TemplateSelector({
  options,
}: {
  options: { id: string; label: string; version: number }[];
}) {
  const [id, setId] = useState("");
  return (
    <>
      <label>
        Thay lịch hiện tại (để trống khi tạo mới)
        <select
          name="replace"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          <option value="">Tạo mới</option>
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <input
        type="hidden"
        name="version"
        value={options.find((t) => t.id === id)?.version ?? 0}
      />
    </>
  );
}
