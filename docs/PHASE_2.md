# Phase 2 — Teaching Operations Core

## Workflow và UX

Admin tạo lịch tại `/admin/sessions`, chọn đúng giáo viên đã được phân công. Giáo viên mở `/teacher/today`, bắt đầu lớp để chốt roster, rồi nhập ngoại lệ tại `/teacher/sessions/[id]`. Mặc định: có mặt, đủ BTVN, đạt bài cũ. Ba bulk actions hỗ trợ reset cả lớp; học sinh không có ngoại lệ không cần thao tác riêng. Danh sách dạng accordion, form có label, touch target ≥48px, footer hoàn tất sticky.

Draft autosave lên database sau khoảng 1 giây, có nút lưu thủ công và thông báo trạng thái. Không lưu PII vào localStorage. Mạng lỗi giữ nguyên form trong bộ nhớ và cho retry; refresh khi chưa lưu có cảnh báo trình duyệt. Sau khi báo đã lưu, refresh phục hồi draft server. Hoàn tất cần xác nhận số học sinh/ngoại lệ; không cho hoàn tất khi upload còn chạy.

## Session lifecycle và atomicity

`scheduled → in_progress → completed`; `cancelled` được dự trữ, không có UI hủy/recurring timetable. `start_class_session` chốt roster từ học sinh active thuộc lớp. `save_session_checkout` khóa row session FOR UPDATE, kiểm version và toàn bộ roster, kiểm enum/score/note, lưu records và ghi chú riêng, sau đó tạo events/tasks và completed metadata trong **một transaction**. Lỗi bất kỳ rollback toàn bộ. Session không có roster không thể bắt đầu.

Teacher chỉ ghi session do chính mình phụ trách, thuộc lớp được giao; admin có thể thao tác trước completed. Completed bị khóa với mọi nhân sự, không có sửa lịch sử trực tiếp trong UI/RPC. Quy trình correction có audit riêng cần được thiết kế khi có nhu cầu; không dùng SQL ad hoc để sửa kết quả. Retry completion trả completed/replayed và không thay đổi payload đã chốt.

`version` chống hai tab hoặc teacher/admin ghi đè draft; conflict trả SQLSTATE 40001. Các student row được khóa theo thứ tự UUID ổn định, giúp serialize rule evaluation giữa hai session. Unique active task `(student_id,type)` ngăn trùng giữa nhiều session; event `idempotency_key` ngăn trùng khi retry.

## Rule engine V1 (database canonical)

| Trigger                 | Task / event                                       |
| ----------------------- | -------------------------------------------------- |
| Missing homework        | homework_followup cho CSKH, normal                 |
| ≥2 missing trong 7 ngày | nâng task đang mở lên high, không tạo task thứ hai |
| Absent unexcused        | absence_followup                                   |
| Absent excused          | attendance event, không tự tạo absence task        |
| Score <5                | low_score_followup và teacher_review               |
| Old lesson needs_review | teacher_review                                     |
| Needs_attention         | general_attention, một task tương tự đang mở       |

Nguồn config duy nhất: `private.teaching_rules`: window_days=7, repeat_count=2, low_score=5, due_hours=24. UI đọc qua `teaching_configuration`, không nhận threshold quyết định quyền/rule từ client. Thay threshold bằng migration mới, thêm case test và review nghiệp vụ. Rule nằm trong RPC database, không chạy phụ thuộc UI. SQL test matrix thực thi rule, pulse, transition, duplicate prevention trên PostgreSQL thật.

Một CSKH active duy nhất được gán student → owner. Không có hoặc nhiều owner active → task unassigned, xuất hiện admin exception. Teacher_review giao giáo viên của session. Không tự chọn ngẫu nhiên owner/backup. Admin dùng task detail để gán lại, RPC buộc đúng role, active và assignment. Nhân sự mất phân công không đọc/xử lý task; admin nhìn thấy owner không còn hợp lệ.

## Student 360, Pulse và Mission Board

`/students/[id]`: lớp/GV/CSKH, tổng quan 30 ngày (tối đa 200 records), timeline 50 events gần đây. Chỉ completed records được tính. CSKH không nhận nội dung ghi chú riêng giáo viên.

