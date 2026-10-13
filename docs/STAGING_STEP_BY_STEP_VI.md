# Đưa GAMI OS lên môi trường thử nghiệm, từng bước một

Tài liệu dành cho chủ trung tâm. “Staging” là bản thử nghiệm riêng, không phải hệ thống đang dùng với học sinh thật. Chỉ dùng dữ liệu giả cho đến khi tất cả bài kiểm tra bên dưới đạt.

PR #3 đã được kiểm tra và gộp vào nhánh chính. Mã nhánh chính sau khi gộp: `20f73a62fc43cca0766b0a5f218d3575f7dcebd1`. Hướng dẫn và công cụ nạp dữ liệu an toàn mới nằm trên nhánh `chore/staging-execution-plan`, được gửi qua PR riêng để xem xét; không tự gộp PR này.

## Cách làm để không bị rối

**Việc đầu tiên duy nhất: tạo một dự án Supabase tên GAMI OS STAGING theo bước A.** Chưa lấy key, chưa tạo hosting và chưa nạp dữ liệu ở bước này.

Các bước được chia A–M để tra cứu. Thứ tự thực tế: **A → B → C → D → F → G → H → I → E → J → K → L → M**. Bước E cần địa chỉ HTTPS do hosting cấp ở bước I, nên không điền domain đoán trước. Những phần dòng lệnh, migration và phục hồi có ghi “người hỗ trợ kỹ thuật”; chủ trung tâm kiểm tra kết quả, không cần tự viết chương trình.

Không gửi mật khẩu, service role key, chuỗi kết nối database hoặc toàn bộ file môi trường vào chat. Không chụp màn hình có key, mật khẩu, mã QR bảo mật, thông tin phụ huynh hay đường dẫn file có token. Khi cần kiểm, chỉ chụp tên dự án, trạng thái hoặc thông báo đã che thông tin bí mật. Tên nút có thể thay đổi theo giao diện nhà cung cấp; nếu không thấy đúng mục, dừng ở đó để người hỗ trợ hướng dẫn, không bấm sang project khác.

## A. Tạo dự án Supabase thử nghiệm

