# Kiến trúc Phase 1

## System overview

Một ứng dụng Next.js 16 App Router, React Server Components, TypeScript strict. Supabase giải quyết Auth và PostgreSQL; local kiểm thử dùng Compose với PostgreSQL slim và các service Supabase Auth/PostgREST/Kong chính thức để tránh chi phí driver vfs, hosted dùng Supabase managed; không có backend/microservice riêng. Các dashboard đọc dữ liệu thật và thể hiện rõ module chưa triển khai.

- `src/app`: routes, Server Actions, error/loading/not-found/unauthorized.
- `src/components`: dashboard chung, responsive mobile-first, input/button tối thiểu 48px.
- `src/config/roles.ts`: enum TypeScript và kiểm tra role-route.
- `src/server`: xác thực và đọc dữ liệu, đánh dấu `server-only`.
- `src/lib/supabase`: client browser/server và cấu hình public.
- `src/types/database.ts`: types phản ánh migration; khi schema phát triển, generate lại từ project staging bằng Supabase CLI (`supabase gen types typescript --project-id <ref>`) và review diff; `--local` chỉ dùng với stack CLI tiêu chuẩn.
- `supabase/migrations`: schema versioned.
- `scripts`: local setup, Auth seed và test database.

Chưa tạo `features/` khi chưa có nghiệp vụ, tránh thư mục rỗng/abstraction không dùng.

## Auth và data flow

Login Server Action gọi Supabase Auth bằng email/password. Cookies SSR lưu session; proxy gọi `getUser()` để refresh và chuyển cookie. Mỗi dashboard gọi `requireRole()`: xác thực user bằng Auth server, đọc profile active qua RLS, kiểm role từ database. Role/JWT metadata/client state không được dùng làm quyền. Trang `/` redirect theo role; không nhận redirect URL từ client. Logout gọi signOut và xóa session cookies.

Protected content luôn dynamic và private/no-store; không chia sẻ cache giữa nhân sự. Server Actions dùng kiểm tra origin của Next.js và lặp lại authorization trước mutation. Proxy refresh phiên và trả HTTP 307 cho request chưa đăng nhập vào protected routes; không thay thế kiểm tra role/profile ở server hoặc RLS.

Browser client dùng duy nhất khóa public. Truy vấn nghiệp vụ và signed URL dùng khóa public + session người dùng. Phase 2 có uploader server-only dùng service role chỉ sau byte validation và kiểm quyền; seed dùng service role riêng.

## Database

`profiles` FK tới `auth.users`, enum role, active; `classes`; `students` FK class; `teacher_class_assignments` và `cskh_student_assignments` composite PK. `student_contacts` tách parent_name/parent_phone vì RLS không che được cột trong một row đã cho phép đọc. Tất cả bảng có timestamp, constraint và RLS. Index cho FK và assignment theo chiều ngược. Classes có học sinh không thể bị xóa nhờ RESTRICT; xóa student xóa contacts/assignments; xóa Auth user xóa profile/assignments.

Helper `private.current_role()` SECURITY DEFINER chỉ trả role của `auth.uid()` đang active, search_path rỗng, hạn chế EXECUTE, không nhận user ID tùy ý. Private schema không được expose qua REST. Helper tránh RLS recursion trên profiles. Assignment triggers buộc đúng loại nhân sự; đổi role khi còn assignments bị từ chối.

## Ma trận quyền

| Dữ liệu | Admin | Teacher | CSKH | Media |
|---|---|---|---|---|
| Profiles | CRUD | Đọc chính mình | Đọc chính mình | Đọc chính mình |
| Classes | CRUD | Đọc lớp được giao | Không | Không |
| Students | CRUD | Đọc theo lớp | Đọc theo assignment | Không |
| Student contacts | CRUD | Không | Đọc HS được giao | Không |
| Assignments | CRUD | Đọc assignment teacher của mình | Đọc assignment CSKH của mình | Không |

Không có write policy cho teacher/CSKH/media trong Phase 1. Dashboard route chỉ nhận đúng role của nó, admin dùng dashboard admin để thấy dữ liệu toàn hệ thống. Admin UI cập nhật profile, các quản trị dữ liệu khác thực hiện qua API RLS hoặc quy trình Supabase được kiểm soát; Phase 2 bổ sung session/task RPC có kiểm quyền và khóa concurrency.

## Future modules

Sessions/checkout Phase 2; tasks Phase 3; Student 360/Pulse Phase 4; media private storage/signed URLs Phase 5; tuition Phase 6; Zalo Phase 7; AI Phase 8. Chưa tạo bảng trống, policy rộng hoặc giả lập nghiệp vụ tương lai. Khi thêm module, tạo migration mới, bổ sung ma trận RLS và kiểm thử cả truy cập được phép lẫn bị từ chối. Quy mô 400–1.000 học sinh phù hợp schema quan hệ và index hiện tại; dashboard đếm chính xác bằng count theo RLS, danh sách xem nhanh giới hạn 100 và thông báo khi bị giới hạn; bổ sung pagination khi mở rộng module hồ sơ và đo query plan trước tối ưu.


## Phase 2 implementation

Feature module `src/features/teaching` cung cấp checkout, attachments, task board và shared types/time/validation. Server data layer scope theo RLS, không N+1 ở danh sách task; command aggregate ở PostgreSQL. Bảng/RPC/rule/storage contract và diagram workflow mô tả trong PHASE_2.md. Record notes tách bảng để không expose cho CSKH. Storage uploader server-only có service credential chỉ cho validated uploads; queries và signed URL dùng caller JWT. Migrations Phase 1 được giữ nguyên. Future modules trong phần roadmap gốc nay được mở rộng theo scope Phase 2 được giao, không có integration/automation nhắn tin.

## Phase 3 implementation

Operations module và RPC quản lý lịch lặp, correction amendments/effective academic view, audit/notifications và server-timed pilot events. Private deterministic runner dùng advisory lock, configurable thresholds và recipient/entity dedupe. Public scheduled wrapper chỉ service EXEC; ordinary business actions caller JWT. New table writes denied even service_role; function definer enforces business authorization. PWA worker network-only. See PHASE_3.md/DEPLOYMENT.md/BACKUP_RECOVERY.md for rollout and external prerequisites.
