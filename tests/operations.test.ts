import { test } from "node:test";
import assert from "node:assert/strict";
import {
  recurrencePreview,
  correctionDecision,
  escalationLevel,
  noticeKey,
  durationSeconds,
} from "../src/features/operations/model";
test("Weekly recurrence preview uses UTC+7 local dates including Sunday across UTC midnight", () => {
  assert.deepEqual(
    recurrencePreview("2026-10-13", "2026-10-20", [0, 2], "17:30", "19:00"),
    ["2026-10-13", "2026-10-18", "2026-10-20"],
  );
  assert.deepEqual(
    recurrencePreview("2026-10-13", "2027-10-13", [2], "17:30", "19:00"),
    [],
  );
});
test("Correction review states are terminal and explicit", () => {
  assert.equal(correctionDecision("pending", true), "approved");
  assert.equal(correctionDecision("pending", false), "rejected");
  assert.equal(correctionDecision("approved", false), "approved");
});
test("Escalation thresholds include exact boundary", () => {
  assert.equal(escalationLevel(1.999, 2, 12), "none");
  assert.equal(escalationLevel(2, 2, 12), "owner");
  assert.equal(escalationLevel(12, 2, 12), "admin");
  assert.equal(escalationLevel(48, 24, 48), "admin");
});
test("Notification entity/level keys dedupe a retry without collapsing escalation levels", () => {
  assert.equal(
    noticeKey("task", "a", "owner"),
    noticeKey("task", "a", "owner"),
  );
  assert.notEqual(
    noticeKey("task", "a", "owner"),
    noticeKey("task", "a", "admin"),
  );
});
test("Pilot duration uses full elapsed across local midnight and includes idle", () => {
  assert.equal(
    durationSeconds("2026-10-13T16:59:30Z", "2026-10-13T17:01:00Z"),
    90,
  );
  assert.equal(
    durationSeconds("2026-10-13T16:00:00Z", "2026-10-14T16:00:00Z"),
    86400,
  );
});

import {
  checkoutException,
  type CheckoutRecord,
} from "../src/features/teaching/model";
test("Confirmation counts old-lesson exceptions consistently with server pilot telemetry", () => {
  const r = {
    attendance: "present",
    homework_status: "done",
    old_lesson_status: "passed",
    quick_score: null,
    needs_attention: false,
  } as CheckoutRecord;
  assert.equal(checkoutException(r, 5), false);
  assert.equal(
    checkoutException({ ...r, old_lesson_status: "needs_review" }, 5),
    true,
  );
  assert.equal(checkoutException({ ...r, quick_score: 5 }, 5), false);
  assert.equal(checkoutException({ ...r, quick_score: 4.5 }, 5), true);
});
