# FINAL GATE PHASE 2

Review branch feature/phase-2-teaching-operations và PR#1; giữ main, không Phase3.

## Bugs phát hiện và sửa

| Issue                                                                        | Fix / regression                                                                                                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Session names dựa students.class_id hiện tại                                 | session_roster bound snapshot; SQL transfer/inactive/assignment revocation và browser25-pupil                                               |
| Student360 thiếu completed timestamps sau transfer                           | student_session_history returns academic metadata only; new teacher history test không cấp note/attachment access                           |
| Attachment registration check không khóa parent                              | SELECT FOR UPDATE trước validation; barrier race phải đợi completed rồi reject                                                              |
| Completed immutable chỉ được bảo vệ ở public RPC/authenticated privileges    | DB guard triggers trên session/records/notes/metadata; privileged REST/SQL mutation reject, replay giữ nguyên canonical result              |
| Existing task owner stale; ambiguous owner vẫn đọc task cũ                   | canonical task_owner_valid cho policy/RPC/dedupe/admin summary; inactive/revoked/multiple-owner tests                                       |
| Repeat homework priority phụ thuộc completion order                          | window anchored newest completed lesson; reverse-order regression                                                                           |
| Storage signed response thiếu Cache-Control; file cũ cache3600               | cache0 + legacy migration; signed capability chỉ ở server, download proxy private/no-store với caller reauthorization                       |
| Safari popup mở sau await                                                    | synchronous blank window + opener=null, navigate sau authorization; browser popup regression                                                |
| Sticky controls khi keyboard thu viewport; non-owner có editor không thể lưu | static controls during focus, safe-area padding; viewport320/390/430 + height420, 25-pupil completion; readonly non-owner editor regression |

## Verification scope

Roster IDs frozen khi start; live identity name/code được join, không dùng current class/active để suy diễn membership. Former staff mất assignment không đọc nữa; admin vẫn thấy exact snapshot. Teacher mới chỉ academic history của student được giao, không đọc private notes/attachments lớp cũ.

Completed session/records/notes/lesson_content/homework/attachment metadata không thay qua public RPC, authenticated REST hoặc privileged REST thông thường. Parent lock serializes registration/completion; object upload và database khác transaction, orphan cleanup vẫn cần quản lý khi hạ tầng lỗi. DBA có quyền quản trị database vẫn là trusted boundary.

Task unique active(student,type), student row locks theo UUID order, unique event keys, version + replay. Kiểm double submission cùng session và hai session khác nhau đồng thời; private notes/contacts không leak vào timeline/UI hoặc actor khác.

Operational timestamps timestamptz; local day Asia/Bangkok, UTC17:00 boundary có unit + SQL regression. Deadline24h là instant duration; display/group theo UTC+7.

Mobile kiểm Chromium 320/390/430px, 25 students, focus với viewport height420 để mô phỏng keyboard, completion controls ≥44px; real iPhone/Safari hardware và human timing pilot chưa thực hiện. Popup user-gesture logic đã sửa và kiểm bằng browser, không tuyên bố native Safari đã test.

## Quality gate

Frozen npm ci, lint, strict typecheck, 8 unit tests, disposable PostgreSQL migrations/RLS matrix, 17 E2E real Auth/Storage, production build, full dependency audit, git diff --check và secret/artifact scan.

Final E2E chạy trên fresh gami-final-gate Docker project + volumes riêng; dữ liệu local gami-phase2 được giữ lại. Migrations001–005 không chỉnh. Kết quả gate cuối được xác nhận trong báo cáo PR; không dùng báo cáo Phase2 cũ làm bằng chứng.

Không hosted/staging deployment hoặc merge. Khuyến nghị code merge khi gate cuối PASS; rollout production vẫn cần staging/backup và pilot thực tế đã ghi trong PHASE_2.md.

Kết quả cuối: npm ci/lint/typecheck/unit8/DB-RLS/E2E17/build/audit/secret scan/diff check đều PASS; full+production audit0, không test skip. E2E fresh run 58,9s. PR#1 được cập nhật trên cùng branch, không merge.
