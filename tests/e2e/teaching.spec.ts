import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { schoolDate } from "../../src/features/teaching/model";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  password = process.env.GAMI_SEED_PASSWORD!;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function actor(email: string) {
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await db.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error("Test authentication failed");
  return db;
}
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(/\/(teacher|admin|cskh|media)$/);
}
async function setup() {
  const admin = await actor("admin1@gami.example");
  const teacher = await actor("teacher2@gami.example");
  const id = (await teacher.auth.getUser()).data.user!.id;
  const title = "Speed checkout " + Date.now();
  const day = schoolDate();
  const base = new Date(day + "T00:00:00+07:00").getTime();
  const busy =
    (
      await admin
        .from("class_sessions")
        .select("starts_at,ends_at")
        .eq("teacher_id", id)
        .neq("status", "cancelled")
        .lt("starts_at", new Date(base + 86400000).toISOString())
        .gt("ends_at", new Date(base).toISOString())
    ).data ?? [];
  let slot = base + 7 * 3600000;
  while (
    busy.some(
      (s) =>
        +new Date(s.starts_at) < slot + 120000 && +new Date(s.ends_at) > slot,
    )
  )
    slot += 180000;
  const uniqueStart = new Date(slot);
  const result = await admin.rpc("create_class_session", {
    p_class: "21000000-0000-0000-0000-000000000001",
    p_teacher: id,
    p_start: uniqueStart.toISOString(),
    p_end: new Date(uniqueStart.getTime() + 120000).toISOString(),
    p_title: title,
  });
  if (result.error)
    throw new Error("Session creation failed " + result.error.code);
  return { id: result.data as string, teacher, admin, title };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
  "base64",
);
test("15-student speed flow, draft recovery, actual private uploads, atomic checkout, Mission Board and Student 360", async ({
  page,
}) => {
  test.setTimeout(120000);
  const { id, teacher, title } = await setup();
  await login(page, "teacher2@gami.example");
  await page.getByRole("link", { name: "Hôm nay", exact: true }).click();
  const card = page.locator("article").filter({ hasText: title });
  await card.getByRole("link").click();
  await page.getByRole("button", { name: "Bắt đầu lớp", exact: true }).click();
  await expect(page.locator(".student-checkout")).toHaveCount(15);
  const begin = Date.now();
  let taps = 0;
  for (const name of [
    "Tất cả có mặt",
    "Tất cả đã làm BTVN",
    "Tất cả đạt bài cũ",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    taps++;
  }
  const first = page.locator(".student-checkout").first();
  await first.locator("summary").first().click();
  taps++;
  await first.getByRole("button", { name: "Vắng KP", exact: true }).click();
  taps++;
  await first.getByRole("button", { name: "Thiếu", exact: true }).click();
  taps++;
  await first.getByLabel(/Điểm /).fill("4");
  taps++;
  await page.context().setOffline(true);
  await expect(
    page.getByRole("alert").filter({ hasText: "Kết nối bị gián đoạn" }),
  ).toContainText("Kết nối bị gián đoạn");
  await expect(first.getByLabel(/Điểm /)).toHaveValue("4");
  await page.context().setOffline(false);
  await page.getByRole("button", { name: "Thử lại", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Draft đã lưu");
  await page.getByRole("button", { name: "Lưu draft", exact: true }).click();
  taps++;
  await expect(page.getByRole("status")).toContainText("Draft đã lưu");
  await page.reload();
  await first.locator("summary").first().click();
  await expect(
    first.getByRole("button", { name: "Thiếu", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(first.getByLabel(/Điểm /)).toHaveValue("4");
  const crossOrigin = await page.request.post(
    `/api/sessions/${id}/attachments`,
    {
      headers: { Origin: "https://untrusted.example" },
      multipart: {
        file: { name: "a.png", mimeType: "image/png", buffer: png },
      },
    },
  );
  expect(crossOrigin.status()).toBe(403);
  // Server rejects spoofed image bytes and oversized images before writing Storage.
  const invalid = await page.request.post(`/api/sessions/${id}/attachments`, {
    multipart: {
      file: {
        name: "../../evil.png",
        mimeType: "image/png",
        buffer: Buffer.from("<script>bad</script>"),
      },
    },
  });
  expect(invalid.status()).toBe(400);
  const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
  png.copy(oversized);
  const tooLarge = await page.request.post(`/api/sessions/${id}/attachments`, {
    multipart: {
      file: { name: "large.png", mimeType: "image/png", buffer: oversized },
    },
  });
  expect(tooLarge.status()).toBe(400);
  const uploaded = await page.request.post(`/api/sessions/${id}/attachments`, {
    multipart: {
      file: { name: "../../student.png", mimeType: "text/html", buffer: png },
    },
  });
  expect(uploaded.status()).toBe(201);
  const attachment = (await uploaded.json()).attachment;
  expect(attachment.storage_path.startsWith(id + "/")).toBe(true);
  expect(attachment.mime_type).toBe("image/png");
  const signed = await page.request.get(
    `/api/sessions/${id}/attachments?id=${attachment.id}`,
  );
  expect(signed.status()).toBe(200);
  expect(signed.headers()["cache-control"]).toContain("no-store");
  const signedUrl = (await signed.json()).url;
  const image = await page.request.get(signedUrl);
  expect(image.status()).toBe(200);
  expect(image.headers()["cache-control"]).toContain("private");
  expect(image.headers()["cache-control"]).toContain("no-store");
  expect(await image.body()).toEqual(png);
  const publicFile = await page.request.get(
    url +
      "/storage/v1/object/public/session-attachments/" +
      attachment.storage_path,
  );
  expect(publicFile.ok()).toBe(false);
  await page.getByLabel("Thêm ảnh/video").setInputFiles({
    name: "ui-photo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    page.getByRole("button", { name: "Xem attachment 1", exact: true }),
  ).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Xem attachment 1", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForURL(/api\/sessions\/.+content=1/);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.close();
  const directUpdate = await teacher.storage
    .from("session-attachments")
    .update(attachment.storage_path, Buffer.from("<script>bad</script>"), {
      contentType: "image/png",
    });
  expect(!!directUpdate.error).toBe(true);
  const directUpload = await teacher.storage
    .from("session-attachments")
    .upload(id + "/51000000-0000-0000-0000-000000000001.png", png, {
      contentType: "image/png",
    });
  expect(!!directUpload.error).toBe(true);
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=green:s=32x32:d=0.2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-y",
    "/tmp/gami-e2e-video.mp4",
  ]);
  const video = await page.request.post(`/api/sessions/${id}/attachments`, {
    multipart: {
      file: {
        name: "clip.mp4",
        mimeType: "video/mp4",
        buffer: readFileSync("/tmp/gami-e2e-video.mp4"),
      },
    },
  });
  expect(video.status()).toBe(201);
  await page
    .getByRole("button", { name: "Hoàn thành buổi dạy", exact: true })
    .click();
  taps++;
  await page
    .getByRole("button", { name: "Xác nhận hoàn thành", exact: true })
    .click();
  taps++;
  await expect(
    page.getByRole("heading", { name: "Đã hoàn thành", exact: true }),
  ).toBeVisible();
  const elapsed = Date.now() - begin;
  console.info(
    `Speed fixture: ${taps} taps/field interactions; ${elapsed} ms including draft refresh + upload/security checks.`,
  );
  expect(taps).toBeLessThanOrEqual(15);
  expect(elapsed).toBeLessThan(90000);
  const taskEvents = await service
    .from("student_events")
    .select("task_id")
    .eq("session_id", id)
    .in("event_type", ["task_created", "task_updated"]);
  const taskIds = [
    ...new Set((taskEvents.data ?? []).map((e) => e.task_id).filter(Boolean)),
  ];
  const tasks = await service
    .from("tasks")
    .select("id,type,owner_id,student_id")
    .in("id", taskIds);
  expect(tasks.error?.code ?? null).toBeNull();
  expect(tasks.data?.length).toBeGreaterThanOrEqual(1);
  const replay = await teacher.rpc("save_session_checkout", {
    p_session: id,
    p_version: 1,
    p_data: {},
    p_complete: true,
  });
  expect(replay.error?.code ?? null).toBeNull();
  expect(replay.data.replayed).toBe(true);
  const after = await service.from("tasks").select("id").in("id", taskIds);
  expect(after.data?.length).toBe(tasks.data?.length);
  await page.screenshot({
    path: "/tmp/gami-checkout-completed.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Về Hôm nay" }).click();
  await page.goto("/teacher");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await login(page, "cskh4@gami.example");
  await page.getByRole("link", { name: "Mission Board", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Việc hôm nay" }),
  ).toBeVisible();
  expect((await page.request.get(signedUrl)).status()).toBe(403);
  const homework = tasks.data?.find((t) => t.type === "homework_followup");
  expect(homework).toBeTruthy();
  if (homework) {
    await page.goto("/tasks/" + homework.id);
    await expect(
      page.getByRole("heading", { name: "Nhắc BTVN", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Học sinh checkout 1", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Student 360/ }),
    ).toBeVisible();
    await expect(
      page.locator("li").filter({ hasText: "Thiếu BTVN" }).first(),
    ).toBeVisible();
  }
  const other = await actor("cskh5@gami.example");
  if (homework) {
    const denied = await other.from("tasks").select("id").eq("id", homework.id);
    expect(denied.data?.length).toBe(0);
  }
  await page.goto("/cskh");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await login(page, "admin1@gami.example");
  await expect(
    page.getByRole("heading", { name: "Command Center", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Tasks:/)).toBeVisible();
  await page.screenshot({
    path: "/tmp/gami-command-center.png",
    fullPage: true,
  });
  const media = await actor("media6@gami.example");
  const mediaSigned = await media.storage
    .from("session-attachments")
    .createSignedUrl(attachment.storage_path, 60);
  expect(!!mediaSigned.error).toBe(true);
  const wrongTeacher = await actor("teacher3@gami.example");
  expect(
    (await wrongTeacher.from("class_sessions").select("id").eq("id", id)).data,
  ).toEqual([]);
  expect(
    (
      await wrongTeacher
        .from("session_attachments")
        .select("id")
        .eq("session_id", id)
    ).data,
  ).toEqual([]);
  expect(
    (
      await wrongTeacher.storage
        .from("session-attachments")
        .createSignedUrl(attachment.storage_path, 60)
    ).error,
  ).toBeTruthy();
  const cskh = await actor("cskh4@gami.example");
  const cskhSigned = await cskh.storage
    .from("session-attachments")
    .createSignedUrl(attachment.storage_path, 60);
  expect(!!cskhSigned.error).toBe(true);
});
test("Tampering, invalid scores, wrong student, stale drafts and concurrent completions", async () => {
  const { id, teacher } = await setup();
  await teacher.rpc("start_class_session", { p_session: id });
  const records = (
    await teacher
      .from("session_student_records")
      .select("*")
      .eq("session_id", id)
  ).data!;
  const payload = {
    records: records.map((r) => ({ ...r, teacher_note: "" })),
    lesson_content: "Test",
    homework_assigned: "",
  };
  const badScore = structuredClone(payload);
  badScore.records[0].quick_score = 11;
  expect(
    !!(
      await teacher.rpc("save_session_checkout", {
        p_session: id,
        p_version: 1,
        p_data: badScore,
        p_complete: true,
      })
    ).error,
  ).toBe(true);
  const badStudent = structuredClone(payload);
  badStudent.records[0].student_id = "30000000-0000-0000-0000-000000000006";
  expect(
    !!(
      await teacher.rpc("save_session_checkout", {
        p_session: id,
        p_version: 1,
        p_data: badStudent,
        p_complete: true,
      })
    ).error,
  ).toBe(true);
  const other = await actor("teacher3@gami.example");
  expect(
    !!(await other.rpc("start_class_session", { p_session: id })).error,
  ).toBe(true);
  expect(
    !!(
      await teacher.rpc("start_class_session", {
        p_session: "00000000-0000-0000-0000-000000000000",
      })
    ).error,
  ).toBe(true);
  const results = await Promise.all([
    teacher.rpc("save_session_checkout", {
      p_session: id,
      p_version: 1,
      p_data: payload,
      p_complete: true,
    }),
    teacher.rpc("save_session_checkout", {
      p_session: id,
      p_version: 1,
      p_data: payload,
      p_complete: true,
    }),
  ]);
  expect(results.every((r) => !r.error)).toBe(true);
  expect(results.filter((r) => r.data.replayed).length).toBe(1);
  const events = await service
    .from("student_events")
    .select("id,event_type")
    .eq("session_id", id);
  expect(
    events.data?.filter((e) => e.event_type === "session_completed").length,
  ).toBe(15);
});

test("Historical roster remains visible after transfer/inactivation; 25-pupil mobile keyboard layout", async ({
  page,
}) => {
  const { id, teacher } = await setup();
  const extras = Array.from({ length: 10 }, (_, i) => ({
    id: crypto.randomUUID(),
    student_code: `GATE-${id.slice(0, 8)}-${i}`,
    full_name: `Gate pupil ${i}`,
    class_id: "21000000-0000-0000-0000-000000000001",
  }));
  expect((await service.from("students").insert(extras)).error).toBeNull();
  try {
    expect(
      (await teacher.rpc("start_class_session", { p_session: id })).error,
    ).toBeNull();
    const roster = await teacher.rpc("session_roster", { p_session: id });
    expect(roster.data?.length).toBe(25);
    const late = {
      ...extras[1],
      id: crypto.randomUUID(),
      student_code: `LATE-${id.slice(0, 8)}`,
      full_name: "Late joiner",
    };
    expect((await service.from("students").insert(late)).error).toBeNull();
    extras.push(late);
    expect(
      (
        await service
          .from("session_student_records")
          .insert({ session_id: id, student_id: late.id })
      ).error?.code,
    ).toBe("55000");
    const moved = extras[0];
    expect(
      (
        await service
          .from("students")
          .update({
            class_id: "20000000-0000-0000-0000-000000000002",
            active: false,
          })
          .eq("id", moved.id)
      ).error,
    ).toBeNull();
    const identities = await teacher.rpc("session_roster", { p_session: id });
    expect(identities.data).toEqual(roster.data);
    await login(page, "teacher2@gami.example");
    await page.goto(`/teacher/sessions/${id}`);
    await expect(page.locator(".student-checkout")).toHaveCount(25);
    const pupil = page.locator(`[data-student="${moved.id}"]`);
    await expect(
      pupil.getByRole("heading", { name: moved.full_name }),
    ).toBeVisible();
    for (const width of [320, 390, 430]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 390, height: 420 });
    await pupil.locator("summary").first().click();
    const score = pupil.getByLabel(/Điểm /);
    await score.focus();
    await expect(page.locator(".checkout-footer")).toHaveCSS(
      "position",
      "static",
    );
    await expect(page.locator(".bulk")).toHaveCSS("position", "static");
    await score.fill("8");
    await page.getByLabel("Nội dung đã dạy").fill("Keyboard regression");
    await expect(page.getByRole("status")).toContainText("Draft đã lưu");
    await page.getByLabel("Nội dung đã dạy").blur();
    for (const button of await page.locator("button:visible").all()) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page
      .getByRole("button", { name: "Hoàn thành buổi dạy", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Xác nhận hoàn thành", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Đã hoàn thành", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: moved.full_name, exact: true }),
    ).toBeVisible();
    const before = (
      await service.from("class_sessions").select("*").eq("id", id).single()
    ).data;
    expect(
      (
        await service
          .from("class_sessions")
          .update({ lesson_content: "tamper", homework_assigned: "tamper" })
          .eq("id", id)
      ).error,
    ).toBeTruthy();
    expect(
      (
        await service
          .from("session_student_records")
          .update({ quick_score: 0 })
          .eq("session_id", id)
      ).error,
    ).toBeTruthy();
    expect(
      (
        await teacher.rpc("save_session_checkout", {
          p_session: id,
          p_version: 0,
          p_data: { records: [], lesson_content: "tamper" },
          p_complete: true,
        })
      ).data.replayed,
    ).toBe(true);
    expect(
      (await service.from("class_sessions").select("*").eq("id", id).single())
        .data,
    ).toEqual(before);
  } finally {
    // Keep identities referenced by history; remove only their current roster eligibility.
    expect(
      (
        await service
          .from("students")
          .update({ active: false })
          .in(
            "id",
            extras.map((s) => s.id),
          )
      ).error,
    ).toBeNull();
  }
});

test("Two different sessions completing concurrently keep one active task per pupil/type", async () => {
  const first = await setup(),
    second = await setup();
  for (const s of [first, second])
    expect(
      (await s.teacher.rpc("start_class_session", { p_session: s.id })).error,
    ).toBeNull();
  const payloads = await Promise.all(
    [first, second].map(async (s) => ({
      records: (
        await s.teacher
          .from("session_student_records")
          .select("*")
          .eq("session_id", s.id)
      ).data!.map((r, i) => ({
        ...r,
        homework_status: i === 0 ? "missing" : "done",
        quick_score: i === 0 ? 4 : null,
        old_lesson_status: i === 0 ? "needs_review" : "passed",
        teacher_note: "",
      })),
      lesson_content: "Concurrency",
      homework_assigned: "",
    })),
  );
  const results = await Promise.all(
    [first, second].flatMap((s, i) =>
      [0, 1].map(() =>
        s.teacher.rpc("save_session_checkout", {
          p_session: s.id,
          p_version: 1,
          p_data: payloads[i],
          p_complete: true,
        }),
      ),
    ),
  );
  expect(results.every((r) => !r.error)).toBe(true);
  expect(results.filter((r) => r.data.replayed).length).toBe(2);
  const pupil = payloads[0].records[0].student_id;
  const tasks = (
    await service
      .from("tasks")
      .select("type")
      .eq("student_id", pupil)
      .not("status", "in", "(done,cancelled)")
  ).data!;
  expect(new Set(tasks.map((t) => t.type)).size).toBe(tasks.length);
  const events = (
    await service
      .from("student_events")
      .select("idempotency_key,event_type,session_id")
      .in("session_id", [first.id, second.id])
  ).data!;
  expect(new Set(events.map((e) => e.idempotency_key)).size).toBe(
    events.length,
  );
  for (const s of [first, second])
    expect(
      events.filter(
        (e) => e.session_id === s.id && e.event_type === "session_completed",
      ),
    ).toHaveLength(15);
});

test("Attachment registration waits for concurrent completion and cannot add completed metadata", async () => {
  const { id, teacher } = await setup();
  expect(
    (await teacher.rpc("start_class_session", { p_session: id })).error,
  ).toBeNull();
  const actorId = (await teacher.auth.getUser()).data.user!.id;
  const path = `${id}/${crypto.randomUUID()}.png`;
  expect(
    (
      await service.storage.from("session-attachments").upload(path, png, {
        contentType: "image/png",
        cacheControl: "0",
        metadata: { uploaded_by: actorId },
      })
    ).error,
  ).toBeNull();
  const records = (
    await teacher
      .from("session_student_records")
      .select("*")
      .eq("session_id", id)
  ).data!;
  const payload = JSON.stringify({
    records: records.map((r) => ({ ...r, teacher_note: "" })),
    lesson_content: "Locked completion",
    homework_assigned: "",
  }).replaceAll("'", "''");
  const child = spawn(
    "docker",
    [
      "compose",
      "--env-file",
      ".local/stack.env",
      "-f",
      "scripts/local/compose.yml",
      "exec",
      "-T",
      "db",
      "psql",
      "-X",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (d) => {
    stderr += d.toString();
  });
  const exit = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Completion transaction failed: ${stderr}`)),
    );
  });
  void exit.catch(() => {});
  const locked = new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.stdout.on("data", (d) => {
      if (d.toString().includes("GATE_LOCKED")) resolve();
    });
    child.on("exit", () =>
      reject(new Error("Transaction ended before lock barrier")),
    );
  });
  child.stdin.end(
    `begin; select id from public.class_sessions where id='${id}' for update; select 'GATE_LOCKED'; select pg_sleep(1); set local role authenticated; set local request.jwt.claim.sub='${actorId}'; select public.save_session_checkout('${id}',1,'${payload}'::jsonb,true); commit;`,
  );
  await locked;
  const registration = await teacher.rpc("register_session_attachment", {
    p_session: id,
    p_path: path,
    p_mime: "image/png",
    p_size: png.length,
  });
  await exit;
  expect(registration.error?.code).toBe("42501");
  expect(
    (
      await service
        .from("session_attachments")
        .select("id")
        .eq("session_id", id)
    ).data,
  ).toEqual([]);
  expect(
    (
      await service
        .from("class_sessions")
        .select("status")
        .eq("id", id)
        .single()
    ).data?.status,
  ).toBe("completed");
  expect(
    (await service.storage.from("session-attachments").remove([path])).error,
  ).toBeNull();
});

test("Another assigned teacher can read the snapshot but gets no checkout editor", async ({
  page,
}) => {
  const { id, teacher } = await setup();
  expect(
    (await teacher.rpc("start_class_session", { p_session: id })).error,
  ).toBeNull();
  const other = await actor("teacher3@gami.example");
  const teacherId = (await other.auth.getUser()).data.user!.id;
  const assignment = {
    teacher_id: teacherId,
    class_id: "21000000-0000-0000-0000-000000000001",
  };
  expect(
    (await service.from("teacher_class_assignments").insert(assignment)).error,
  ).toBeNull();
  try {
    await login(page, "teacher3@gami.example");
    await page.goto(`/teacher/sessions/${id}`);
    await expect(
      page.getByRole("heading", { name: "Chỉ xem buổi học" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Hoàn thành buổi dạy", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByLabel("Thêm ảnh/video")).toHaveCount(0);
    expect(
      (
        await other.rpc("save_session_checkout", {
          p_session: id,
          p_version: 1,
          p_data: {},
          p_complete: true,
        })
      ).error?.code,
    ).toBe("42501");
  } finally {
    expect(
      (
        await service
          .from("teacher_class_assignments")
          .delete()
          .eq("teacher_id", teacherId)
          .eq("class_id", assignment.class_id)
      ).error,
    ).toBeNull();
  }
});
