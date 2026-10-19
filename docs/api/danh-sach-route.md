# DANH SÁCH ROUTE — SINH RA, ĐỪNG GÕ TAY

<!-- Sinh bằng `npm run route:ghi`. Sửa tay là mất ở lần sinh sau. -->

> Nguồn chân lý là **chính app đang chạy**: tệp này dựng `createApp()` rồi hỏi
> `app.routes`, không đọc mã bằng regex. Thêm route mà quên chạy `route:ghi`
> ⇒ `tests/route_danh_sach.test.ts` đỏ (khuôn `nk:index`, D203).

**148** route · **6** lớp middleware theo tiền tố.

## Middleware theo tiền tố

Chạy TRƯỚC mọi route khớp tiền tố, kể cả route thêm sau này.

| tiền tố | middleware |
|---|---|
| `/*` | _(ẩn danh)_ |
| `/admin` | `cuaNgoaiAdmin` |
| `/admin/*` | `cuaNgoaiAdmin` |
| `/api/*` | `congProxy` → `tranBody` → `cors` → `chanGhiCheoTrang` |
| `/api/v1/admin/*` | `cuaNgoaiAdmin` |
| `/api/v1/holdem/matches/:id/rounds` | _(ẩn danh)_ |

## Route theo miền

### account — 5 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/account/consent` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/account/delete` | `requireAuth` |  |
| GET | `/api/v1/account/du-lieu` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/account/du-lieu/xuat` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/account/password` | `requireAuth` |  |

### admin — 47 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/admin` | `requireAuthPage` + `requireOnboardedPage` |  |
| POST | `/api/v1/admin/2fa/ghi-danh` | `requireAuth` + `requireOnboarded` + `chiAdmin` |  |
| POST | `/api/v1/admin/2fa/mo-khoa` | `requireAuth` + `requireOnboarded` + `chiAdmin` |  |
| GET | `/api/v1/admin/2fa/trang-thai` | `requireAuth` + `requireOnboarded` + `chiAdmin` |  |
| POST | `/api/v1/admin/2fa/xac-nhan` | `requireAuth` + `requireOnboarded` + `chiAdmin` |  |
| POST | `/api/v1/admin/2fa/xac-thuc-lai` | `requireAuth` + `requireOnboarded` + `chiAdmin` |  |
| POST | `/api/v1/admin/avatar/an` | `requireAuth` + `requireOnboarded` + `requireAdmin` | admin gọi tay |
| POST | `/api/v1/admin/avatar/tang` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` | admin gọi tay |
| GET | `/api/v1/admin/bao-loi` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/dashboard` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/dot-thu` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/keo` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/keo/:id/hen-gio` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` |  |
| POST | `/api/v1/admin/keo/:id/sua` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/keo/:id/xem-truoc` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/keo/hang-loat` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/kho/bang` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/kho/bang/:ten` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/kinh-te` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/markets` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| DELETE | `/api/v1/admin/markets/:id` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` |  |
| POST | `/api/v1/admin/markets/:id/cancel` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` |  |
| POST | `/api/v1/admin/markets/:id/open` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` |  |
| GET | `/api/v1/admin/markets/:id/options` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/markets/:id/preview-resolve` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/markets/:id/resolve` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireXacThucLai` |  |
| GET | `/api/v1/admin/pending` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/pt/nguoi` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/pt/nguoi/:handle` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/pt/phan-khuc` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/pt/phan-khuc` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/pt/phan-khuc/:id/xoa` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/pt/phan-khuc/chia` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/pt/phan-khuc/tinh` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/pt/tong-quan` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/quyen` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/quyen` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/suat-tran` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| POST | `/api/v1/admin/tester/dat-lai` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireTester` + `requireXacThucLai` | admin gọi tay |
| POST | `/api/v1/admin/tester/mo-khoa` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireTester` + `requireXacThucLai` | admin gọi tay |
| POST | `/api/v1/admin/tester/token` | `requireAuth` + `requireOnboarded` + `requireAdmin` + `requireTester` + `requireXacThucLai` | admin gọi tay |
| GET | `/api/v1/admin/tk/hanh-trinh` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/tk/keo` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/tk/phien-ban` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/tk/tinh-cach` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/tk/tong-quan` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |
| GET | `/api/v1/admin/tk/tran` | `requireAuth` + `requireOnboarded` + `requireAdmin` |  |

### auth — 10 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/auth/discord/go` | `requireAuth` | chờ giao diện |
| POST | `/api/v1/auth/discord/token` | _không_ |  |
| POST | `/api/v1/auth/forgot-password` | _không_ |  |
| POST | `/api/v1/auth/khach` | _không_ |  |
| POST | `/api/v1/auth/login` | _không_ |  |
| POST | `/api/v1/auth/logout` | _không_ |  |
| GET | `/api/v1/auth/me` | `requireAuth` |  |
| POST | `/api/v1/auth/register` | _không_ |  |
| POST | `/api/v1/auth/reset-password` | _không_ |  |
| POST | `/api/v1/auth/verify-email` | _không_ |  |