Pulse có chữ XANH/VÀNG/ĐỎ và reasons. RED nếu missing/low score lặp ≥2 trong cửa sổ 7 ngày, task high/urgent hoặc quá hạn. YELLOW nếu có buổi bất thường gần đây hoặc task mở; GREEN nếu không có. Đây là tín hiệu vận hành, không phải AI kết luận học lực.

`/cskh/tasks`, `/teacher/tasks`, `/admin/tasks`: phân nhóm overdue/today/upcoming/waiting/done, lọc type/priority/student/class, pagination 50 tasks. Task detail cho status/result/follow-up; kết quả bắt buộc khi done, follow-up phải ở tương lai. Done/cancelled bất biến. Audit updated_by/version, events task_updated. Admin Command Center dùng aggregate RPC theo scope admin, không tải 400 hồ sơ ở mọi trang, hiển thị session hôm nay, Pulse, task exceptions và giáo viên chưa checkout.

## Storage private và validation

Bucket `session-attachments` private. Teacher đúng session hoặc admin POST `/api/sessions/[id]/attachments`. Server xác thực profile active và session mutable, giới hạn body 41 MiB, sniff magic bytes, kiểm size: JPEG/PNG/WEBP ≤10 MiB, MP4 ≤40 MiB. Không nhận đường dẫn/owner/MIME tin cậy từ client; path UUID session + UUID file và extension được tạo server. Không hỗ trợ SVG, HEIC hoặc MOV ở giai đoạn này.

Để **không thể bypass byte validation bằng gọi SDK trực tiếp**, authenticated users không có INSERT/UPDATE Storage policy. Module `server-only` storage uploader dùng `SUPABASE_SERVICE_ROLE_KEY` chỉ cho upload đã kiểm quyền và cleanup orphan. Đây là ngoại lệ mới, được cô lập; mọi truy vấn nghiệp vụ/RPC dùng JWT của người dùng. Key không có NEXT_PUBLIC, không vào browser, không log. Hosted cần cấp key này qua environment settings an toàn. Không dùng key này để tin role/owner client.

Register RPC kiểm file thực sự tồn tại, trusted user_metadata.uploaded_by khớp auth.uid, size/MIME metadata khớp và session còn mutable. Nếu hoàn tất đồng thời với upload, registration bị từ chối và server cleanup file. Storage và DB không chung transaction; orphan chưa register không có read policy, có thể cần housekeeping sau lỗi cleanup hiếm gặp.

Download dùng caller JWT qua RLS, chỉ teacher lớp được giao/admin. Signed Storage URL 60 giây chỉ ở server, file stream qua endpoint kiểm quyền với private/no-store. Không trả bearer URL ra browser/log/timeline; mỗi download kiểm lại quyền. URL public không hoạt động. Không làm approval, marketing media hoặc Media Hub. `media_permission` vẫn pending mặc định.

## RLS và audit

Sáu bảng mới và record_notes đều RLS, authenticated chỉ SELECT theo scope; không có write API trực tiếp. SECURITY DEFINER RPC có search_path rỗng, kiểm quyền fail-closed, hạn chế EXECUTE cho authenticated, private helpers không expose. Quyền teacher/admin ghi chỉ qua RPC. CSKH chỉ core learning history completed, assigned student events và task đúng owner; không ghi chuyên môn, không đọc notes/attachments. Media không đọc dữ liệu mới.

Audit: created_by, updated_by, completed_by/at; tasks giữ source session/record; events có actor/time/idempotency key. Parent contacts Phase 1 không thay đổi. Toàn bộ thời gian lưu UTC, ngày học/giao diện UTC+7 (Asia/Bangkok).

## Local và test

`bash scripts/start-local.sh` khởi động official PostgreSQL/Auth/PostgREST/Storage/Kong, áp dụng migrations 002–007, seed lớp 15 HS/session demo, bảo toàn dữ liệu đã có. Storage file backend dùng Docker volume private cho local; production dùng Supabase managed Storage. Gateway signed download không đòi apikey vì bản thân token URL được Storage kiểm tra; upload/update vẫn cần JWT hợp lệ.

