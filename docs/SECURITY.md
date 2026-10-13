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


## Dependency advisory hiện tại

Audit production (`npm audit --omit=dev`) không phát hiện lỗ hổng đã biết trong lần kiểm tra Phase 1. Audit đầy đủ báo một advisory high [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), được quy vào 5 package dev của chuỗi `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces` (stack exhaustion với brace pattern lồng sâu). Registry hiện trả braces 3.0.3; audit đánh dấu tất cả phiên bản, chưa có bản vá tương thích được xác nhận. Gợi ý `audit fix --force` hạ eslint-config-next xuống Next 14, không phù hợp stack Next 16.

Chuỗi này không nằm trong dependency production. Trong cấu hình hiện tại, không khai báo `settings.next.rootDir`; code Next plugin chỉ gọi fast-glob khi cấu hình rootDir string/array được cung cấp. Không truyền glob từ dữ liệu người dùng vào lint. Giữ cấu hình lint trong repository được kiểm soát, không nhận glob không tin cậy, và cập nhật khi upstream có bản vá. Đây là advisory còn tồn tại, **audit toàn bộ dependency chưa PASS**, không bị che bằng downgrade hoặc tắt rule.