### avatar — 6 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/avatar/catalog` | _không_ |  |
| POST | `/api/v1/avatar/dan` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/avatar/goc` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/avatar/khung` | `requireAuth` + `requireOnboarded` | chờ giao diện |
| POST | `/api/v1/avatar/mac` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/avatar/me` | `requireAuth` + `requireOnboarded` |  |

### bao-loi — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/bao-loi` | `requireAuth` + `requireOnboarded` |  |

### boards — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/boards/forecast` | `requireAuth` + `requireOnboarded` |  |

### bxh — 2 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/bxh/dau-truong` | `requireAuth` | chờ bật cờ |
| POST | `/api/v1/bxh/lam-moi` | `requireAuth` | chờ bật cờ |

### canh — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/canh` | _không_ |  |

### cho — 4 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/cho/ban` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/cho/cua-toi` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/cho/mua` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/cho/quay` | `requireAuth` + `requireOnboarded` |  |

### health — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/health` | _không_ |  |

### holdem — 33 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/holdem/art` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/ban` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/ban-buoi-do` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/ban/:ma` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/ban/:ma/dong` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/ban/:ma/dong-y` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/ban/:ma/nhom` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/ban/:ma/rut-dong-y` | `requireAuth` + `requireOnboarded` | hứa, thiếu nút |
| POST | `/api/v1/holdem/buoi-do/buoc` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/canh-bao-xung-dot` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/catalog` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/matches` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/matches/:id` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/matches/:id/autopsy` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/matches/:id/bang-dien-tu` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/matches/:id/khop-lenh` | `requireAuth` + `requireOnboarded` | giữ cho bản cũ |
| POST | `/api/v1/holdem/matches/:id/minigame` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/matches/:id/minigame/:vong/ket-qua` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/matches/:id/minigame/:vong/lenh` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/matches/:id/minigame/:vong/nhip` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/holdem/matches/:id/rounds` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/matches/:id/shop` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/matches` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/nang-luc` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/so-tay` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/tien-do` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/tin-hieu` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/me/tinh-cach` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/holdem/ngay` | `requireAuth` + `requireOnboarded` |  |
| DELETE | `/api/v1/holdem/rank/suat` | `requireAuth` + `requireOnboarded` | chờ bật cờ |
| POST | `/api/v1/holdem/rank/suat` | `requireAuth` + `requireOnboarded` | chờ bật cờ |
| GET | `/api/v1/holdem/rank/suat/me` | `requireAuth` + `requireOnboarded` | chờ bật cờ |
| POST | `/api/v1/holdem/rank/vao` | `requireAuth` + `requireOnboarded` | chờ bật cờ |

### internal — 2 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/internal/backup` | `requireSecret` | máy gọi |
| POST | `/api/v1/internal/tick` | `requireSecret` | máy gọi |

### loi-client — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/loi-client` | _không_ |  |

### markets — 4 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/markets` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/markets/:id` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/markets/:id/bets` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/markets/:id/pool` | `requireAuth` + `requireOnboarded` |  |

### me — 16 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/me/bets` | `requireAuth` + `requireOnboarded` | đóng băng |
| POST | `/api/v1/me/cai-dat` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/dong-token` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/me/handle` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/me/nhan-khau` | `requireAuth` + `requireHoSo` |  |
| GET | `/api/v1/me/nhiem-vu` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/me/nhiem-vu/diem-danh` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/progress` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/qua-beta` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/me/qua-beta/nhan` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| GET | `/api/v1/me/rank` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/results` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/stats` | `requireAuth` + `requireOnboarded` |  |
| GET | `/api/v1/me/tu-khai` | `requireAuth` |  |
| POST | `/api/v1/me/tu-khai` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/me/tuoi` | `requireAuth` + `requireHoSo` |  |

### onboarding — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/onboarding` | `requireAuth` |  |

### pfm — 7 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/pfm/consent` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| POST | `/api/v1/pfm/diem-danh` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| POST | `/api/v1/pfm/dong-bo` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| GET | `/api/v1/pfm/luu` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| POST | `/api/v1/pfm/luu` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| POST | `/api/v1/pfm/tuan` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |
| POST | `/api/v1/pfm/xoa` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |

### shop — 3 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/shop/catalog` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/shop/hop` | `requireAuth` + `requireOnboarded` |  |
| POST | `/api/v1/shop/mua` | `requireAuth` + `requireOnboarded` |  |

### subsidy — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/subsidy/claim` | `requireAuth` + `requireOnboarded` + `chanKhach` |  |

### telemetry — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| POST | `/api/v1/telemetry` | `optionalAuth` |  |

### wallet — 1 route

| method | đường | guard | trạng thái |
|---|---|---|---|
| GET | `/api/v1/wallet` | `requireAuth` + `requireOnboarded` |  |
