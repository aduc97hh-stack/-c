# Kiểm tra kế hoạch triển khai staging — 14/10/2026

PR #3 chỉ có đúng commit abaa4c9bf042f6bb20afe9a8d8d6222bfd3acf81, OPEN/MERGEABLE và hai Quality SUCCESS trước khi squash merge theo quyền người dùng. Main sau merge: 20f73a62fc43cca0766b0a5f218d3575f7dcebd1. Kế hoạch/hướng dẫn mới được chuẩn bị trên chore/staging-execution-plan, không tự gộp.

Không đổi source nghiệp vụ, schema hoặc migrations001–011. Thay đổi gồm hướng dẫn tiếng Việt A–M, guard provisioning, bộ giả lập tối thiểu và regression test. Seed cũ chỉ cho local; seed hosted mới cần môi trường staging, cờ cho phép rõ ràng và ref allowlist khớp URL/ref. Production hoặc thiếu allowlist phải dừng trước khi ghi. Người vận hành vẫn phải xác nhận project thật, không được gắn nhãn staging cho project production.

## Bằng chứng sau merge

- Cài lại lockfile, lint, typecheck: PASS.
- Unit25/25, trong đó kiểm từng entrypoint seed từ chối production và password provisioning không được nằm trong web runtime: PASS.
- Database/RLS fresh001–011, upgrade dữ liệu Phase2, pg_dump/restore synthetic: PASS. Migrations giữ nguyên byte so với main.
- Build với app Docker dừng và Supabase bindings trống: PASS; cấu hình hosted thiếu phải trả preflight FAIL theo tên biến, không in giá trị.
- Build có cấu hình local và E2E19/19 Auth/Storage/browser: PASS.
- Bộ dữ liệu mới chạy hai lần trên local, đúng3 tài khoản giả/1 lớp/15 HS với1 teacher assignment và15 CSKH assignments. Cả3 tài khoản đăng nhập Auth thật, profile/role/active và phạm vi15 HS đúng. Không nạp cloud hoặc dữ liệu học sinh thật.
- Supabase CLI2.120.0 kiểm phiên bản và hỗ trợ db push --dry-run/--skip-vault: PASS, dùng thư mục cấu hình riêng được bảo vệ. Chưa login/link/dry-run hosted vì chưa có project/quyền.
- Npm audit0 vulnerabilities; secret/artifact scan, kiểm private key trong client build và diff check: PASS.

Health minimal/private-no-store và Storage private/permission/upload, scheduler RPC restricted đã được kiểm lại trong E2E/DB. Không thêm debug route hoặc scheduler HTTP public. Hosting đề xuất Render Node Web Service giữ nguyên Next.js; video gần40 MiB/streaming trên host thật vẫn cần smoke, không suy ra từ local PASS.

Hướng dẫn chủ trung tâm: STAGING_STEP_BY_STEP_VI.md. Thứ tự thực tế A B C D F G H I E J K L M vì Auth URL cần HTTPS thật. Backup/Auth/private-object restore và Safari thật chưa chạy. Việc đầu tiên duy nhất giao người dùng là tạo project Supabase GAMI OS STAGING, chưa lấy/gửi key hay cấu hình các phần khác.