- **Vào đâu:** [Supabase Dashboard](https://supabase.com/dashboard), đăng nhập tài khoản của trung tâm.
- **Bấm gì:** chọn tổ chức của trung tâm → **New project**.
- **Nhập gì:** tên `GAMI OS STAGING`; chọn vùng gần người dùng Việt Nam, ví dụ Singapore nếu có. Chọn gói phù hợp ngân sách; có thể bắt đầu gói miễn phí để thử, nhưng phải đánh giá backup trước pilot.
- **Giữ bí mật:** tạo mật khẩu database dài, ngẫu nhiên và lưu trong trình quản lý mật khẩu. Không dùng mật khẩu đăng nhập Supabase làm mật khẩu database.
- **Khi chụp:** sau khi project tạo xong, chụp trang tổng quan chỉ có tên/trạng thái; không chụp biểu mẫu chứa mật khẩu.
- **Thành công:** thấy project `GAMI OS STAGING` hoạt động, không còn trạng thái đang khởi tạo.
- **Lỗi hay gặp:** sai tổ chức, hết hạn mức project hoặc chọn nhầm production. Dừng nếu tên/project không đúng; không xóa project có dữ liệu để lấy chỗ.

## B. Lấy thông tin kết nối, cất đúng chỗ

- **Vào đâu:** project vừa tạo → **Connect** hoặc **Project Settings → API / API Keys**.
- **Bấm gì:** sao chép từng thông tin vào nơi lưu an toàn, không vào chat.
- **Cần lấy:**

| Thông tin trên Supabase | Tên biến dùng cho Gami | Cất ở đâu |
| --- | --- | --- |
| Project URL, dạng HTTPS | `NEXT_PUBLIC_SUPABASE_URL` | Biến môi trường của hosting |
| anon/public key hoặc publishable key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Biến môi trường của hosting |
| service_role key hoặc secret key tương ứng | `SUPABASE_SERVICE_ROLE_KEY` | Biến bí mật phía server của hosting; không thêm tiền tố NEXT_PUBLIC |
| Project ref, mã dự án trong địa chỉ dashboard | `SUPABASE_PROJECT_REF` | Hồ sơ triển khai và biến môi trường |
| Quyền quản lý/migration, mật khẩu database khi công cụ yêu cầu | Không phải key chạy trong trình duyệt | Người hỗ trợ kỹ thuật, trình quản lý mật khẩu hoặc cơ chế đăng nhập CLI an toàn |

- **Giữ bí mật:** service role/secret key, mật khẩu database và token đăng nhập CLI. Key có chữ “anon/public” không được thay bằng service role key.
- **Khi chụp:** chỉ phần Project URL/project ref hoặc màn hình đã che toàn bộ key. Tuyệt đối không chụp key đã mở nút **Reveal**.
- **Thành công:** người hỗ trợ xác nhận URL và project ref cùng một dự án staging; các key được lưu vào biến môi trường hosting hoặc file môi trường cục bộ được bảo vệ, ngoài Git.
- **Lỗi hay gặp:** lấy key của project khác, gửi key vào tin nhắn, lưu file vào repository. Nếu lộ key bí mật, dừng và nhờ người hỗ trợ thu hồi/đổi key theo nhà cung cấp.

## C. Nạp cấu trúc database bằng migrations 001–011

**Người hỗ trợ kỹ thuật thực hiện phần này.** Không dán các file trong `tests/` hoặc `scripts/local/` vào SQL Editor hosted; chúng giả lập Auth/Storage cho test, không dùng cho Supabase thật.

- **Vào đâu:** project staging → **Project Settings** để xác nhận project ref; trên máy hỗ trợ mở repository trong trình soạn thảo → **Terminal → New Terminal**.
- **Bấm/nhập gì:** dùng Node24 và Supabase CLI cố định `2.120.0`; đã kiểm tra phiên bản và tùy chọn dry-run trong workspace. Người hỗ trợ chạy các dòng sau, đăng nhập qua trình duyệt/cơ chế CLI an toàn rồi liên kết đúng project:

```bash
npx --yes supabase@2.120.0 --version
npx --yes supabase@2.120.0 login
npx --yes supabase@2.120.0 link --project-ref <mã-project-staging>
npx --yes supabase@2.120.0 migration list
npx --yes supabase@2.120.0 db push --linked --skip-vault --dry-run
```

`<mã-project-staging>` phải thay bằng project ref từ B, không phải mật khẩu. Đăng nhập và mật khẩu nhập qua cơ chế an toàn; không gắn mật khẩu/token vào dòng lệnh hoặc ảnh chụp. Kiểm tra nguồn SQL là toàn bộ 11 file trong `supabase/migrations/` trên nhánh chính đã gộp, theo tên tăng dần. Người hỗ trợ kiểm tra bản sao/điểm phục hồi nếu project đã có dữ liệu, rồi mới chạy:

```bash
npx --yes supabase@2.120.0 db push --linked --skip-vault
npx --yes supabase@2.120.0 migration list
```

- **Giữ bí mật:** quyền CLI/database như ở B. Không cần đưa service role key vào SQL.
- **Khi chụp:** danh sách phiên bản migration và thông báo thành công, đã che chuỗi kết nối/tài khoản nhạy cảm.
- **Thành công:** database có đủ phiên bản 001–011 theo các tên file ngày giờ đầy đủ; không có migration còn chờ. Project mới chạy từ 001 đến 011. Project đã ở main hiện tại thì dry-run phải không có SQL mới.
- **Lỗi hay gặp:** sai project, thiếu quyền trên schema Storage hoặc chạy lại SQL thủ công gây “already exists”. Dừng và kiểm tra lịch sử; không bỏ lỗi, không sửa migration lịch sử, không đánh dấu đã chạy một file chưa thực sự chạy. Không dùng lệnh reset với project có dữ liệu.

`--skip-vault` giữ bước này chỉ xử lý migrations, không cập nhật Vault từ cấu hình local. Không thêm `--include-seed` hoặc `--include-roles`. Nếu CLI báo không ghi được thư mục cấu hình, người hỗ trợ đặt `SUPABASE_HOME` vào thư mục riêng được bảo vệ, có quyền ghi; không sửa/bỏ kiểm TLS. CLI chạy được tại local không có nghĩa đã chạy dry-run vào hosted.

## D. Kiểm tra bucket lưu file riêng tư

- **Vào đâu:** Supabase staging → **Storage** → bucket `session-attachments`.
- **Bấm gì:** mở cấu hình bucket. Migration 002 đã tạo bucket; bước này xác minh, không tạo thêm bucket trùng tên.
- **Cần thấy:** bucket **Private**, không bật **Public**; giới hạn database `41943040` byte; loại file JPEG, PNG, WEBP, MP4. App giới hạn ảnh 10 MiB, video 40 MiB. Nếu không thấy bucket, quay lại kiểm tra bước C với người hỗ trợ, không tạo bucket public để chữa lỗi.
- **Giữ bí mật:** không tạo/chia sẻ đường dẫn signed URL. Không thêm policy cho phép mọi người ghi/đọc file.
- **Khi chụp:** cấu hình private và dung lượng; không chụp URL có token.
- **Thành công:** file chỉ upload qua app đã kiểm quyền; CSKH và giáo viên lớp khác không đọc attachment. Bài kiểm tra thật ở K.
- **Lỗi hay gặp:** bucket public, giới hạn hosting nhỏ hơn giới hạn bucket hoặc tự thêm policy ghi trực tiếp từ trình duyệt. Dừng và sửa cấu hình có người hỗ trợ kiểm.

## E. Cấu hình địa chỉ đăng nhập — làm sau I

- **Vào đâu:** Supabase staging → **Authentication → URL Configuration**.
- **Bấm gì:** sửa **Site URL** và **Redirect URLs** → **Save**.
- **Nhập gì:** Site URL là đúng địa chỉ HTTPS thật từ I, không thêm đường dẫn dashboard. Chỉ cho phép địa chỉ chuyển hướng cụ thể đã được người hỗ trợ xác nhận; không thêm wildcard, localhost hay domain production. Đăng nhập mật khẩu hiện tại không có OAuth/reset cần thêm callback tùy ý.
- **Vào thêm:** **Authentication → Sign In / Providers → Email**, tắt public signup; tài khoản thử được người quản trị tạo rõ ràng.
- **Giữ bí mật:** trang này không cần dán service role key.
- **Khi chụp:** Site URL/allowlist và trạng thái signup, không chụp thông tin đăng nhập người dùng.
- **Thành công:** đăng nhập tại HTTPS ở I về đúng dashboard theo role, không nhảy về localhost hoặc domain khác.
- **Lỗi hay gặp:** nhập domain dự đoán, wildcard preview hoặc sao chép cấu hình local. Chỉ dùng URL hosting đã thực sự cấp.

## F. Nạp đúng bộ dữ liệu giả lập tối thiểu

- **Người hỗ trợ thực hiện:** từ nhánh `chore/staging-execution-plan`, dùng `scripts/seed-staging.mjs`, không dùng seed demo cũ cho hosted. Hai seed cũ chỉ được phép chạy local.
- **Vào đâu:** máy hỗ trợ → trình quản lý mật khẩu/file môi trường an toàn ngoài repository; Supabase → **Authentication → Users** và **Table Editor** để xem kết quả.
- **Nhập gì:** URL và service key của staging; `GAMI_DEPLOY_ENVIRONMENT=staging`, `SUPABASE_PROJECT_REF` và `GAMI_STAGING_PROJECT_REF` cùng đúng ref ở B; `GAMI_ALLOW_DEMO_SEED=yes`. Tạo ba mật khẩu riêng, ít nhất 16 ký tự: `GAMI_STAGING_ADMIN_PASSWORD`, `GAMI_STAGING_TEACHER_PASSWORD`, `GAMI_STAGING_CSKH_PASSWORD`.
- **Chạy kiểm trước, rồi mới nạp:** đường dẫn file bên dưới là file được bảo vệ do người hỗ trợ tạo, không phải file nằm trong Git.

```bash
node --env-file=<file-môi-trường-an-toàn> scripts/seed-staging.mjs --dry-run
node --env-file=<file-môi-trường-an-toàn> scripts/seed-staging.mjs
```

| Tài khoản giả lập | Quyền |
| --- | --- |
| `staging.admin@gami.example` | Admin |
| `staging.teacher@gami.example` | Teacher |
| `staging.cskh@gami.example` | CSKH |

Lớp: `GAMI STAGING — 15 HS giả lập`; mã học sinh `STG-001` đến `STG-015`. Giáo viên được phân công lớp, CSKH được phân công cả 15 học sinh. Không dùng tên/số điện thoại học sinh hoặc phụ huynh thật. Địa chỉ email giả được tạo/confirm bằng quyền quản trị, không chờ nhận email thật.

- **Giữ bí mật:** ba mật khẩu và service key chỉ ở nơi lưu an toàn; không in log. Không đưa các biến password/cho phép seed vào hosting web. Sau nạp, bỏ quyền seed khỏi môi trường provisioning.
- **Khi chụp:** số tài khoản, tên lớp và mã học sinh giả; không chụp mật khẩu/key.
- **Thành công:** đúng 3 tài khoản có profile active/role tương ứng, 1 lớp và 15 học sinh với đúng assignment. Chạy lại không tạo bản sao và không đổi mật khẩu/lịch sử cũ.
- **Lỗi hay gặp:** thiếu allowlist, môi trường production hoặc password yếu/trùng nhau: script phải chặn trước khi ghi. Nếu role/assignment cũ xung đột, cần người hỗ trợ xử lý; không tự ghi đè. Guard không thay thế việc con người xác minh project thật là staging.

Chỉ chạy một cửa sổ nạp tại một thời điểm. Nếu dừng giữa chừng vì mất mạng, giữ nguyên dữ liệu, kiểm lỗi rồi chạy lại cùng cấu hình; không xóa tài khoản hoặc reset project để làm lại.

## G. Tạo hosting project

**Khuyến nghị: Render dạng Node Web Service**, giữ nguyên Next.js. Không chọn Static Site. Với Vercel, giới hạn body của Functions nhỏ hơn upload video 40 MiB hiện tại; chỉnh Next thành 41mb không nâng được giới hạn provider. Vì vậy không dùng Vercel làm staging đầy đủ trước khi giải quyết blocker này. [Tài liệu giới hạn Vercel](https://vercel.com/docs/functions/limitations#request-body-size).

- **Vào đâu:** [Render Dashboard](https://dashboard.render.com/) → **New → Web Service** → kết nối GitHub của trung tâm.
- **Chọn gì:** repository `aduc97hh-stack/-c`, branch `main`, runtime Node, tên gợi nhớ `gami-os-staging`. Người hỗ trợ bảo đảm Node24. Build command `npm ci && npm run build`; start command `npm start -- --hostname 0.0.0.0 --port $PORT`.
- **Gói hosting:** lựa chọn phù hợp ngân sách. Gói ngủ khi không dùng có thể thử chức năng nhưng không nên dùng đo tốc độ pilot; người dùng quyết định chi phí. Cần kiểm upload gần 40 MiB và streaming thực tế trước khi chấp nhận hosting.
- **Giữ bí mật:** chỉ cấp quyền GitHub cho repository cần dùng; không dán service key vào command. Không chọn deployment production đang tồn tại.
- **Khi chụp:** tên service/repository/branch và command, không chụp biến môi trường.
- **Thành công:** có service staging riêng; hosting sẽ cấp URL ở I.
- **Lỗi hay gặp:** chọn Static Site, sai repo/branch, start không nhận `$PORT`, runtime Node quá cũ. Hosting có thể bắt đầu deploy ngay sau khi tạo; chưa coi đó là smoke PASS nếu chưa xong H và E.

## H. Gắn biến môi trường cho hosting

- **Vào đâu:** service Render → **Environment → Add Environment Variable** hoặc thêm trong biểu mẫu tạo service.
- **Nhập:** URL/public key/service key lấy từ B; `GAMI_DEPLOY_ENVIRONMENT=staging`, `SUPABASE_PROJECT_REF` đúng ref, `GAMI_ALLOW_DEMO_SEED=no`; đặt `NODE_VERSION=24` theo cấu hình Node của Render. Sau khi I cấp URL, đặt `GAMI_APP_URL` bằng đúng HTTPS origin đó. Không đoán domain để vượt preflight.
- **Không đưa vào web:** `GAMI_SEED_PASSWORD`, ba biến password ở F, `GAMI_STAGING_PROJECT_REF` và cờ cho phép seed `yes`. Bật tùy chọn secret của hosting cho service key nếu có; giới hạn người được xem/sửa.
- **Bấm gì:** **Save / Save, rebuild and deploy** theo giao diện. Khi đổi NEXT_PUBLIC phải rebuild, không chỉ restart.
- **Khi chụp:** chỉ tên biến và trạng thái đã có giá trị, mọi giá trị key/password phải được che.
- **Thành công:** biến staging tách riêng production; người hỗ trợ chạy `node scripts/check-deployment.mjs` từ bản công cụ đã kiểm tra với cùng bindings. Chỉ chấp nhận PASS sau khi URL thật đã có. Công cụ này chỉ kiểm metadata, không chứng minh key hợp lệ hoặc RLS đúng; vẫn phải kiểm K.
- **Lỗi hay gặp:** service key bị đặt vào biến NEXT_PUBLIC, key/URL từ hai project khác nhau hoặc mang bundle staging sang production. Công cụ preflight phải báo lỗi rõ; không bỏ qua để deploy.

## I. Deploy HTTPS

- **Vào đâu:** service Render → **Manual Deploy → Deploy latest commit**, xem **Events / Logs**.
- **Nhập gì:** không cần domain cố định trong code. Sao chép URL HTTPS mà Render thực sự cấp; nếu đổi domain riêng, người hỗ trợ làm chứng chỉ/DNS và cập nhật E/H.
- **Giữ bí mật:** không bật debug in request body, cookie hay Authorization. Log không được chứa key, mật khẩu, ghi chú riêng, số điện thoại hoặc signed URL.
- **Khi chụp:** trạng thái **Live**, URL và commit triển khai; che log nhạy cảm nếu có.
- **Thành công:** URL HTTPS mở trang đăng nhập. Mở `<URL-HTTPS>/api/health` thấy `{"status":"ok"}`; người hỗ trợ kiểm HTTP200 và `private, no-store`. Khi thiếu dependency, HTTP503 `unavailable` là báo lỗi đúng, không phải PASS. Health chỉ chứng minh kết nối, không chứng minh toàn bộ quyền truy cập.
- **Tiếp theo trong tài liệu:** cập nhật `GAMI_APP_URL` ở H, hoàn thành E, chạy preflight rồi mới smoke K.
- **Lỗi hay gặp:** HTTP502 do sai port/start command, HTTP503 do sai binding/dependency, upload nhỏ thành công nhưng video lớn thất bại. Không coi deploy xanh là đã đủ cho pilot.

## J. Bật lịch chạy operations tự động

- **Vào đâu:** Supabase staging → **Integrations / Cron**; người hỗ trợ bật Cron/pg_cron nếu gói dự án hỗ trợ.
- **Bấm/nhập:** người hỗ trợ kiểm chưa có job `gami-operations`, rồi vào **SQL Editor → New query → Run** đoạn sau:

```sql
select cron.schedule('gami-operations', '*/10 * * * *',
  $$select private.run_operations(now());$$);
```

- **Cần thấy:** job chạy mỗi 10 phút. Chỉ người vận hành tin cậy được quản lý job. Không tạo endpoint HTTP public không có xác thực; phương án này không cần một “cron secret” gửi qua trình duyệt.
- **Giữ bí mật:** không dán service key vào SQL job. Nếu provider không hỗ trợ Cron, người hỗ trợ dùng runner server riêng với key lưu secret, không đưa vào URL.
- **Khi chụp:** tên job, lịch và kết quả chạy, không chụp credential/log chứa dữ liệu cá nhân.
- **Thành công:** quan sát hai lần chạy thành công, chạy tay thêm lần nữa không trùng session/notification; người nhận cảnh báo được kiểm khi job lỗi hoặc quá 30 phút không thành công.
- **Lỗi hay gặp:** Cron chưa bật, tạo nhiều job, chỉ thấy lịch mà chưa có lần chạy. Lần sau 10 phút tự retry; việc replay an toàn nhờ transaction/lock/unique key. Không tự tăng tần suất để chữa lỗi.

## K. Kiểm thử staging qua ba vai trò

Chỉ dùng tài khoản/học sinh giả ở F. Mỗi dòng ghi người thử, ngày giờ UTC+7, mã bản deploy và ĐẠT/KHÔNG ĐẠT/CHƯA CHẠY. Không dùng suite E2E local để ghi trực tiếp vào hosted.

Để thử màn “Hôm nay”, admin chọn lịch có buổi **hôm nay**, giờ bắt đầu sau giờ hiện tại và không trùng lịch khác; buổi quá giờ tạo lịch có thể bị bỏ qua. Dùng múi giờ UTC+7. Không tạo buổi ngày mai rồi coi việc “Hôm nay” chưa thấy lớp là lỗi.

| Ai | Thao tác cần đạt |
| --- | --- |
| Admin | Đăng nhập; mở operations; chọn pair lớp/teacher ở F, bật PILOT_MODE; tạo lịch lặp và tạo session; chạy lại không trùng |
| Teacher | Đăng nhập; thấy lớp ở Hôm nay; bắt đầu session; thấy 15 học sinh snapshot; đánh một học sinh thiếu BTVN, lưu draft, xem trạng thái đã lưu |
| Teacher | Upload ảnh hợp lệ ≤10 MiB; MP4 hợp lệ, gồm một video gần40 MiB; xem file riêng tư; file quá lớn/sai định dạng bị từ chối |
| Teacher | Hoàn tất/confirm một lần; không sửa bản gốc đã completed; gửi correction đổi BTVN thiếu→đủ kèm lý do |
| CSKH | Đăng nhập; nhận task do BTVN thiếu; mở/cập nhật task, xem notification; không đọc private teacher note hoặc attachment |
| Admin | Duyệt correction; đối chiếu Student360 và task được reconcile; xem audit và notification đúng người; teacher không tự duyệt |
| Admin | Xem escalation bằng session/task giả quá hạn do người hỗ trợ tạo qua quyền hợp lệ; chạy engine hai lần không spam; không sửa đồng hồ production |
| Admin | Xem số mẫu, median/P90 và lỗi save trong operations; không sửa/tỉa số liệu chậm để đẹp báo cáo |
| Người hỗ trợ | Kiểm foreign notification, giáo viên khác lớp, public bucket/direct SDK write, inactive account, redirect ngoài domain và no-store bị chặn/đúng policy |

- **Vào đâu/bấm:** mở HTTPS app, dùng các dashboard/menu “Hôm nay”, “Vận hành”, “Thông báo”, task và correction theo vai trò. Admin dùng `/admin/operations`, `/admin/schedules`, `/admin/corrections`, `/admin/audit`.
- **Giữ bí mật:** mật khẩu chỉ người được phân công giữ; không lưu service key trong trình duyệt.
- **Khi chụp:** thông báo thành công với dữ liệu giả, đã che URL có token và thông tin riêng. Không chụp tab Network có headers xác thực.
- **Thành công:** tất cả dòng ĐẠT, đặc biệt upload gần40 MiB qua đúng host và các thử truy cập trái quyền đều bị chặn.
- **Lỗi hay gặp:** Auth login được nhưng profile/assignment thiếu, task chưa có đúng một owner, pair pilot chưa chọn, video bị host chặn. Dừng pilot, ghi lỗi và để người hỗ trợ sửa; chưa dùng dữ liệu thật.

## L. Diễn tập backup và phục hồi thật

- **Ai/vào đâu:** chỉ định người phụ trách restore và người dự phòng; mở mục backup của Supabase và nơi backup file riêng tư của trung tâm. Làm theo `docs/BACKUP_RECOVERY.md` với người hỗ trợ kỹ thuật.
- **Thực hiện:** tạo điểm backup DB thật; sao chép riêng file private kèm checksum vào nơi mã hóa; ghi thời điểm. Restore vào project thử phục hồi riêng, giữ project gốc. Kiểm Auth UUID/login, profile/assignment, completed records/corrections/audit và byte ảnh/video; kiểm lại quyền và scheduler replay.
- **Giữ bí mật:** file backup chứa dữ liệu/mật khẩu băm cũng là bí mật. Không tải lên Git, chat hay CI artifact; không backup bằng danh sách signed URL.
- **Khi chụp:** ngày điểm backup, trạng thái restore và kết quả đã che dữ liệu. Chỉ ghi thời gian phục hồi/độ mất dữ liệu thực đo; không chụp credential.
- **Thành công:** restore sử dụng được, dữ liệu/file/quyền khớp, có kết quả RPO/RTO đo thật. Mục tiêu ban đầu mất tối đa24 giờ dữ liệu, phục hồi trong4 giờ; chưa đo thì chưa được nói đã bảo đảm.
- **Lỗi hay gặp:** DB backup không chứa byte Storage, đổi UUID tài khoản, dùng key của project cũ, không có quyền restore của gói hiện tại. Những lỗi này chặn pilot; backup local synthetic trước đây không thay thế diễn tập cloud.

## M. Thử Safari/iPhone và một tuần pilot

- **Ai/vào đâu:** 1–2 giáo viên dùng Safari trên iPhone thật tại HTTPS staging; chỉ sau K và L đạt mới xin duyệt dùng dữ liệu thật. Mở `docs/PILOT_RUNBOOK.md` cùng admin.
- **Bấm/thử:** đăng nhập; Share → **Add to Home Screen**; mở icon ở chế độ standalone. Checkout15–25 học sinh, bàn phím điểm/ghi chú, upload ảnh/video, mất mạng rồi Thử lại, inbox và correction. Kiểm portrait/landscape, safe-area, không overflow hoặc footer che nội dung.
- **Nhập/gìn giữ:** ghi loại máy/iOS/ngày/người thử, kết quả và lỗi. Không gửi tên học sinh thật, số PH, mật khẩu hoặc signed URL trong báo lỗi.
- **Khi chụp:** giao diện với học sinh giả và lỗi đã che bí mật; không giả định Chromium PASS có nghĩa Safari PASS.
- **Thành công:** checklist iPhone thực tế đạt; onboarding giáo viên10 phút; 1–2 lớp khoảng15–30 HS/lớp thử1 tuần có admin theo dõi. Admin xem median/P90 của mẫu thật; chưa có mẫu thì không kết luận tốc độ đạt90 giây.
- **Khi có lỗi nghiêm trọng:** dừng cron, giữ PILOT_MODE ON và gỡ các pair, chặn truy cập bị ảnh hưởng nếu cần. OFF là mở rộng phạm vi, không phải nút dừng. Giữ nguyên lịch sử/audit, xử lý theo người phụ trách; không quay về app Phase2 bỏ qua correction đã duyệt.

## Trạng thái hiện tại

Đã chuẩn bị hướng dẫn, seed có guard và preflight kiểm metadata. Chưa có hosted project/credential/HTTPS, job Cron, backup cloud hoặc Safari thật được xác minh. Không có bước nào ở đây được đánh dấu đã chạy trên cloud chỉ vì local/CI PASS.

**Bạn chỉ làm bước A trước.** Sau đó có thể xác nhận tên dự án/trạng thái sẵn sàng hoặc gửi ảnh tổng quan đã che bí mật; không gửi key. Các bước còn lại thực hiện lần lượt khi đến lượt, không cần làm cùng lúc.
