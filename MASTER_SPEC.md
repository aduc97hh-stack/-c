# GAMI OS - MASTER SPEC

## 1. Triết lý vận hành
- Mỗi dữ liệu chỉ nhập một lần.
- Dữ liệu học tập phải tự sinh công việc.
- Nhân viên mở app là biết hôm nay phải làm gì.
- Cô Gấm chỉ quản ngoại lệ, không đọc từng báo cáo.
- Zalo OA là kênh giao tiếp với phụ huynh.
- GAMI OS là bộ não nội bộ.
- Media Hub là nguồn nguyên liệu đã phân loại cho truyền thông.

## 2. Vai trò
### Admin / Cô Gấm
- Xem toàn bộ hệ thống.
- Phân công nhân sự.
- Xem dashboard ngoại lệ.
- Duyệt media được dùng truyền thông.
- Quản lý học phí, tái đăng ký, cấu hình.

### Giáo viên
- Xem lớp/lịch dạy của mình.
- Điểm danh.
- Đánh dấu BTVN, bài cũ, điểm kiểm tra.
- Ghi học sinh cần lưu ý.
- Upload ảnh/video.
- Hoàn thành buổi dạy.

### CSKH / Nhân viên
- Chỉ thấy nhóm học sinh được giao.
- Xem Mission Board.
- Xử lý việc: chưa BTVN, nghỉ học, PH cần CSKH, học phí, tái đăng ký.
- Ghi kết quả và ngày follow-up.

### Truyền thông
- Chỉ xem media đã được duyệt.
- Lọc theo ngày, lớp, chủ đề, loại nội dung.
- Tải file để dựng.
- Đánh dấu đã dùng/đã đăng.

## 3. Luồng cốt lõi
1. Giáo viên kết thúc buổi học.
2. Tick điểm danh, BTVN, bài cũ, học sinh cần lưu ý.
3. Upload media.
4. Bấm Hoàn thành buổi dạy.
5. Rule engine tự tạo task.
6. Nhân viên xử lý task.
7. Nếu cần giao tiếp PH -> dùng Zalo OA.
8. Kết quả được ghi lại vào Student 360.
9. Dashboard chỉ hiển thị ngoại lệ.

## 4. Student 360
Mỗi học sinh có:
- Họ tên, mã HS, ngày sinh.
- Lớp hiện tại.
- GV phụ trách.
- CSKH phụ trách.
- Phụ huynh và SĐT.
- Chuyên cần.
- BTVN.
- Điểm từ vựng/ngữ pháp.
- Thuyết trình.
- Ghi chú.
- Học sinh cần lưu ý.
- Lịch sử CSKH.
- Media theo thời gian.
- Học phí, số buổi còn lại.
- Trạng thái tái đăng ký.
- Quyền sử dụng hình ảnh truyền thông.

## 5. Auto Task
Ví dụ rule:
- Chưa BTVN -> task nhắc PH.
- 2 lần chưa BTVN trong 7 ngày -> task ưu tiên cao.
- Nghỉ học -> task hỏi thăm.
- Bài cũ dưới 5 -> task GV kiểm tra lại buổi sau.
- Còn 8 buổi -> task đánh giá tiến bộ.
- Còn 5 buổi -> task CSKH tái đăng ký.
- Quá hạn task 24h -> đẩy lên dashboard cô Gấm.

## 6. GAMI Pulse
Mỗi HS có trạng thái:
- Xanh: ổn.
- Vàng: cần chú ý.
- Đỏ: cần xử lý.

Không dùng AI để tự kết luận học lực. AI chỉ hỗ trợ tóm tắt/gợi ý sau này.

## 7. Media Hub
Metadata bắt buộc:
- Ngày.
- Lớp.
- HS liên quan.
- GV.
- Loại: speaking/classroom/progress/game/teacher/event.
- Chủ đề/Unit.
- Trạng thái duyệt.
- Quyền media của PH.
- Đã dùng truyền thông hay chưa.

Chỉ media có quyền sử dụng hợp lệ mới xuất hiện cho tài khoản truyền thông.

## 8. MVP v1
Phải có:
- Đăng nhập.
- Phân quyền.
- Students.
- Classes.
- Sessions.
- Session checkout.
- Tasks.
- Student 360.
- Media upload + Media Hub.
- Dashboard.
- Seed data demo.

Chưa làm ở v1:
- Thanh toán online.
- Chatbot.
- AI tự động.
- iOS native.
- Đồng bộ Zalo OA sâu.
