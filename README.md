# GAMI OS

Hệ thống vận hành nội bộ cho Anh ngữ Gami.

## Mục tiêu
Một lần nhập dữ liệu sau buổi học -> tự sinh công việc -> đúng người xử lý -> không bỏ sót -> cô Gấm chỉ quản ngoại lệ.

## MVP
- Student 360
- Lớp học và lịch dạy
- Kết thúc buổi học trong 60-90 giây
- Auto Task
- GAMI Pulse
- Media Hub
- Dashboard cô Gấm
- Học phí / tái đăng ký ở giai đoạn sau
- Zalo OA tích hợp sau khi quy trình nội bộ ổn định

## Công nghệ đề xuất
- Next.js + TypeScript
- Supabase (Auth + PostgreSQL)
- Storage: Supabase Storage lúc đầu, có thể chuyển Cloudflare R2 khi media tăng
- PWA để dùng trên iPhone trước khi làm app iOS native

Xem `MASTER_SPEC.md` và thư mục `docs/`.


## Phase 1 — Nền tảng hiện tại

Next.js App Router + TypeScript strict + Supabase Auth/PostgreSQL. Bốn dashboard thực sự được bảo vệ ở server và RLS. Teaching Operations Phase 2 đã triển khai; các module ngoài scope vẫn được ghi rõ trong roadmap.

### Yêu cầu

- Node.js 22+ (khuyến nghị Node 24), npm; phiên bản dependency được khóa trong `package-lock.json`.
- Docker khi chạy Supabase local hoặc kiểm thử database.
- Supabase CLI 2.75.0 cho workflow hosted/CLI tùy chọn. `bash scripts/install-cli.sh` cài binary chính thức, kiểm SHA-256, tại `/workspace/tools`; ngoài cloud có thể đặt `GAMI_TOOLS_DIR`. Local mặc định dùng Docker Compose, không cần CLI.

### Cài đặt và chạy local

```bash
npm ci
bash scripts/start-local.sh
npm run dev
```

Script local khởi động PostgreSQL17, Supabase Auth, PostgREST, Storage và Kong cho workflow đã triển khai. Nó tạo `.env.local` và `.local/` (quyền 0600/0700, gitignored) với khóa/mật khẩu ngẫu nhiên. Nó bảo toàn file hiện có và từ chối dùng cấu hình hosted để seed ngoài ý muốn. Chỉ gateway/database bind vào loopback; không expose admin API Kong. Đây là stack local tối thiểu, không bao gồm extension và dịch vụ Supabase chưa dùng. Cloud Docker dùng `vfs`, nên tránh image Supabase PostgreSQL rất lớn.

Seed tạo 6 user bằng **Auth Admin API**, không chèn password vào bảng Auth. Tài khoản giả lập: `admin1@gami.example`, `teacher2@gami.example`, `teacher3@gami.example`, `cskh4@gami.example`, `cskh5@gami.example`, `media6@gami.example`. Mật khẩu nằm trong `GAMI_SEED_PASSWORD` của `.env.local`; không chia sẻ hoặc commit. Startup chỉ seed khi chưa có profile, giữ dữ liệu demo đã chỉnh sửa. Chạy `npm run seed` chủ động để làm mới fixture; seed lặp lại giữ nguyên password user đã tồn tại. Dữ liệu: 3 lớp, 15 học sinh giả lập; teacher 1 có A, teacher 2 có B/C; CSKH chia nhóm 8/7.

Startup áp dụng migration mới bằng `scripts/migrate-local.mjs`; migration và bản ghi version nằm trong cùng transaction, schema tracking không được expose qua REST. Chạy lại startup không reset database. `docker compose --env-file .local/stack.env -f scripts/local/compose.yml down` dừng dịch vụ và giữ volume; chỉ dùng `down -v` khi chủ động muốn **xóa dữ liệu local**. Với Supabase CLI tiêu chuẩn ngoài cloud, `supabase start` / `supabase migration up --local` áp dụng migrations; không chạy đồng thời stack Compose và CLI do trùng port.

### Supabase hosted

Nếu cài CLI bằng helper trong cloud, dùng `/workspace/tools/supabase` thay cho `supabase` ở các lệnh dưới đây.

