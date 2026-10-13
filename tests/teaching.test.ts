import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canTransition,
  inspectAttachment,
  schoolDate,
  todayBounds,
  taskGroup,
  uploadLimits,
  type Task,
} from "../src/features/teaching/model";
test("School day remains correct across UTC midnight", () => {
  assert.equal(schoolDate(new Date("2026-10-13T18:00:00Z")), "2026-10-14");
  assert.deepEqual(todayBounds(new Date("2026-10-13T18:00:00Z")), [
    "2026-10-13T17:00:00.000Z",
    "2026-10-14T17:00:00.000Z",
  ]);
});
test("Terminal task states are immutable, cancellation admin-only", () => {
  for (const from of ["done", "cancelled"] as const)
    assert.equal(canTransition(from, "open", true), false);
  assert.equal(canTransition("open", "done"), true);
  assert.equal(canTransition("in_progress", "waiting_parent"), true);
  assert.equal(canTransition("open", "cancelled"), false);
  assert.equal(canTransition("open", "cancelled", true), true);
});
test("Mission grouping treats overdue and wait states explicitly", () => {
  const base = { status: "open", due_at: "2026-10-13T03:00:00Z" } as Task;
  const now = new Date("2026-10-13T04:00:00Z");
  assert.equal(taskGroup(base, now), "Quá hạn");
  assert.equal(
    taskGroup({ ...base, status: "waiting_parent" }, now),
    "Chờ phụ huynh",
  );
  assert.equal(
    taskGroup({ ...base, due_at: "2026-10-13T10:00:00Z" }, now),
    "Hôm nay",
  );
  assert.equal(taskGroup({ ...base, status: "done" }, now), "Đã hoàn thành");
});
test("Upload ignores client MIME and requires supported magic bytes", () => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(inspectAttachment(png).mime, "image/png");
  assert.throws(() =>
    inspectAttachment(Buffer.from("<script>alert(1)</script>")),
  );
  assert.throws(() => inspectAttachment(png.slice(0, 8)));
  const oversized = Buffer.alloc(uploadLimits.image + 1);
  png.copy(oversized);
  assert.throws(() => inspectAttachment(oversized));
  const mp4 = Buffer.alloc(24);
  mp4.writeUInt32BE(24);
  mp4.write("ftyp", 4);
  mp4.write("isom", 8);
  assert.equal(inspectAttachment(mp4).mime, "video/mp4");
});

test("Local midnight switches today and future deadline groups at exactly UTC17", () => {
  const before = new Date("2026-10-13T16:59:59.999Z");
  const after = new Date("2026-10-13T17:00:00.000Z");
  assert.equal(schoolDate(before), "2026-10-13");
  assert.equal(schoolDate(after), "2026-10-14");
  const future = { status: "open", due_at: "2026-10-13T17:00:01.000Z" } as Task;
  assert.equal(taskGroup(future, before), "Sắp tới");
  assert.equal(taskGroup(future, after), "Hôm nay");
});