Quality: frozen npm ci, lint, strict typecheck, unit, PostgreSQL/RLS matrix, E2E real Auth/Storage, production build và dependency audit đầy đủ/production. E2E gồm regression Phase 1; fixture Phase 1 được lọc mã DEMO để vẫn kiểm đúng scope khi thêm lớp P2. Fixture mới dùng P2, không sửa/xóa học sinh Phase 1. E2E tạo session mới mỗi lần, test dữ liệu giả lập riêng, không chạy hosted/production.

Các test cover rollback, wrong teacher/student/score, missing session/owner, completed/retry, concurrent completion, media/CSKH privacy, MIME spoof/oversized upload, actual PNG + MP4, signed download, Mission Board và Student 360. Automated speed fixture ghi số tương tác và elapsed; đây không phải khảo sát thời gian giáo viên thật đọc/nhập trên iPhone. Cần pilot đo 60–90 giây với giáo viên thật trước rollout.

## Known limitations

Không Zalo/tuition/reenrollment/AI/payment/chatbot/iOS/Media Hub. Không recurring timetable hoặc sửa completed session. Timeline giới hạn 50, summary 200 records; cần pagination lịch sử sâu khi sử dụng dài hạn. MIME validation là signature/container kiểm cơ bản, không transcoding/antivirus. Hosting cần body limit phù hợp; Supabase hosted và thiết bị Safari thật cần staging/pilot riêng.

Chuỗi lint chứa advisory `braces` đã được thay bằng scoped `tinyglobby` override, có test API và rule Next thực tế. Full audit và production audit đều sạch; không downgrade Next hoặc tắt lint. Xem SECURITY.md.

## Review và bằng chứng nghiệm thu

1. Product: đổi 15 form mở thành accordion; 14 học sinh bình thường không cần chỉnh, chỉ mở ngoại lệ. Footer không hoàn tất khi upload đang chạy; lịch sử completed được đọc từ server, không hiển thị payload retry như dữ liệu đã chốt.
2. Engineering: RPC row locks + optimistic version, roster đủ/unique, ordered student locks, partial unique active task, event idempotency; NULL version cũng bị từ chối. Threshold UI lấy cùng canonical DB config.
3. Security: inactive/role NULL fail-closed, Origin check cho upload cookie-auth, route + RLS + RPC guards, spoofed/oversized uploads bị từ chối, direct Storage insert/update không bypass server, signed access teacher/admin only.

Speed fixture đã chạy với 15 HS/14 bình thường, một HS có vắng không phép + thiếu BTVN + score 4: khoảng 10 core tap/field interactions, không thao tác từng học sinh bình thường. E2E còn thực hiện retry offline, refresh, negative upload và PNG/MP4; elapsed tự động được in theo lần chạy. Không đồng nhất automated elapsed với đo người dùng thật; pilot giáo viên/iPhone thật còn cần trước production rollout.

Nghiệm thu cuối: 8 unit tests và 17 E2E tests PASS; PostgreSQL/RLS matrix PASS; lint/typecheck/production build PASS; npm audit đầy đủ/production 0 vulnerabilities. Speed fixture gần nhất: 10 core interactions, 6662 ms tự động gồm draft refresh và upload/security checks.

## Final gate hardening

Migrations 006–007 bổ sung identity RPC lấy roster từ session_student_records (không lọc class_id/active hiện tại), academic timestamp history sau chuyển lớp, row locks cho attachment registration, DB triggers chặn sửa/xóa completed history và thay roster identity, canonical owner-validity dùng chung cho RLS/RPC/Command Center. Rule missing homework lấy cửa sổ theo buổi completed mới nhất để không phụ thuộc thứ tự chốt. Private cache metadata của file cũ được giảm về max-age=0; frontend download qua no-store proxy để tránh upstream thiếu cache headers. Popup mở trong user gesture và xóa opener; keyboard focus tắt sticky bars trên mobile. Xem FINAL_GATE_PHASE_2.md.
