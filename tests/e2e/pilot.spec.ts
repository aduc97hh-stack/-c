import { test, expect, chromium, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { schoolDate } from "../../src/features/teaching/model";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  password = process.env.GAMI_SEED_PASSWORD!;
const root = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function actor(email: string) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect(
    (await db.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  return db;
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/(admin|teacher|cskh|media)$/);
}
async function logout(page: Page, role: string) {
  await page.goto("/" + role);
  await page.getByRole("button", { name: "Đăng xuất" }).click();
}
test("Production pilot: recurring schedule, correction reconciliation, audit, inbox, escalation, PWA and server metrics", async ({
  page,
}) => {
  test.setTimeout(120000);
  const admin = await actor("admin1@gami.example"),
    teacher = await actor("teacher2@gami.example");
  const teacherId = (await teacher.auth.getUser()).data.user!.id,
    classId = crypto.randomUUID();
  const cskh = await actor("cskh4@gami.example");
  const cskhId = (await cskh.auth.getUser()).data.user!.id;
  expect(
    (
      await admin
        .from("classes")
        .insert({ id: classId, name: "Pilot test " + classId.slice(0, 8) })
    ).error,
  ).toBeNull();
  expect(
    (
      await admin
        .from("teacher_class_assignments")
        .insert({ class_id: classId, teacher_id: teacherId })
    ).error,
  ).toBeNull();
  const pupils = Array.from({ length: 15 }, (_, i) => ({
    id: crypto.randomUUID(),
    class_id: classId,
    student_code: `PILOT-${classId.slice(0, 8)}-${i}`,
    full_name: `Pilot pupil ${i + 1}`,
  }));
  expect((await admin.from("students").insert(pupils)).error).toBeNull();
  expect(
    (
      await admin
        .from("cskh_student_assignments")
        .insert(pupils.map((p) => ({ student_id: p.id, cskh_id: cskhId })))
    ).error,
  ).toBeNull();
  await login(page, "admin1@gami.example");
  await page.goto("/admin/operations");
  const pilot = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Lưu pilot config" }) });
  await pilot.getByLabel("PILOT_MODE").check();
  await pilot.getByLabel("Lớp pilot").selectOption(classId);
  await pilot.getByLabel("Giáo viên pilot").selectOption(teacherId);
  await pilot.getByRole("button", { name: "Lưu pilot config" }).click();
  await expect(pilot.getByRole("status")).toContainText("Đã lưu");
  const from = schoolDate(new Date(Date.now() + 86400000)),
    until = schoolDate(new Date(Date.now() + 8 * 86400000));
  const weekday = new Date(from + "T00:00:00Z").getUTCDay();
  await page.goto("/admin/schedules");
  const schedule = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Lưu lịch lặp" }) });
  await schedule
    .getByRole("combobox", { name: "Lớp", exact: true })
    .selectOption(classId);
  await schedule
    .getByRole("combobox", { name: "Giáo viên", exact: true })
    .selectOption(teacherId);
  const busy =
    (
      await admin
        .from("class_sessions")
        .select("starts_at,ends_at")
        .eq("teacher_id", teacherId)
        .neq("status", "cancelled")
    ).data ?? [];
  let minutes = 9 * 60;
  const dates = [
    from,
    schoolDate(new Date(+new Date(from + "T00:00:00+07:00") + 7 * 86400000)),
  ];
  const instant = (date: string, m: number) =>
    +new Date(date + "T00:00:00+07:00") + m * 60000;
  while (
    dates.some((d) =>
      busy.some(
        (s) =>
          +new Date(s.starts_at) < instant(d, minutes + 30) &&
          +new Date(s.ends_at) > instant(d, minutes),
      ),
    )
  )
    minutes += 30;
  const local = (m: number) =>
    String(Math.floor(m / 60)).padStart(2, "0") +
    ":" +
    String(m % 60).padStart(2, "0");
  await schedule.getByLabel("Bắt đầu", { exact: true }).fill(local(minutes));
  await schedule
    .getByLabel("Kết thúc", { exact: true })
    .fill(local(minutes + 30));
  await schedule.getByLabel("Từ ngày").fill(from);
  await schedule.getByLabel("Đến ngày").fill(until);
  await schedule.locator(`input[name="weekday"][value="${weekday}"]`).check();
  await page.context().setOffline(true);
  await schedule.getByRole("button", { name: "Lưu lịch lặp" }).click();
  await expect(schedule.getByRole("alert")).toContainText("Mất kết nối");
  await expect(schedule.getByLabel("Từ ngày")).toHaveValue(from);
  await expect(
    schedule.getByRole("combobox", { name: "Lớp", exact: true }),
  ).toHaveValue(classId);
  await page.context().setOffline(false);
  await schedule.getByRole("button", { name: "Lưu lịch lặp" }).click();
  await expect(schedule.getByRole("status")).toContainText("Đã lưu template");
  const template = (
    await admin
      .from("class_schedule_templates")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()
  ).data!;
  await page.reload();
  const generate = page.locator("form").filter({
    has: page.locator(`input[name="template"][value="${template.id}"]`),
  });
  await generate.getByLabel("Tạo từ").fill(from);
  await generate.getByLabel("Tạo đến").fill(until);
  await generate.getByRole("button", { name: "Tạo sessions" }).click();
  await expect(generate.getByRole("status")).toContainText("Đã tạo 2 sessions");
  await generate.getByRole("button", { name: "Tạo sessions" }).click();
  await expect(generate.getByRole("status")).toContainText("Đã tạo 0 sessions");
  const retries = await Promise.all(
    [1, 2].map(() => admin.rpc("generate_schedule", {
      p_template: template.id, p_from: from, p_until: until,
    })),
  );
  for (const retry of retries) {
    expect(retry.error).toBeNull();
    expect(retry.data.generated).toBe(0);
  }
  const sessions = (
    await admin
      .from("class_sessions")
      .select("*")
      .eq("template_id", template.id)
      .order("starts_at")
  ).data!;
  expect(sessions).toHaveLength(2);
  const session = sessions[0];
  await logout(page, "admin");
  await login(page, "teacher2@gami.example");
  await page.goto("/teacher/sessions/" + session.id);
  await page.getByRole("button", { name: "Bắt đầu lớp", exact: true }).click();
  await expect(page.locator(".student-checkout")).toHaveCount(15);
  const first = page.locator(".student-checkout").first();
  await first.locator("summary").first().click();
  await expect
    .poll(
      async () =>
        (
          await root
            .from("pilot_events")
            .select("id")
            .eq("session_id", session.id)
            .eq("event_type", "checkout_opened")
        ).data?.length,
    )
    .toBe(1);
  await page.context().setOffline(true);
  await first.getByRole("button", { name: "Thiếu", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Kết nối bị gián đoạn" }),
  ).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft đã lưu");

  await page.getByRole("button", { name: "Lưu draft", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft đã lưu");
  await expect
    .poll(
      async () =>
        (
          await root
            .from("pilot_events")
            .select("id")
            .eq("session_id", session.id)
            .eq("event_type", "checkout_opened")
        ).data?.length,
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Hoàn thành buổi dạy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Xác nhận hoàn thành", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Đã hoàn thành", exact: true }),
  ).toBeVisible();
  const records = (
      await teacher
        .from("session_student_records")
        .select("*")
        .eq("session_id", session.id)
        .order("student_id")
    ).data!,
    record = records[0];
  const correction = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: "Gửi yêu cầu" }) });
  await correction.getByLabel("Giá trị đề nghị").selectOption("done");
  await correction
    .getByLabel("Lý do", { exact: true })
    .fill("Nhập nhầm BTVN, đã kiểm tra lại");
  await correction.getByRole("button", { name: "Gửi yêu cầu" }).click();
  await expect(correction.getByRole("status")).toContainText("Đã lưu");
  const request = (
    await teacher
      .from("session_corrections")
      .select("*")
      .eq("session_id", session.id)
      .single()
  ).data!;
  expect(
    (
      await teacher.rpc("review_correction", {
        p_id: request.id,
        p_approve: true,
        p_note: "spoof",
      })
    ).error,
  ).toBeTruthy();
  await logout(page, "teacher");
  await login(page, "admin1@gami.example");
  await page.goto("/admin/corrections");
  const card = page.locator(`[data-correction="${request.id}"]`);
  await card.getByRole("button", { name: "Xét duyệt" }).click();
  await expect(card).toHaveCount(0);
  await page.getByLabel("Trạng thái yêu cầu").selectOption("approved");
  await page.getByRole("button", { name: "Lọc yêu cầu" }).click();
  await expect(
    card.getByRole("heading", { name: "BTVN · approved" }),
  ).toBeVisible();
  const reviews = await Promise.all(
    [1, 2].map(() => admin.rpc("review_correction", {
      p_id: request.id, p_approve: true, p_note: "Concurrent approval retry",
    })),
  );
  for (const review of reviews) expect(review.error).toBeNull();
  expect(
    (
      await root
        .from("session_student_records")
        .select("homework_status")
        .eq("id", record.id)
        .single()
    ).data?.homework_status,
  ).toBe("missing");
  expect(
    (
      await admin
        .from("effective_session_records")
        .select("homework_status")
        .eq("id", record.id)
        .single()
    ).data?.homework_status,
  ).toBe("done");
  expect(
    (
      await root
        .from("tasks")
        .select("status")
        .eq("source_record_id", record.id)
        .eq("type", "homework_followup")
        .single()
    ).data?.status,
  ).toBe("cancelled");
  await page.goto("/students/" + record.student_id);
  await expect(page.getByText("BTVN đủ: 1 · Thiếu: 0")).toBeVisible();
  await page.goto("/admin/audit");
  await page.getByLabel("Entity").selectOption("session_corrections");
  await page.getByRole("button", { name: "Lọc audit" }).click();
  await expect(
    page
      .locator("li")
      .filter({ hasText: request.id })
      .filter({ hasText: "session_corrections:update" }),
  ).toHaveCount(1);
  const metrics = await admin.rpc("pilot_metrics", {});
  expect(metrics.data.sessions).toBeGreaterThanOrEqual(1);
  expect(metrics.data.save_errors).toBeGreaterThanOrEqual(1);
  expect(metrics.data.median_seconds).toBeGreaterThanOrEqual(0);
  expect(
    (
      await root.from("pilot_events").select("*").eq("session_id", session.id)
    ).data?.filter((e) => e.event_type === "checkout_completed"),
  ).toHaveLength(1);
  await page.goto("/admin/operations");
  await expect(page.getByText(/Median checkout:/)).toBeVisible();
  // Overdue fixture only in dedicated local test project, preserving normal records.
  const occupied =
    (
      await admin
        .from("class_sessions")
        .select("starts_at,ends_at")
        .eq("teacher_id", teacherId)
        .neq("status", "cancelled")
    ).data ?? [];
  let overdueStart = Date.now() - 28 * 3600000;
  while (
    occupied.some(
      (s) =>
        +new Date(s.starts_at) < overdueStart + 120000 &&
        +new Date(s.ends_at) > overdueStart,
    )
  )
    overdueStart += 180000;
  const overdue = await admin.rpc("create_class_session", {
    p_class: classId,
    p_teacher: teacherId,
    p_start: new Date(overdueStart).toISOString(),
    p_end: new Date(overdueStart + 120000).toISOString(),
    p_title: "Pilot overdue fixture",
  });
  expect(overdue.error).toBeNull();
  await page.getByRole("button", { name: "Chạy vận hành ngay" }).click();
  await expect(page.getByRole("status")).toContainText("Đã chạy");
  const count = (
    await root.from("notifications").select("id").eq("entity_id", overdue.data)
  ).data!.length;
  expect(count).toBeGreaterThanOrEqual(2);
  await page.getByRole("button", { name: "Chạy vận hành ngay" }).click();
  await expect(page.getByRole("status")).toContainText("Đã chạy");
  expect(
    (
      await root
        .from("notifications")
        .select("id")
        .eq("entity_id", overdue.data)
    ).data,
  ).toHaveLength(count);
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(manifest.status()).toBe(200);
  const body = await manifest.json();
  expect(body.name).toBe("GAMI OS");
  expect(body.display).toBe("standalone");
  for (const icon of body.icons) {
    const r = await page.request.get(icon.src);
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  await expect
    .poll(async () =>
      page.evaluate(
        async () => !!(await navigator.serviceWorker.getRegistration("/")),
      ),
    )
    .toBe(true);
  expect(await page.evaluate(async () => await caches.keys())).toEqual([]);
  expect((await page.request.get("/api/health")).status()).toBe(200);
  await logout(page, "admin");
  await login(page, "teacher2@gami.example");
  await page.goto("/notifications");
  const reviewedNotice = (
    await teacher
      .from("notifications")
      .select("id")
      .eq("entity_id", request.id)
      .eq("type", "correction_result")
      .single()
  );
  expect(reviewedNotice.error).toBeNull();
  await expect(
    page.locator(`[data-notification="${reviewedNotice.data!.id}"]`)
      .getByRole("heading", { name: "Yêu cầu chỉnh sửa đã được xử lý" }),
  ).toBeVisible();
  const own = (
    await teacher
      .from("notifications")
      .select("*")
      .eq("entity_id", overdue.data)
      .eq("type", "checkout_due")
      .single()
  ).data!;
  await expect(
    page.locator(`[data-notification="${own.id}"]`)
      .getByRole("heading", { name: "Buổi học chưa hoàn tất" }),
  ).toBeVisible();
  const other = await actor("cskh5@gami.example");
  expect(
    (await other.from("notifications").select("id").eq("id", own.id)).data,
  ).toEqual([]);
  expect(
    (await other.rpc("mark_notification", { p_id: own.id })).error,
  ).toBeTruthy();
  expect((await other.from("session_corrections").select("*")).data).toEqual(
    [],
  );
  await admin.rpc("configure_pilot", {
    p_mode: false,
    p_teacher: teacherId,
    p_class: classId,
    p_enable: false,
  });
});

test("Chromium reports no PWA installability errors in a normal browser profile", async () => {
  // Playwright's default contexts are incognito, where installation is disabled.
  // An empty userDataDir creates an isolated temporary normal profile.
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:3000/login");
    await expect.poll(() => page.evaluate(async () =>
      !!(await navigator.serviceWorker.getRegistration("/"))
    )).toBe(true);
    const browserTools = await context.newCDPSession(page);
    const installability = await browserTools.send("Page.getInstallabilityErrors");
    expect(installability.installabilityErrors).toEqual([]);
    await browserTools.detach();
  } finally {
    await context.close();
  }
});
