import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const roles = ["admin", "teacher", "teacher", "cskh", "cskh", "media"] as const;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.GAMI_SEED_PASSWORD!;
const create = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
async function signIn(index: number) {
  const client = create();
  const result = await client.auth.signInWithPassword({
    email: `${roles[index]}${index + 1}@gami.example`,
    password,
  });
  expect(result.error?.code ?? null).toBeNull();
  return client;
}
test("Anonymous protected routes always redirect to login", async ({
  page,
}) => {
  for (const role of ["admin", "teacher", "cskh", "media"]) {
    const response = await page.request.get(`/${role}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers()["location"], response.url()).pathname).toBe("/login");
    await page.goto(`/${role}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Chào mừng đến GAMI OS" }),
    ).toBeVisible();
  }
});
test("Invalid credentials do not open a dashboard", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("nobody@gami.example");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("Invalid-for-test-only");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login\?error=invalid/);
});
for (let i = 0; i < roles.length; i++) {
  test(`Account ${i + 1}: login, scope, cross-role denial, mobile and logout`, async ({
    page,
  }) => {
    const role = roles[i];
    await page.goto("/login");
    await page
      .getByLabel("Email", { exact: true })
      .fill(`${role}${i + 1}@gami.example`);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${role}$`));
    await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
    if (role !== "media") {
      const section = page.locator("section").filter({
        has: page.getByRole("heading", {
          name: "Học sinh trong phạm vi quyền",
          exact: true,
        }),
      });
      await expect(section.locator("li")).toHaveCount([15, 5, 10, 8, 7, 0][i]);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const other of ["admin", "teacher", "cskh", "media"]) {
      if (other === role) continue;
      await page.goto(`/${other}`);
      await expect(page).toHaveURL(/\/unauthorized$/);
    }
    await page.goto(`/${role}`);
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(`/${role}`);
    await expect(page).toHaveURL(/\/login$/);
  });
}
test("Direct REST applies RLS, contact privacy and denies self-promotion", async () => {
  for (let i = 0; i < roles.length; i++) {
    const client = await signIn(i);
    const refresh = await client.auth.refreshSession();
    expect(refresh.error?.code ?? null).toBeNull();
    const students = await client.from("students").select("id");
    expect(students.error?.code ?? null).toBeNull();
    expect(students.data?.length).toBe([15, 5, 10, 8, 7, 0][i]);
    const contacts = await client
      .from("student_contacts")
      .select("student_id,parent_phone");
    expect(contacts.error?.code ?? null).toBeNull();
    expect(contacts.data?.length).toBe([15, 0, 0, 8, 7, 0][i]);
    if (i === 1) {
      const other = await client
        .from("students")
        .select("id")
        .eq("id", "30000000-0000-0000-0000-000000000006");
      expect(other.data?.length).toBe(0);
      const authUser = await client.auth.getUser();
      const id = authUser.data.user!.id;
      const promotion = await client
        .from("profiles")
        .update({ role: "admin" })
        .eq("id", id)
        .select("id");
      expect(promotion.data?.length).toBe(0);
      const metadata = await client.auth.updateUser({
        data: { role: "admin" },
      });
      expect(metadata.error?.code ?? null).toBeNull();
      const again = await client.from("students").select("id");
      expect(again.data?.length).toBe(5);
      const mutation = await client
        .from("students")
        .update({ full_name: "tampered" })
        .select("id");
      expect(mutation.data?.length).toBe(0);
    }
  }
});
test("Disabled staff lose access with an existing session", async ({
  page,
}) => {
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const client = await signIn(1);
  const user = (await client.auth.getUser()).data.user!;
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("teacher2@gami.example");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/teacher$/);
  try {
    const disabled = await service
      .from("profiles")
      .update({ active: false })
      .eq("id", user.id);
    expect(disabled.error?.code ?? null).toBeNull();
    const rows = await client.from("students").select("id");
    expect(rows.data?.length).toBe(0);
    await page.goto("/teacher");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    const restored = await service
      .from("profiles")
      .update({ active: true })
      .eq("id", user.id);
    if (restored.error)
      throw new Error("Could not restore local test profile.");
  }
});

test("Admin can manage staff profiles through a server action", async ({
  page,
}) => {
  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const media = await signIn(5);
  const id = (await media.auth.getUser()).data.user!.id;
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("admin1@gami.example");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  try {
    const form = page
      .locator("form.profile-form")
      .filter({ has: page.locator('input[value="Truyền thông demo"]') });
    await form
      .getByLabel("Họ tên", { exact: true })
      .fill("Truyền thông kiểm thử");
    await form.getByRole("button", { name: "Lưu hồ sơ" }).click();
    await expect(
      page.locator('input[value="Truyền thông kiểm thử"]'),
    ).toBeVisible();
    const result = await service
      .from("profiles")
      .select("full_name")
      .eq("id", id)
      .single();
    expect(result.data?.full_name).toBe("Truyền thông kiểm thử");
  } finally {
    const restored = await service
      .from("profiles")
      .update({ full_name: "Truyền thông demo" })
      .eq("id", id);
    if (restored.error)
      throw new Error("Could not restore local media profile.");
  }
});
