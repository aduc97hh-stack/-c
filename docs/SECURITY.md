# Bảo mật Phase 1

## Biện pháp đã triển khai

- Auth.getUser xác minh phiên phía server; role từ profiles đang active, không lấy từ client/localStorage/user metadata.
- RLS trên sáu bảng; default deny với anon, media tối thiểu, CSKH và teacher chỉ đọc đúng phân công. Profile không được tự sửa để tăng quyền.
- Parent contacts tách bảng; teacher không đọc được phone qua REST dù biết UUID học sinh.
- SECURITY DEFINER helper có search_path rỗng, chỉ auth.uid; private schema không nằm trong exposed API schemas.
- Bảo vệ route và Server Action; không dùng service role trong web app, không có demo bypass. Tài khoản disabled bị từ chối ngay cả khi còn session.
- Redirect đích cố định; không nhận URL tùy ý. Cookies Supabase SSR, refresh qua proxy; không lưu role trong localStorage.
- Dashboard dynamic/private no-store; không log PII/password/token. Lỗi giao diện chung; lỗi query không bị coi là danh sách rỗng thành công.
- Security headers chống sniffing/iframe, referrer same-origin, tắt quyền camera/microphone/geolocation chưa cần.
- .env gitignored; local seed dùng secret ngẫu nhiên, file 0600. CI không chứa credential thật.

## Giới hạn cần hiểu

RLS không áp dụng cho database owner hoặc service role: khóa service role chỉ được dùng trong provisioning/seed server-side đáng tin cậy. Không expose private schema trong API settings. Quản trị Supabase phải kiểm soát quyền SQL và audit thay đổi role. Profile provisioning không tự động; account Auth không có active profile không thể vào app. Admin seed chỉ được chạy ở project demo riêng.

Logout xóa session hiện tại; access token đã phát hành có thể còn hiệu lực đến khi hết hạn. Khi khóa nhân sự, đặt profiles.active=false để RLS từ chối ngay. Gỡ assignment trước khi đổi role; đổi role qua UI admin không cho khóa/đổi tài khoản admin để tránh mất quản trị ngoài ý muốn.

## Trước khi đưa dữ liệu trẻ em thật vào production

Cấu hình HTTPS, Auth site URL, tắt signup, chính sách password/rate-limit và MFA cho admin trong Supabase. Thiết lập backup/restore, retention, audit quản trị và xử lý sự cố theo nhu cầu vận hành. Không seed demo vào production. Không upload media hoặc tạo public bucket trong Phase 1; Phase 5 phải dùng private storage + signed URL cùng consent.

Không coi lint/build hay kiểm thử local là chứng nhận bảo mật hoặc xác nhận cấu hình hosted. Re-run auth/RLS smoke tests sau migration trên staging, dùng dữ liệu giả lập. Không in secret trong log hoặc báo cáo test; báo lỗi bằng code/ngữ cảnh không nhạy cảm.

## Dependency audit và bản thay thế an toàn

Phase 1 phát hiện advisory high [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) trong chuỗi lint `fast-glob → micromatch → braces`. Phase 2 thay riêng dependency `fast-glob` của `@next/eslint-plugin-next` bằng alias npm `tinyglobby@0.2.15`, không downgrade Next 16 hoặc tắt rule. Plugin chỉ dùng `globSync` cho rootDir; test kiểm directory-only, brace patterns, no match và thực thi rule `no-html-link-for-pages` với rootDir glob để xác nhận vẫn bắt lỗi navigation. Các đường dẫn relative/trailing slash của tinyglobby trỏ cùng thư mục khi consumer dùng path.join/fs.

Frozen lockfile lưu bản thay thế. Audit đầy đủ và production hiện đều không có advisory. Đây là kết quả tại thời điểm kiểm tra, không thay thế việc theo dõi dependency sau rollout.

## Phase 2 security boundary

Xem PHASE_2.md: tất cả bảng mới RLS, chỉ RPC được mutate, completed immutable, optimistic version + row lock/unique keys, SQL fail-closed kể cả role NULL/inactive. CSKH không nhận private notes; media/CSKH không ký URL attachment.

Ngoại lệ service-role: `src/server/storage.ts` dùng key server-only cho byte-validated upload/orphan cleanup sau khi kiểm active profile/session/teacher owner. Không dùng service role cho đọc nghiệp vụ, xác minh role hay signed download. Authenticated không có Storage insert/update policy, nên gọi trực tiếp SDK không bypass file validation. File path sinh server, giới hạn stream/body, magic bytes + size checks; metadata RPC đối chiếu trusted uploaded_by/size/MIME. URL signed 60 giây là capability ngắn hạn, có thể dùng đến hết TTL, không bảo đảm revoke tức thì. Không public bucket, không marketing consent tự động.

## Final gate trước merge Phase 2

Session identity RPC chỉ trả id/name/code cho roster snapshot của session được phép đọc, không mở rộng students/contact RLS. Student academic history RPC trả id/status/starts_at, không cấp quyền notes/attachment cho giáo viên lớp mới. Completed history có DB triggers và parent row locks, kể cả request privileged REST thông thường. Owner validity dùng chung RLS + mutation + admin exception; multiple active CSKH owners fail closed.

Signed Storage URLs được giữ ở server. Download stream kiểm caller RLS và trả private/no-store; không phụ thuộc cache headers của upstream. Nội dung blob không đổi; migration007 harden cache metadata của legacy objects. Upload validation vẫn chỉ server, service credential không vào client. Test race dùng parent-lock barrier thực sự, không dựa vào xác suất chạy hai request.