1. Tạo project và tắt public signup trong Auth; nhân sự được cấp tài khoản theo quy trình quản trị.
2. Sao chép `.env.example` thành `.env.local`; điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` (khóa public/anon, không phải service role).
3. Dùng CLI đã đăng nhập: `supabase link --project-ref <project-ref>`, kiểm tra `supabase db push --dry-run`, rồi `supabase db push`. Review migration trước khi áp dụng vào project có dữ liệu.
4. Tạo người dùng qua Supabase Auth Admin/Dashboard; tạo `profiles` khớp UUID Auth và role bằng quản trị tin cậy. Không có trigger lấy role từ user metadata. Admin đầu tiên phải được cấp ngoài ứng dụng. Admin có thể quản lý hồ sơ nhân sự trong dashboard; đổi role yêu cầu gỡ assignment trước. Tài khoản admin được bảo vệ khỏi thao tác khóa/đổi role qua UI.
5. Chỉ seed vào project thử nghiệm riêng: đặt server-only `SUPABASE_SERVICE_ROLE_KEY`, `GAMI_SEED_PASSWORD` (ít nhất 16 ký tự), `GAMI_ALLOW_DEMO_SEED=yes`; chạy `npm run seed`. Không seed production. Phase 2 upload cần service role key server-only; auth và business queries vẫn dùng caller JWT.
6. Chạy `npm run build` sau khi thay đổi biến `NEXT_PUBLIC_*`, rồi `npm start`. Triển khai HTTPS; cấu hình Auth site URL tương ứng, rate limits, MFA cho admin và chính sách backup trước khi đưa dữ liệu thật vào.

Không có credentials, ứng dụng vẫn lint/typecheck/build được; login hiển thị chưa cấu hình và từ chối đăng nhập. Không có auth giả hoặc bypass demo.

### Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm audit --omit=dev
```

`test:db` dùng PostgreSQL 17 disposable, không mở port, kiểm migration và RLS thực tế. Auth schema trong test chỉ mô phỏng contract `auth.uid()`; không thay thế kiểm thử Supabase Auth. Sau khi chạy local Supabase và build, `npm run test:e2e` kiểm đăng nhập thật, sáu tài khoản, route protection, privacy/RLS qua REST và viewport iPhone. Test này chỉ chạy trên URL Supabase local; không chạy với dữ liệu thật.

CI chạy install, lint, typecheck, unit, PostgreSQL RLS fresh/upgrade, recovery, audit và secret/artifact scan. CI tự khởi tạo Auth/Storage local với credential test ngẫu nhiên, build rồi chạy toàn bộ E2E; không cần credential cloud thật.

### Tài liệu

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Bảo mật và vận hành](docs/SECURITY.md)
- [Phạm vi và nghiệm thu Phase 1](docs/PHASE1_ACCEPTANCE.md)

Tài liệu nghiệp vụ gốc tiếp tục mô tả roadmap toàn sản phẩm, không có nghĩa tất cả module đã được xây dựng.


## Phase 2 — Teaching Operations Core

Đã có lịch hôm nay, admin tạo session, checkout theo ngoại lệ với autosave draft, transaction hoàn tất, rule engine/Auto Task, Mission Board, Student 360, Pulse, Command Center và attachment private. Chạy `bash scripts/start-local.sh` để cập nhật migrations/Storage và thêm lớp demo 15 HS. Sau đó `npm run build` và `npm start`, hoặc `npm run dev`. Xem [PHASE_2.md](docs/PHASE_2.md) cho workflow/RLS/config và giới hạn.

Local Storage dùng volume private và không cần cloud credentials. Hosted Phase 2 cần `SUPABASE_SERVICE_ROLE_KEY` server-only cho upload đã validate (không dùng cho auth/query nghiệp vụ); giữ key trong environment settings, không commit/chat. Đây là thay đổi so với nguyên tắc web chỉ dùng public key của Phase 1. JPEG/PNG/WEBP ≤10 MiB; MP4 ≤40 MiB; cấu hình reverse proxy body limit ≥41 MiB.

Quality đầy đủ: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`, `npm run test:e2e`, `npm audit --omit=dev`. E2E dùng local Supabase/Storage và Chromium; nếu ngoài cloud chưa có browser, chạy `npx playwright install chromium`. Video upload E2E dùng ffmpeg; cài ffmpeg bằng package manager hệ thống nếu chưa có. Full và production audit đều sạch sau scoped lint dependency replacement.

## Phase 3 — Production Pilot & Daily Operations

Lịch lặp + date-specific exceptions, audited correction amendments (original completed immutable), audit/inbox/escalation, standalone PWA và server-timed pilot metrics. Admin chọn pilot pairs ở `/admin/operations`. Không bật cron/backup/cloud deployment tự động; xem [PHASE_3.md](docs/PHASE_3.md), [DEPLOYMENT.md](docs/DEPLOYMENT.md), [BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md).

Migrations008–011 additive; 001–007 giữ nguyên. `npm run test:db` kiểm fresh và Phase2-data upgrade. `bash scripts/test-recovery.sh` kiểm pg_dump/restore synthetic + RLS. Dedicated runner: `node --env-file=.env.local scripts/run-operations.mjs` chỉ local hoặc secure server environment (không seed production). Quality CI chạy thêm Auth/Storage E2E, audit và recovery.

Local startup mặc định project gami-phase2 vì giữ volume dữ liệu cũ. Để kiểm thử fresh riêng, dùng COMPOSE_PROJECT_NAME đã chọn thống nhất trong startup/E2E; không xóa volume đang có dữ liệu người dùng. PWA requires HTTPS (loopback only for local tests); service worker caches no PII.
