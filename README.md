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
