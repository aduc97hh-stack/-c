# ROADMAP

## Phase 1 - Nền tảng
- Next.js + TypeScript
- Supabase project
- Auth + RBAC
- Database schema
- Seed data

## Phase 2 - Luồng dạy học
- Lớp học
- Lịch dạy
- Điểm danh
- Kết thúc buổi học 60-90 giây
- Ghi chú HS cần lưu ý

## Phase 3 - Auto Task
- Rule engine cơ bản
- Mission Board cho 4 nhân viên
- Follow-up
- Quá hạn

## Phase 4 - Student 360 + GAMI Pulse
- Hồ sơ HS
- Timeline học tập
- Màu xanh/vàng/đỏ
- Dashboard ngoại lệ cho cô Gấm

## Phase 5 - Media Hub
- Upload iPhone
- Phân loại media
- Quyền sử dụng hình ảnh
- Kho truyền thông
- Trạng thái đã dùng

## Phase 6 - Học phí & tái đăng ký
- Theo dõi số buổi
- Cảnh báo sắp hết khóa
- Quy trình tái đăng ký

## Phase 7 - Zalo OA
- Nối task với CSKH
- Lưu lịch sử liên hệ
- Chưa tự gửi tin nếu chưa có duyệt người dùng

## Phase 8 - AI
- Tóm tắt tiến bộ
- Gợi ý nội dung CSKH
- Gợi ý phân loại media
- Không tự đánh giá chuyên môn thay giáo viên


## Scope cập nhật theo yêu cầu Phase 2

Teaching Operations Core bao gồm deterministic rules, Auto Task V1, Mission Board, Student 360 timeline/Pulse V1, Command Center và attachment private tối thiểu ngay trong Phase 2. Các mục này là mở rộng scope đã được giao, không phải tự bắt đầu Phase 3. Phase 3 tiếp theo nên ưu tiên pilot 60–90 giây, correction/audit workflow, escalation cấu hình và cải thiện triage; không triển khai trước khi review Phase 2. Media Hub marketing/approval, Zalo, tuition, AI và iOS vẫn là các phase sau.

## Scope Phase 3 được giao

Production Pilot & Daily Operations: recurrence, audited amendments/task reconciliation, inbox/escalation, PWA, pilot timing and staging/recovery preparation. Phase3 PR#2 was squash merged after explicit authorization and SHA/CI verification. Staging readiness continues on a separate PR, without business expansion. Real hosted rollout/backup/hardware pilot still requires operator bindings and rehearsal. No Phase4 features.
