# Phase 1 — Nghiệm thu kỹ thuật

Ngày kiểm tra: 2026-10-13. Đây là kết quả ở cloud workspace/local test stack; chưa xác nhận Supabase hosted hay production deployment.

## Phạm vi hoàn thành

- [x] Next.js stable, App Router, TypeScript strict.
- [x] Supabase browser/server clients, Auth login/logout/session refresh.
- [x] Server role validation, protected routes, bốn role và dashboard riêng.
- [x] Migration, RLS, enum, PK/FK/index/CHECK/timestamps.
- [x] Privacy: contacts tách bảng, teacher/media không đọc phone.
- [x] Profile management cho admin; bootstrap Auth user/admin qua quy trình tin cậy.
- [x] Seed bằng Auth Admin API: 6 user, 3 lớp, 15 học sinh giả lập.
- [x] Responsive mobile-first, loading/error/empty/unauthorized/not-found.
- [x] .env.example, README, ARCHITECTURE, SECURITY, GitHub Actions.
- [x] Không có nghiệp vụ Phase 2 hoặc module ngoài phạm vi.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| npm install / frozen npm ci | PASS |
| Lint | PASS |
| Typecheck | PASS |
| Production build | PASS |
| Unit test | PASS, 2 test, gồm 16 tổ hợp role-route |
| PostgreSQL RLS integration | PASS, migration và các ca quyền/constraint thực thi trên PostgreSQL |
| Auth/REST/browser E2E | PASS, 11 test trên production server và local Auth thật |
| Khởi động trên database mới | PASS, migration + seed tự động |
| Khởi động lặp lại | PASS, giữ migration version, dữ liệu và credential local |
| Audit dependencies production | PASS, 0 vulnerability được báo |
| Audit toàn bộ dependencies | FAIL: 1 advisory high, chuỗi 5 package dev; xem SECURITY.md |

E2E kiểm tra HTTP 307 cho request anonymous vào protected routes và mọi tài khoản đăng nhập đúng dashboard, phạm vi học sinh, sai role bị chặn, logout, viewport 390×844 không tràn ngang, REST RLS/contacts/IDOR, tự nâng quyền và user metadata spoofing bị vô hiệu, refresh token thật, khóa tài khoản khi còn session và cập nhật hồ sơ admin.

Các test không chứng nhận security toàn diện. Một advisory dev chưa có bản vá tương thích còn tồn tại; không che audit failure hoặc hạ Next.js để làm audit xanh. Không có hosted credentials nên migration/Auth/RLS trên project hosted và cấu hình vận hành production vẫn cần được kiểm tra trước khi dùng dữ liệu thật.

## Tự review

Security/authorization/RLS: session xác minh server, role database, default-deny, không service role trong web. Type safety/maintainability: strict types, module server-only, ít dependency, cấu trúc đơn giản. Privacy: synthetic fixtures, contacts riêng, không log PII hoặc secret. Scalability: assignment indexes và count chính xác theo RLS; danh sách xem nhanh tối đa 100, pagination chi tiết dành cho module hồ sơ. Mobile: viewport iPhone, input/button/touch label tối thiểu 48px. Technical debt: advisory lint upstream và production operational configuration được ghi rõ. Không có microservice riêng hay nghiệp vụ Phase 2.
