/**
 * CHỤP GOLDEN FIXTURE — regression tất định của `replay()` TOÀN TRẬN (bước 1
 * của task W1, 03/09/2026).
 *
 * ─── VÌ SAO TỆP NÀY TỒN TẠI TRƯỚC KHI TỐI ƯU ────────────────────────────────
 * Founder đã duyệt W1: `POST /rounds` gọi `replay()` HAI LẦN mỗi request (một
 * lần cho trạng thái TRƯỚC vòng, một lần cho SAU), và MỖI lần phát lại TOÀN BỘ
 * log từ vòng 1 — chi phí tăng theo số vòng đã qua. Đo được (D214,
 * `scripts/do_cpu_vong_cuoi.ts`): vòng cuối của bàn 8 ghế tốn 8–20ms, vượt trần
 * CPU 10ms/lượt của Cloudflare Workers free. W1 sẽ làm `replay()` RESUMABLE để
 * bỏ một trong hai lần phát lại.
 *
 * Nhưng `replay(seed, action_log, luat)` LÀ định nghĩa danh tính một trận: mọi
 * trận đã lưu trên prod chỉ là một seed + một log, và kết quả của nó là bất cứ
 * điều gì `replay` nói HÔM NAY. CLAUDE.md A11.3 xếp "đổi hành vi engine" là cửa
 * MỘT CHIỀU, và A8.3 bắt viết test TRƯỚC khi code đụng tiền. Repo đã có golden
 * fixture cho BỘ SINH MAP (`holdem_map_golden.ts` + `holdem_map_regression.test.ts`)
 * nhưng CHƯA CÓ gì ghim TOÀN BỘ output của `replay()` cho một trận chạy hết map.
 * Tệp này (và `tests/holdem_replay_golden.test.ts`) dựng đúng lưới đó — MỘT
 * MÌNH nó không tối ưu gì cả, nó chỉ là thước đo "trước" để bước sau (đổi cách
 * `replay()` chạy) bị chấm xanh/đỏ bằng đúng thước này.
 *
 * ⚠⚠ TỆP NÀY CHỈ ĐỌC `server/` VÀ `config/` — không sửa, không tự đặt tham số
 * kinh tế (A8.2). Nó gọi `replay()`/`soDoGhe()`/`bocThamVai()`/`bayShop()` y hệt
 * đường `POST /rounds`/`POST /matches` thật, KHÔNG dựng lại một bản mô phỏng
 * thứ hai của engine — bản thứ hai chắc chắn trôi khỏi hành vi thật (D61), và
 * trôi đúng ở chỗ lưới an toàn này cần trung thực nhất.
 *
 * ⚠ KHÔNG chạy lại script này để "cập nhật" fixture sau khi ai đó sửa
 * `server/holdem*`/`config/holdem*` — làm thế là tự xoá chính cái thước (giống
 * cảnh báo ở đầu `holdem_map_golden.ts`). Test đỏ ⇒ SỬA CODE cho xanh lại. Chỉ
 * chạy lại (mặc định, không cờ) khi một `balance_version` MỚI cố ý đổi hành vi
 * và gate đo (Monte Carlo G1–G4) đã trình founder — đúng lúc đó fixture cũ vẫn
 * phải khớp cho các phiên bản CŨ trong ma trận (nếu không thì đây không phải
 * "thêm phiên bản", mà là "viết lại lịch sử" — chính điều A11.3 cấm).
 *
 * ─── CHẠY ────────────────────────────────────────────────────────────────────
 *   npx tsx scripts/holdem_replay_golden.ts          # sinh + GHI ĐÈ fixture
 *   npx tsx scripts/holdem_replay_golden.ts --kiem    # sinh lại, SO với fixture
 *                                                      # đã lưu, KHÔNG ghi file;
 *                                                      # exit 1 nếu lệch.
 *
 * ─── MA TRẬN ─────────────────────────────────────────────────────────────────
 * cỡ map [8,12,16] (`HOLDEM_DECISIONS.CO_MAP_CHON`) × số ghế [4,8] (hai đầu mút
 * của khoảng D3 "4–8 ghế", rẻ nhất và đắt nhất) × 20 seed tất định × 3
 * balance_version. Sáu "kịch bản hành vi" xoay theo `seedIdx % 6` — xem
 * `hanhDongChoVong` để biết TỪNG kịch bản làm gì.
 *
 * ─── BA BALANCE_VERSION, VÌ SAO CHỌN ĐÚNG BA CÁI NÀY ────────────────────────
 * 1. `HOLDEM_BALANCE_VERSION` (hằng số SỐNG, hiện là 'balance-v36-regime') —
 *    bộ luật MẶC ĐỊNH đang chạy prod hôm nay.
 * 2. `'balance-v10b-nav'` — phiên bản BẬT NAV đầu tiên (28/07), nhưng CHƯA có
 *    ô lịch chính sách/quán tính/sức căng/chu kỳ/vai có răng/kỳ ngộ/máy regime
 *    (`lichChinhSach/quanTinh/sucCang/chuKy/vaiCoRang/kyNgo/regimeTick` đều
 *    `false`). Đối lập tối đa với (1) trong cùng một "kỷ nguyên NAV" — và đây
 *    là bộ luật của những trận CŨ NHẤT còn replay được trên prod, tức đúng chỗ
 *    A11.3 nói "không được viết lại lịch sử" cắn đau nhất nếu W1 lỡ tay.
 * 3. `'balance-v38-doixung'` — phiên bản MỚI NHẤT trong bảng, đang "ở cổng"
 *    (`BO_LUAT_THEO_PHIEN_BAN`, chưa phải mặc định — xem comment tại chỗ khai
 *    v36/v37/v38 trong `config/holdem_balance.ts`). Khác (1) đúng hai cờ
 *    (`apLucBan`, `nhanQuaDoiXung`) — cặp này canh đúng biên MỚI NHẤT của engine,
 *    nơi nhiều khả năng có commit tiếp theo chạm vào nhất.
 * (1) và (3) cách nhau đúng 2 cờ để lưới cũng nhạy với một đổi nhỏ; (1) và (2)
 * cách nhau hầu hết mọi cờ để lưới còn canh được một "kỷ nguyên" hoàn toàn khác.
 *
 * ─── ĐỘ PHỦ HÀNH ĐỘNG — TRUNG THỰC VỀ NHỮNG GÌ KHÔNG DỰNG ───────────────────
 * CÓ dựng (xem `hanhDongChoVong`): giữ vị thế thuần · mua thẻ Tài sản (xoay
 * qua cả 6 mã) · mua thẻ Chiến thuật · "tăng cam kết" một khoản LỚN (gấp 6 lần
 * CAM_KET_NEN=500, đại diện hành vi kiểu all-in — engine tự KẸP về trần tố khi
 * vượt, không ném lỗi, xem `engine.ts` quanh dòng 2698) · cắt lỗ MỖI vòng (kể
 * cả sau khi cạn quota — engine tự hạ về 'theo', không ném lỗi) · đứng ngoài từ
 * vòng 2 (ghế đã `dung_ngoai` bị SKIP ở vòng cược mọi vòng sau, `engine.ts`
 * dòng ~3091 — gửi lại 'dung_ngoai' mỗi vòng vô hại).
 *
 * KHÔNG dựng (lý do: mỗi thứ này cần theo dõi trạng thái danh mục CHÍNH XÁC
 * qua nhiều vòng để hợp lệ về ngữ nghĩa — tự làm là dựng bản mô phỏng thứ hai
 * của đúng luật `replay()` đang thi hành, rủi ro trôi mà chính script này tồn
 * tại để chống — nên bị bỏ CÓ CHỦ Ý, không phải quên):
 *   · `dao` (đảo danh mục) · `khoa` (khoá tài sản 2 vòng) · `short` (bán khống,
 *     khớp vòng sau) — cả ba đòi biết ĐANG CẦM MÃ GÌ để hợp lệ.
 *   · `lenh`/`khop_truoc` (lệnh NAV theo mốc bp, khớp giữa vòng) — đòi mô
 *     phỏng cả bảng giá + mốc bp, đúng thứ `scripts/do_cpu_vong_cuoi.ts` cũng
 *     đã khai KHÔNG mô phỏng (xem GIỚI HẠN cuối tệp đó).
 *   · `cuoc` (chuỗi hành động cược tường minh nhiều bước trong một vòng) — chỉ
 *     dùng `hanh_dong`/`them` đơn (hành động ĐẦU của vòng); vòng cược nhiều
 *     lượt tố/theo/bỏ do CHÍNH ENGINE mô phỏng cho bot, không phải cho 'ban'.
 *   · `ky_ngo` (chọn nhiệm vụ Kỳ Ngộ) — đòi lọc theo đúng bộ ĐƯỢC MỜI của
 *     (seed, vòng) từ `replay().kyNgo.lan`, và chỉ hai trong ba balance_version
 *     đã chọn có bật `kyNgo`.
 *   · `dau_hang` (đầu hàng) — khép trận NGAY (xem `holdem_api.ts`, "ĐẦU HÀNG =
 *     KHÉP TRẬN NGAY"), mâu thuẫn với yêu cầu "chơi hết map"; để dành cho một
 *     kịch bản riêng nếu bước sau cần canh đường khép trận sớm.
 *   · `gan`/`gan_phu` (gắn thẻ chiến thuật vào một mã cụ thể) · `su_co_khai`/
 *     `tu_dong` (nhãn hết giờ — replay không dùng để TÍNH, chỉ dán nhãn) ·
 *     `khao_sat_lai` (luôn 0 — không re-roll shop) · `mo_bang`/`du_bao` (phí mở
 *     Bảng điện tử — luôn 0/false, không mô phỏng LUẬT 3).
 * Nếu bước W1 sau cần canh những nhánh này, đây là danh sách việc còn lại —
 * KHÔNG phải một khoảng trống không ai biết.
 *
 * ─── CẬP NHẬT 03/09/2026 (B5, docs/nhat-ky/D221.md) — MỘT PHẦN Ở TRÊN ĐÃ ĐÓNG ──
 * `lenh`/`khop_truoc` · `gan`/`gan_phu` · chuỗi `cuoc` to/theo/bo · `dau_hang` ·
 * `ky_ngo` · `tu_dong`/`mo_bang`/`du_bao` · `bac_rank` khác mặc định — synthetic
 * ở trên vẫn KHÔNG dựng những thứ này (lý do không đổi: tự dựng là dựng lại một
 * bản mô phỏng thứ hai của đúng luật `replay()` đang thi hành, D61). Nhưng từ
 * B5 có một khối THỨ HAI ("TRẬN THẬT" bên dưới, sau `chayMotTran`) nạp 11 trận
 * CỦA CHÍNH FOUNDER trên prod (`tests/fixtures/holdem_tran_that.json`), phủ
 * đúng những nhánh này — người thật đã bấm, nên phần đó không mô phỏng gì cả,
 * chỉ đọc lại. VẪN CHƯA có: `dao`/`khoa`/`short` — không trận nào trong 11 trận
 * của founder dùng ba cơ chế này (chưa chơi, không phải không dựng được).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  replay, soDoGhe,
} from '../server/holdem_api.js';
import { bocThamVai } from '../server/holdem/vai.js';
import { CO_BAN_14 } from '../config/luoc_bo.js';
import { bayShop } from '../server/holdem/shop.js';
import { conTrongTran, type GheMoi } from '../server/holdem/engine.js';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua, TIET_KIEM,
  type BoLuatCanBang,
} from '../config/holdem.js';

/** Một dòng `action_log` — kiểu suy từ chữ ký `replay()` vì `HanhDongLog` không
 * được export (cùng mẹo `scripts/do_cpu_vong_cuoi.ts` đã dùng): tự khai lại
 * kiểu này ở đây là dựng NGUỒN THỨ HAI cho đúng hình dạng mà `holdem_api.ts`
 * đã khai — lệch một trường thì TypeScript không bắt được (D61). */
type LogVong = Parameters<typeof replay>[1][number];

// ═══════════════════════════════════════════════════════════════════════════
// ── MA TRẬN ──────────────────────────────────────────────────────────────

/** `HOLDEM_DECISIONS.CO_MAP_CHON` — ĐỌC từ config, không chép tay hằng số. */
export const CO_MAP: readonly number[] = HOLDEM_DECISIONS.CO_MAP_CHON;
/**
 * D550 — cỡ thử của MỘT khoá: `CO_MAP` + cỡ ghim của luật nếu nó nằm ngoài `CO_MAP` (v63 `ban14` ⇒ 14 — cỡ trận thật trên prod phải được ghim).
 * Chỉ thêm cho khoá mang cỡ ấy: thêm cho mọi khoá là ~960 trận vô nghĩa. Khoá cũ giữ đúng ba cỡ ⇒ không key cũ nào đổi.
 */
export function coMapCua(phienBan: string): readonly number[] {
  const ghim = luatCua(phienBan).ban14 ? CO_BAN_14 : null;
  return ghim !== null && !CO_MAP.includes(ghim) ? [...CO_MAP, ghim] : CO_MAP;
}
/** Hai đầu mút của khoảng D3 "4–8 ghế" — rẻ nhất và đắt nhất, không quét giữa. */
export const SO_GHE_CHON = [4, 8] as const;
/** ≥20 theo yêu cầu task — bài học G4 montecarlo: "N nhỏ nuốt tín hiệu". */
export const SO_SEED = 20;
/** Xem docstring đầu tệp — hai lý do chọn cho từng phiên bản. */
export const PHIEN_BAN_DO: readonly string[] = [
  HOLDEM_BALANCE_VERSION, 'balance-v10b-nav', 'balance-v38-doixung',
  // D303 (07/09): mặc định đi tiếp v36 → v40, nhưng MỌI trận prod trước 07/09 là v36 —
  // giữ v36 đích danh để lịch sử của chúng có thước riêng, không trôi theo hằng mặc định.
  // Kiểm chéo lúc thêm: ma trận CŨ [v36, v10b, v38] + code hôm nay + fixture cũ ⇒ 360 + 4
  // deep + 11 trận thật khớp 100% (`--kiem`), rồi mới sinh lại fixture với v40.
  'balance-v36-regime',
  /*
   * D313 (09/09): mặc định đi tiếp v40 → v42 — GHIM v40 ĐÍCH DANH, cùng lý do với v36
   * ngay trên, và lần này suýt quên.
   *
   * Chỗ 1 của mảng này lấy `HOLDEM_BALANCE_VERSION`, nên lật mặc định là v40 RỜI KHỎI ma
   * trận mà không ai báo: `--kiem` chỉ kêu 120 chỗ "THIẾU" (hàng v42 mới) và không một
   * dòng "LỆCH" nào, tức nhìn qua thì y như một cú thêm phiên bản sạch sẽ. Cái mất là
   * VÙNG PHỦ: v40 là luật của mọi trận prod từ 07/09 tới nay, và nó vừa hết thước.
   * Bắt được bằng cách so khoá fixture trước/sau: 120 khoá `balance-v40-*` biến mất đúng
   * bằng số khoá `balance-v42-*` xuất hiện.
   */
  'balance-v40-lichcodinh',
  /*
   * D317 (09/09): mặc định đi tiếp v42 → v44 — GHIM v42 ĐÍCH DANH. Lần thứ BA
   * liên tiếp phải làm việc này (v36 ở D303, v40 ở D313), nên nói thẳng thành
   * một luật thay vì một chú thích nữa:
   *
   *   ⭐ MỖI LẦN LẬT `HOLDEM_BALANCE_VERSION`, GHIM BẢN VỪA RỜI GHẾ MẶC ĐỊNH.
   *
   * Chỗ 1 của mảng lấy hằng mặc định, nên lật là bản cũ RỜI ma trận mà không ai
   * báo — `--kiem` chỉ kêu "THIẾU" (hàng mới) chứ không "LỆCH", tức nhìn qua y
   * như một cú thêm phiên bản sạch sẽ. Cái mất là VÙNG PHỦ của luật mà mọi trận
   * prod hiện có đang chạy. Cách bắt: so DANH SÁCH `ma_tran.phien_ban` của
   * fixture trước/sau — nó phải DÀI THÊM một, không phải đổi một phần tử.
   */
  'balance-v42-taisan',
  /*
   * D318 (09/09): mặc định đi tiếp v44 → v45 — GHIM v44 ĐÍCH DANH, theo đúng câu luật
   * ngay trên. Lần thứ TƯ, và lần đầu tiên nó là một bước quy trình chứ không phải một
   * cú suýt quên: đọc luật, làm theo, kiểm bằng độ dài danh sách.
   */
  'balance-v44-tuongquan',
  /*
   * D338 (16/09): mặc định đi tiếp v45 → v46 (Đòn Bẩy nhân đúng từng mã + lãi vay) — GHIM v45
   * ĐÍCH DANH theo luật ngay trên: mọi trận prod từ 09/09 tới nay chạy v45.
   */
  'balance-v45-duongcong',
  /*
   * D339 (16/09): mặc định đi tiếp v46 → v47 (khẩu vị nhân đúng biên độ) — GHIM v46 ĐÍCH
   * DANH. v46 mới làm mặc định được vài giờ nhưng vẫn là luật của những trận mở trong
   * khoảng ấy, và luật ghim không có ngoại lệ "mới quá nên chắc chưa ai chơi".
   */
  'balance-v46-donbay',
  /*
   * D340 (16/09): mặc định đi tiếp v47 → v48 (rủi ro đối tác trừ một lần) — GHIM v47 ĐÍCH DANH.
   * Lần thứ SÁU liên tiếp, và từ D339 thì việc này có thêm một BƯỚC KIỂM: sau khi sinh lại, chạy
   * v47 ở ĐÚNG chỗ cũ (phienBanIdx = 0) bằng code mới rồi so với fixture trước — hash ở đây bao
   * cả `st` (mang tên phiên bản + cờ mới) nên KHÔNG so chéo theo tên được, và nếu không làm bước
   * ấy thì 120 dòng "LỆCH" của bản vừa rời ghế mặc định không phân biệt được với lỗi thật.
   */
  'balance-v47-khauvi',
  /* D342 (16/09): mặc định v48 → v49 (lõi Bán Khống) — GHIM v48 ĐÍCH DANH, cùng luật lần thứ bảy. */
  'balance-v48-doitac',
  /* D345 (16/09): mặc định v49 → v50 (phí mua bán nhẹ) — GHIM v49 ĐÍCH DANH. */
  'balance-v49-bankhong',
  /* D346 (17/09): mặc định v50 → v51 (phí hai bậc) — GHIM v50 ĐÍCH DANH, cùng luật lần thứ chín. */
  'balance-v50-phinhe',
  /*
   * D371 (21/09): mặc định v51 → v52 (Đa Dạng Hoá thôi thu tiền thuê mỗi vòng) — GHIM v51
   * ĐÍCH DANH, lần thứ MƯỜI. v51 là luật của mọi trận prod từ 17/09 tới nay.
   * ⚠ Bước kiểm của D339/D340 đã làm ĐÚNG THỨ TỰ lần này: chạy `--kiem` khi mặc định CÒN là
   * v51 (tức trước khi đụng dòng `HOLDEM_BALANCE_VERSION`) ⇒ 1560 synthetic + 4 deep + 11
   * trận THẬT khớp 100%, chứng minh refactor `daDangCua()` không đổi một chip nào của trận
   * cũ. Rồi mới lật + ghim + sinh lại. Làm ngược thứ tự thì hai loại lệch trộn vào nhau.
   *
   * ⭐⭐ VÀ ĐÂY LÀ CƠ CHẾ mà chín lần ghim trước chỉ mô tả triệu chứng ("120 dòng LỆCH không
   * phân biệt được với lỗi thật" — D340) chứ chưa bao giờ nói thẳng:
   *
   *   `seedCho(coMap, soGhe, phienBanIdx, seedIdx)` NHẬN **VỊ TRÍ TRONG MẢNG NÀY**,
   *   còn `key` thì KHÔNG mang seed.
   *
   * Nên ghim bản vừa rời ghế mặc định = đẩy nó từ index 0 xuống cuối = **đổi toàn bộ seed của
   * nó**. 120 khoá `balance-v51-*` vẫn còn tên cũ nhưng trỏ tới 120 TRẬN KHÁC ⇒ hash lệch hết,
   * và lệch đó LÀNH. Đo đích danh lần này: v51 idx 0 ⇒ seed 2.655.001.324 · v51 idx 13 ⇒
   * 2.655.527.863 · **v52 idx 0 ⇒ 2.655.001.324, đúng bằng seed cũ của v51**.
   *
   * Hai hệ quả phải nhớ:
   *   (a) CÁCH DUY NHẤT phân biệt lệch-lành với lệch-thật là chạy `--kiem` TRƯỚC khi lật, lúc
   *       bản cũ còn ở index 0. So fixture trước/sau theo TÊN sau khi đã lật thì không kết
   *       luận được gì — tên còn, trận thì không.
   *   (b) Bù lại có một món quà: bản mới thừa hưởng index 0 nên nó chạy ĐÚNG bộ seed mà bản cũ
   *       vừa bỏ lại ⇒ `balance-v52-*|…` và `balance-v51-*|…` của fixture CŨ là một cặp
   *       trước/sau sạch trên cùng những trận. Muốn xem cổng mới đổi cái gì thì so đúng cặp ấy.
   */
  'balance-v51-phibac',
  /* D378 — v52 rời ghế mặc định 22/09 (v53 lên). Ghim vào đây để replay trận v52 —
     tức MỌI trận đã chơi tới hôm nay — còn được canh. Hash v52 lệch so với fixture cũ
     là LÀNH: xuống cuối danh sách = đổi toàn bộ seed, xem docstring ngay trên. */
  'balance-v52-dadang',
  /* D406 — v53 rời ghế mặc định 25/09 (v54 lên). Ghim để replay trận v53 — MỌI trận prod 22/09 → 25/09 — còn
     thước. `--kiem` chạy TRƯỚC khi lật (mặc định còn v53) khớp 100% ⇒ hash v53 lệch sau khi sinh lại là LÀNH
     (xuống cuối danh sách = đổi toàn bộ seed, docstring D371 ngay trên). */
  'balance-v53-upo',
  /* D434 — v54 rời ghế mặc định 27/09 (v55 lên). Ghim để replay trận v54 — MỌI trận prod 25/09 → 27/09 — còn thước.
     `--kiem` chạy TRƯỚC khi lật (mặc định còn v54): 1920 synthetic + 4 deep + 11 trận THẬT + 2 deep THẬT khớp 100% ⇒
     hash v54 lệch sau khi sinh lại là LÀNH (xuống cuối danh sách = đổi toàn bộ seed, docstring D371 ở trên). */
  'balance-v54-ngare',
  /* D447 (28/09): mặc định v55 → v56 (phí cộng dồn cả vòng) — GHIM v55 ĐÍCH DANH. */
  'balance-v55-build',
  /* D525 (05/10): mặc định v56 → v58 (nhịp xen kẽ minigame) — GHIM v56 ĐÍCH DANH: mọi trận prod 28/09 → 05/10 là v56. v57 chưa
     từng là mặc định, chưa lên prod ⇒ không ghim. */
  /* D528 (05/10): mặc định v58 → v59 (kê lệnh) — v58 chưa từng lên prod ⇒ không ghim. --kiem chạy TRƯỚC khi lật (mặc định còn v58) khớp 100 %. */
  'balance-v56-congdon',
  /* D530 (06/10): mặc định v59 → v60 (lõi chỉ trong màn) — GHIM v59 ĐÍCH DANH: trận prod 05/10 → nay là v59. Cuối danh sách: khoá cũ giữ seed. */
  'balance-v59-kelenh',
  /* D530 — GHIM v58: BÀN TẬP trên prod chạy v58 từ 0.0.53 (05/10) tới khi bàn tập sang v60. D528 ghi "v58 chưa từng lên prod" là sai —
     đúng với trận thật, sai với bàn tập. Cuối danh sách: khoá cũ giữ seed. */
  'balance-v58-xenke',
  /* D536 (06/10): mặc định v60 → v61 (lệnh lớn trong màn) — GHIM v60 ĐÍCH DANH: trận thật + bàn tập prod 06/10 (0.0.54). Cuối danh sách: khoá cũ giữ seed. */
  'balance-v60-loiman',
  /* D545 (06/10): mặc định v61 → v62 (kỳ họp bàn tập) — GHIM v61 ĐÍCH DANH: trận thật + bàn tập prod 06/10 tối (0.0.55). Cuối danh sách. */
  'balance-v61-lenhlon',
  /* D550 (07/10): mặc định v62 → v63 (bàn 14 ô) — GHIM v62 ĐÍCH DANH: trận thật + bàn tập prod 0.0.56–0.0.58. Cuối danh sách. */
  'balance-v62-kyhoptap',
  /* D560 (08/10): mặc định v63 → v64 (chu kỳ có ngòi) — GHIM v63 ĐÍCH DANH: trận thật prod 0.0.59–0.0.60. Cuối danh sách. */
  'balance-v63-ban14',
  /* D561 (08/10): mặc định v64 → v65 (thang kỹ năng) — GHIM v64 ĐÍCH DANH: trận thật prod 0.0.61. Cuối danh sách. */
  'balance-v64-congoi',
  /* D566 (10/10): mặc định v65 → v66 (lãi áp theo lá quyết toán) — GHIM v65 ĐÍCH DANH: trận thật prod 0.0.62. --kiem chạy TRƯỚC khi
     lật (mặc định còn v65) khớp 100 %. Cuối danh sách. */
  'balance-v65-thangkynang',
  /* D574 (10/10): mặc định v66 → v67 (bối cảnh dài hạn) — GHIM v66 ĐÍCH DANH: trận thật prod 0.0.64. --kiem chạy TRƯỚC khi lật
     (mặc định còn v66). Cuối danh sách. */
  'balance-v66-laiap',
];
/** Số kịch bản hành vi — xem `hanhDongChoVong`. */
export const SO_HANH_VI = 6;

for (const p of PHIEN_BAN_DO) {
  if (!(p in BO_LUAT_THEO_PHIEN_BAN)) {
    throw new Error(`PHIEN_BAN_DO trỏ tới khoá không tồn tại trong BO_LUAT_THEO_PHIEN_BAN: "${p}"`);
  }
}

/** Bốn "ô" được lưu FULL (không chỉ hash) — xem docstring `sinhToanBo`. */
const DEEP_KEYS: ReadonlySet<string> = new Set([
  `${HOLDEM_BALANCE_VERSION}|8|4|0`,
  `${HOLDEM_BALANCE_VERSION}|16|8|0`,
  `balance-v10b-nav|12|8|0`,
  `balance-v38-doixung|16|4|1`,
]);

export interface OTran {
  phienBan: string;
  coMap: number;
  soGhe: number;
  seedIdx: number;
  seed: number;
  hanhViIdx: number;
  key: string;
}

/**
 * Seed TẤT ĐỊNH trộn bốn chiều của ma trận — không `Math.random` (nghiệm thu
 * phải tái lập được, xem CLAUDE.md). Hằng số nhân theo đúng phong cách
 * `scripts/do_cpu_vong_cuoi.ts` (`2654435761` — Knuth multiplicative hash).
 */
export function seedCho(
  coMap: number, soGhe: number, phienBanIdx: number, seedIdx: number,
): number {
  return (((seedIdx + 1) * 2654435761)
    + coMap * 97 + soGhe * 131071 + (phienBanIdx + 1) * 40503) >>> 0;
}

/**
 * MỘT NGUỒN cho thứ tự + nội dung ma trận — dùng bởi CẢ sinh fixture LẪN test.
 * Hai vòng lặp lồng nhau độc lập (một ở generator, một ở test) là chỗ dễ trôi
 * nhất (D61): sửa cỡ map ở một bên mà quên bên kia thì "ma trận" mỗi nơi hiểu
 * một khác, và so sánh giữa chúng trở thành vô nghĩa mà không ai báo lỗi.
 */
export function moiO(): OTran[] {
  const ra: OTran[] = [];
  PHIEN_BAN_DO.forEach((phienBan, phienBanIdx) => {
    for (const coMap of coMapCua(phienBan)) {
      for (const soGhe of SO_GHE_CHON) {
        for (let seedIdx = 0; seedIdx < SO_SEED; seedIdx += 1) {
          const seed = seedCho(coMap, soGhe, phienBanIdx, seedIdx);
          const hanhViIdx = seedIdx % SO_HANH_VI;
          ra.push({
            phienBan, coMap, soGhe, seedIdx, seed, hanhViIdx,
            key: `${phienBan}|${coMap}|${soGhe}|${seedIdx}`,
          });
        }
      }
    }
  });
  return ra;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── HÀNH VI CỦA GHẾ 'ban' ────────────────────────────────────────────────

/**
 * Sáu kịch bản hành vi, xoay theo `hanhViIdx = seedIdx % SO_HANH_VI`. Mục tiêu:
 * KHÔNG để cả kho là một hành vi — chỉ "giữ vị thế" thì lưới chỉ canh được một
 * góc của `replay()` (nhánh mua thẻ / tăng cam kết / cắt lỗ / đứng ngoài đều
 * mù). Mỗi kịch bản CHỈ dùng những trường `HanhDongLog` không cần nhớ trạng
 * thái danh mục nhiều vòng để hợp lệ về ngữ nghĩa — xem "KHÔNG dựng" ở đầu tệp.
 *
 * Đọc `shop` từ `bayShop()` với ĐÚNG `danh_muc`/`gian_la` mà `replay()` đọc ở
 * bên trong nó (`truoc.st`) — không suy lại danh mục bằng tay: đó là cách duy
 * nhất đảm bảo mã thẻ gửi lên LUÔN hợp lệ (không rơi vào nhánh "mua() bỏ qua
 * im lặng khi hỏng").
 */
function hanhDongChoVong(
  hanhViIdx: number, vong: number, truoc: ReturnType<typeof replay>, seed: number,
  luat: BoLuatCanBang,
): {
  mua: string[]; hanh_dong: LogVong['hanh_dong']; them: number;
  tiet_kiem?: { huy?: string[]; mo?: { moc_bp: number; so_vong: number }[] };
} {
  const banTruoc = truoc.st.ghe.find((g) => g.id === 'ban')!;
  const shop = bayShop(seed, vong, 'ban', 0, banTruoc.danh_muc, truoc.st.gian_la === true);
  switch (hanhViIdx % SO_HANH_VI) {
    case 0: // GIỮ VỊ THẾ THUẦN — đối chứng, không mua gì.
      return { mua: [], hanh_dong: 'giu_vi_the', them: 0 };
    case 1: { // MUA TÀI SẢN — xoay qua cả 6 mã theo vòng, không mua trùng mãi một mã.
      const id = shop.tai_san.length ? shop.tai_san[(vong - 1) % shop.tai_san.length] : undefined;
      /*
       * ⭐⭐ v43 — GỬI TIẾT KIỆM ĐI KÈM, và đây là lần đầu lưới golden chạm cơ chế
       * ngân hàng. Trước D317 nó nằm NGOÀI lưới hoàn toàn: đổi nấc lãi mà `--kiem`
       * báo "khớp 100%", tức toàn bộ dây `chotPhien` có sổ trong đó chưa từng được
       * ghim danh tính lần nào.
       *
       * ⚠ CHỈ gửi khi bộ luật CÓ cờ, và đó là điều kiện làm cả cú thêm này AN TOÀN:
       * log của mọi bản ≤ v42 giữ nguyên từng byte ⇒ hash của chúng không đổi ⇒
       * `--kiem` chỉ được phép lệch ở đúng hàng v44. Gửi vô điều kiện thì bản cũ
       * cũng có `tiet_kiem` trong log, `apMoTietKiem` trả `luat_tat`, và `loi_von`
       * lọt vào kết quả replay — đổi hash của những bản lẽ ra không được chạm.
       *
       * ⚠ Không nhét vào case 0: đó là ĐỐI CHỨNG "giữ vị thế thuần", phải sạch.
       *
       * Kịch bản: vòng 1 gửi 25% kỳ hạn NGẮN NHẤT (mốc dài có thể không kịp đáo
       * hạn ở map 8 ⇒ `khong_kip_dao_han` và nhánh cộng lãi không bao giờ chạy);
       * vòng 3 HUỶ sạch. Ba nhánh cùng vào lưới: mở · cộng lãi/đáo hạn · huỷ.
       */
      const nh = luat.tietKiem === true;
      const soDangCo = (truoc.st.ghe.find((g) => g.id === 'ban')?.tiet_kiem ?? []);
      const tk = !nh ? undefined
        : vong === 1 ? { mo: [{ moc_bp: 2500, so_vong: TIET_KIEM.MOC[0]! }] }
          : (vong === 3 && soDangCo.length > 0) ? { huy: soDangCo.map((h) => h.id) }
            : undefined;
      return {
        mua: id ? [id] : [], hanh_dong: 'giu_vi_the', them: 0,
        ...(tk ? { tiet_kiem: tk } : {}),
      };
    }
    case 2: { // MUA CHIẾN THUẬT — cùng nếp `scripts/do_cpu_vong_cuoi.ts`.
      const id = shop.chien_thuat[0];
      return { mua: id ? [id] : [], hanh_dong: 'giu_vi_the', them: 0 };
    }
    case 3: { // "ALL-IN-ISH" — tăng cam kết một khoản LỚN mỗi vòng (gấp 6 lần
      // CAM_KET_NEN=500), kèm mua chiến thuật để không mù nhánh mua khi tăng
      // cam kết. Vượt trần tố thì engine tự KẸP (engine.ts ~2698), không ném.
      const id = shop.chien_thuat[0];
      return { mua: id ? [id] : [], hanh_dong: 'tang_cam_ket', them: 3000 };
    }
    case 4: // CẮT LỖ mỗi vòng, kể cả sau khi cạn quota `so_lan_cat_lo` — engine
      // tự lọc 'bo' khỏi `duoc` rồi hạ quyết định về 'theo' (engine.ts ~2637,
      // ~2698), KHÔNG ném lỗi.
      return { mua: [], hanh_dong: 'cat_lo', them: 0 };
    default: // ĐỨNG NGOÀI từ vòng 2 — vòng 1 giữ vị thế để có ít nhất một vòng
      // "chơi thật" trước khi rời. Ghế đã `dung_ngoai` bị SKIP ở vòng cược mọi
      // vòng sau (engine.ts dòng ~3091: `if (g.tu_the === 'dung_ngoai' || ...)
      // continue;`), nên gửi lại 'dung_ngoai' mỗi vòng sau đó vô hại.
      return { mua: [], hanh_dong: vong === 1 ? 'giu_vi_the' : 'dung_ngoai', them: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CHẠY MỘT TRẬN ĐẾN HẾT ────────────────────────────────────────────────

/**
 * Chơi hết MỘT trận (mọi vòng của `coMap`, trừ khi bàn chết sớm — ≤1 ghế còn
 * `conTrongTran`), dựng log Y HỆT cách `POST /rounds` dựng (đọc trạng thái
 * TRƯỚC vòng bằng `replay()`, quyết hành động, nối vào log). Trả `replay()`
 * cuối cùng trên log đã dựng trọn — đây là "danh tính trận" mà fixture ghim.
 *
 * `luatOverride` CHỈ dùng cho phép tiêm lỗi ngược (A11.6, xem báo cáo D-số của
 * task) — đường sinh fixture thật KHÔNG BAO GIỜ truyền tham số này.
 */
export function chayMotTran(
  coMap: number, soGhe: number, seed: number, phienBan: string, hanhViIdx: number,
  luatOverride?: BoLuatCanBang,
): { r: ReturnType<typeof replay>; vongDatDuoc: number } {
  const luat = luatOverride ?? luatCua(phienBan);
  // Y HỆT đoạn `POST /matches` thật — xem docstring đầu `do_cpu_vong_cuoi.ts`.
  const ghe = soDoGhe(seed, '', soGhe);
  if (coMap >= 12) {
    const vai = bocThamVai(seed, ghe.length);
    for (const [i, g] of ghe.entries()) {
      const v = vai[i];
      if (v) g.vai = v;
    }
  }

  let log: LogVong[] = [];
  let vongDatDuoc = 0;
  /*
   * D382 — SỐ VÒNG ≠ SỐ Ô ở luật có bối cảnh mở màn: bộ bài k ô chỉ chạy được k−1 vòng.
   * Chạy tới ô thứ k thì `chotPhien` đọc `o[k]` (không tồn tại) và nổ "vượt quá map".
   */
  const soVongChay = coMap - (luatCua(phienBan).oUp ? 1 : 0);
  for (let vong = 1; vong <= soVongChay; vong += 1) {
    const truoc = replay(seed, log, false, ghe, luat, 0, false, coMap);
    // Kiểm TRƯỚC khi chơi vòng này — tương đương kiểm `sau` của vòng trước
    // (state "trước vòng N" == state "sau vòng N-1"), nhưng chỉ MỘT lần
    // replay() mỗi vòng thay vì hai — rẻ hơn, và đúng thứ W1 sắp làm cho
    // production nên dùng nếp rẻ ngay ở đây không mâu thuẫn gì với việc đo.
    const conSong = truoc.st.ghe.filter((g) => conTrongTran(g)).length;
    if (conSong <= 1) break;
    const { mua, hanh_dong, them, tiet_kiem } = hanhDongChoVong(hanhViIdx, vong, truoc, seed, luat);
    // ⚠ VẮNG MẶT khi không có lệnh — dòng log phải trông y hệt dòng của trận cũ.
    log = [...log, {
      vong, khao_sat_lai: 0, mua, hanh_dong, them, ...(tiet_kiem ? { tiet_kiem } : {}),
    } as LogVong];
    vongDatDuoc = vong;
  }
  const r = replay(seed, log, false, ghe, luat, 0, false, coMap);
  return { r, vongDatDuoc };
}

// ═══════════════════════════════════════════════════════════════════════════
// ── TRẬN THẬT — 11 trận prod của founder (B5, docs/nhat-ky/D221.md) ─────────
//
// Corpus synthetic ở trên KHÔNG dựng được (xem "KHÔNG dựng" ở docstring đầu
// tệp): `lenh`/`khop_truoc` · `gan`/`gan_phu` · chuỗi `cuoc` to/theo/bo ·
// `dau_hang` · `ky_ngo` · `tu_dong`/`mo_bang`/`du_bao`/`khao_sat_lai` ·
// `bac_rank` khác mặc định — mỗi thứ cần theo dõi trạng thái danh mục CHÍNH
// XÁC qua nhiều vòng để hợp lệ về ngữ nghĩa, tự dựng là dựng lại một bản mô
// phỏng thứ hai của đúng luật `replay()` đang thi hành (D61). Founder chọn
// phương án (b) thay vì tự dựng: nạp TRẬN CỦA CHÍNH FOUNDER trên prod — người
// thật đã bấm những nút đó, nên khối này không mô phỏng gì cả, chỉ ĐỌC LẠI.
//
// Nguồn: `tests/fixtures/holdem_tran_that.json` — 11 trận (một mỗi
// balance_version, log DÀI NHẤT trong số các trận `role='admin'` đã
// `status='xong'`), kéo 03/09/2026 qua Supabase chỉ-đọc (toàn văn câu SQL nằm
// ở trường `_nguon` của chính tệp đó). `scripts/lay_tran_that.ts` tái lập
// được câu này và SO được với tệp đã cam kết (`--kiem`) — xem tệp đó vì sao
// cần. ĐÃ soi `ghe_json` trước khi kéo — không user_id/handle/email (C7).
//
// ⚠ KHÔNG gọi `soDoGhe()`/`bocThamVai()` như `chayMotTran` ở trên: sơ đồ ghế
// của trận THẬT đã CỐ ĐỊNH trong `ghe_json` lúc tạo trận trên prod — suy lại
// là đúng lỗi mà docstring `replay()` cảnh báo ("mọi trận đã lưu trên prod sẽ
// replay ra số ghế khác"). Cũng không có vòng lặp "chơi tới hết map": trận đã
// `status='xong'` nên `log` đã là TOÀN BỘ hành động thật của trận — gọi
// `replay()` đúng MỘT lần trên log trọn vẹn, không dựng dần từng vòng.

const THAT_PATH = path.join('tests', 'fixtures', 'holdem_tran_that.json');

interface TranThatRaw {
  phien_ban: string;
  seed: number;
  /** ⚠ null = trận trước migration 0023 (chưa có cột `so_o`) — PHẢI thành
   *  `undefined` khi gọi `replay()`, không phải giữ `null`. Xem `tranThatTuRaw`. */
  so_o: number | null;
  ghe: GheMoi[];
  log: LogVong[];
}

interface TranThatFixture {
  da_doi_chieu_prod: boolean;
  ngay_lay: string;
  tran: readonly TranThatRaw[];
}

export interface OTranThat {
  phienBan: string;
  seed: number;
  soO: number | undefined;
  ghe: GheMoi[];
  log: LogVong[];
  key: string;
}

function taiThatRaw(): TranThatFixture {
  return JSON.parse(readFileSync(THAT_PATH, 'utf8')) as TranThatFixture;
}

/**
 * ⚠⚠ `so_o: null` → `undefined`, KHÔNG PHẢI giữ `null` hay đổi thành 0. Sai
 * chỗ này thì trận cũ (trước migration 0023, không có cột `so_o`) lặng lẽ
 * replay ở MAP_SIZE mặc định thay vì cỡ map trận đó thực sự có — một TRẬN
 * KHÁC, đúng hạng mục "lệch âm thầm" mà cả corpus này tồn tại để bắt.
 */
function tranThatTuRaw(t: TranThatRaw): OTranThat {
  return {
    phienBan: t.phien_ban,
    seed: t.seed,
    soO: t.so_o === null ? undefined : t.so_o,
    ghe: t.ghe,
    log: t.log,
    key: `that|${t.phien_ban}|${t.seed}`,
  };
}

/**
 * MỘT NGUỒN cho thứ tự + nội dung của 11 trận thật — dùng bởi CẢ sinh fixture
 * LẪN test, cùng lý do `moiO()` là một nguồn cho cả hai phía synthetic (D61).
 */
export function moiTranThat(): OTranThat[] {
  return taiThatRaw().tran.map(tranThatTuRaw);
}

/**
 * HAI trận "dày" nhất trong 11 trận — lưu FULL (không chỉ hash), cùng vai trò
 * `DEEP_KEYS` ở phần synthetic.
 *  · `balance-v23-cantroi2` (16 vòng, map 16) — 9/16 vòng có `lenh`, BA lần
 *    `gan` (gắn Đòn Bẩy vào ba mã khác nhau theo thời gian: cp_cn → vàng →
 *    btc → vàng), một `mo_bang`+`tu_dong`. Dày nhất về `lenh`+`gan`.
 *  · `balance-v34-vai` (16 vòng, map 16, ghế có `vai`) — trận DUY NHẤT trong
 *    11 trận có `khop_truoc` (khớp lệnh giữa vòng), cộng `ky_ngo` (2 lần),
 *    `du_bao`+`mo_bang` cùng vòng, `lenh` ở 5/16 vòng. Dày nhất về ĐA DẠNG
 *    hình dạng hành động — bỏ trận này là mất luôn phép canh `khop_truoc`,
 *    vì không trận nào khác trong 11 trận có trường đó.
 * Chọn hai, không phải mười một: `deep` so FULL structure (không qua hash),
 * tốn hơn nhiều lần một hash — cùng cân nhắc "4 trong 360" của phần synthetic.
 */
export const DEEP_KEYS_THAT: ReadonlySet<string> = new Set([
  'that|balance-v23-cantroi2|1889944688',
  'that|balance-v34-vai|974839649',
]);

/**
 * Chạy MỘT trận thật — sơ đồ ghế + log đã CỐ ĐỊNH từ prod, không dựng dần.
 * Ném lỗi NGUYÊN VẸN lên trên (người gọi ở `sinhToanBo`/`kiemTraVoiFixture`
 * bọc thêm context phiên_bản/seed, cùng nếp `chayMotTran`).
 */
export function chayMotTranThat(t: OTranThat): ReturnType<typeof replay> {
  const luat = luatCua(t.phienBan);
  return replay(t.seed, t.log, false, t.ghe, luat, 0, false, t.soO);
}

// ═══════════════════════════════════════════════════════════════════════════
// ── DIGEST + HASH + SO SÁNH ──────────────────────────────────────────────

/** Các trường của `replay()` mà task yêu cầu ghim — xem đề bài §"Capture". */
interface TrichXuatReplay {
  st: unknown;
  ketQuaCuoi: unknown;
  navTruocCuoi: number | null;
  pcVong: unknown;
  kvVong: unknown;
  nhatKyCuoi: unknown;
  loiVonCuoi: unknown;
  kyNgoLan: unknown;
  hitVongCuoi: string[];
}

export function trichXuat(r: ReturnType<typeof replay>): TrichXuatReplay {
  return {
    st: r.st,
    ketQuaCuoi: r.ketQuaCuoi,
    navTruocCuoi: r.navTruocCuoi,
    pcVong: r.pcVong,
    kvVong: r.kvVong,
    nhatKyCuoi: r.nhatKyCuoi,
    loiVonCuoi: r.loiVonCuoi,
    kyNgoLan: r.kyNgo.lan,
    // Set không JSON.stringify được ra thứ đọc lại được (từ mảng rỗng {} tới
    // im lặng bỏ qua tuỳ engine) — mảng đã SẮP XẾP loại luôn phụ thuộc thứ tự
    // chèn (thứ tự chèn của MỘT Set trong V8 vẫn tất định, nhưng "tất định mà
    // không ai đọc ra được lý do" cũng tệ gần bằng không tất định khi một
    // review sau này nhìn vào diff).
    hitVongCuoi: Array.from(r.hitVongCuoi).sort(),
  };
}

/**
 * Sắp XẾP KHOÁ đệ quy trước khi stringify. VÌ SAO CẦN, khác với
 * `holdem_map_golden.ts` (không cần): `st` ở đây là trạng thái TRẬN dựng qua
 * hàng chục bước `{...spread, ...}` tuỳ cờ `luat` (nhiều nhánh `...(cond ? {x
 * :...} : {})` — xem `holdem_api.ts`/`engine.ts`), và `vi_the`/`danh_muc` là
 * `Record<string, number>` được ĐIỀN DẦN qua nhiều vòng giao dịch. Thứ tự
 * CHÈN của các object đó là tất định (cùng input ra cùng thứ tự) nhưng KHÔNG
 * phải bất biến ngữ nghĩa — một refactor vô hại (đổi thứ tự spread hai
 * field độc lập, hoặc build `vi_the` bằng `Object.fromEntries` thay vì gán
 * từng dòng) có thể đổi thứ tự chèn mà KHÔNG đổi ý nghĩa của state, và một
 * hash không sắp xếp khoá sẽ báo ĐỎ GIẢ cho đúng loại đổi vô hại đó — làm
 * người đọc mất niềm tin vào lưới rồi bỏ qua cả những lần đỏ THẬT. Mảng thì
 * GIỮ NGUYÊN thứ tự (thứ tự có nghĩa thật: `ghe` = thứ tự ghế, `map.o` = thứ
 * tự vòng, `nhat_ky` = thứ tự diễn ra) — chỉ khoá object mới sắp.
 */
export function canon(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(canon);
  if (x !== null && typeof x === 'object') {
    const o = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = canon(o[k]);
    return out;
  }
  return x;
}

export function canonStringify(x: unknown): string {
  return JSON.stringify(canon(x));
}

/** FNV-1a 32-bit — "đủ cho vai trò phát hiện lệch, không phải mật mã" (cùng
 * lời của `holdem_map_golden.ts`). */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Đường dẫn TRƯỜNG ĐẦU TIÊN lệch giữa hai giá trị đã canon hoá (hoặc đã qua
 * JSON round-trip — hai điều kiện tương đương cho mục đích so sánh ở đây).
 * Chỉ dùng cho CHẨN ĐOÁN khi hash đã báo lệch — không dùng để QUYẾT đỏ/xanh
 * (đó là việc của so sánh hash/chuỗi trực tiếp, tránh false-negative nếu hàm
 * so lệch này có bug).
 */
export function timKhacBietDauTien(a: unknown, b: unknown, duong = '$'): string | null {
  if (a === b) return null;
  if (Number.isNaN(a as number) && Number.isNaN(b as number)) return null;
  const loaiA = a === null ? 'null' : typeof a;
  const loaiB = b === null ? 'null' : typeof b;
  if (loaiA !== loaiB) return `${duong} (kiểu khác: ${loaiA} vs ${loaiB})`;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return `${duong} (một bên không phải mảng)`;
    if (a.length !== b.length) return `${duong}.length (${a.length} vs ${b.length})`;
    for (let i = 0; i < a.length; i += 1) {
      const d = timKhacBietDauTien(a[i], b[i], `${duong}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  if (loaiA === 'object') {
    const oa = a as Record<string, unknown>;
    const ob = b as Record<string, unknown>;
    const khoa = Array.from(new Set([...Object.keys(oa), ...Object.keys(ob)])).sort();
    for (const k of khoa) {
      const d = timKhacBietDauTien(oa[k], ob[k], `${duong}.${k}`);
      if (d) return d;
    }
    return null;
  }
  return `${duong} (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── SINH + GHI FIXTURE ────────────────────────────────────────────────────

interface GoldenFixture {
  chup_tai_commit: string;
  ma_tran: {
    phien_ban: readonly string[];
    co_map: readonly number[];
    so_ghe: readonly number[];
    so_seed: number;
    so_hanh_vi: number;
  };
  tong_tran: number;
  sweep: Record<string, string>;
  deep: {
    key: string; phien_ban: string; co_map: number; so_ghe: number;
    seed_idx: number; seed: number; hanh_vi_idx: number; vong_dat_duoc: number;
    digest: unknown;
  }[];
  /** B5 (docs/nhat-ky/D221.md) — 11 trận THẬT của founder, xem "TRẬN THẬT" ở trên. */
  that: {
    nguon: string;
    /** Sao chép từ `holdem_tran_that.json` lúc sinh — CHỈ để tham khảo nhanh; nguồn
     *  chân lý của cờ này vẫn là chính tệp đó (`scripts/lay_tran_that.ts --kiem`). */
    da_doi_chieu_prod: boolean;
    tong_tran: number;
    sweep: Record<string, string>;
    deep: { key: string; phien_ban: string; seed: number; so_o: number | null; digest: unknown }[];
  };
}

function chupHead(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * Chạy TOÀN BỘ ma trận. Ném lỗi NGAY (không bắt) nếu một ô throw khi generate
 * — "Guard: fail loudly ... never silently skip". Người gọi (main CLI dưới)
 * bọc try/catch NGOÀI CÙNG để in seed/version/map/ghế rồi thoát khác 0.
 */
function sinhToanBo(): GoldenFixture {
  const sweep: Record<string, string> = {};
  const deep: GoldenFixture['deep'] = [];
  for (const o of moiO()) {
    let ket: { r: ReturnType<typeof replay>; vongDatDuoc: number };
    try {
      ket = chayMotTran(o.coMap, o.soGhe, o.seed, o.phienBan, o.hanhViIdx);
    } catch (err) {
      throw new Error(
        `SINH FIXTURE LỖI ở map=${o.coMap} ghế=${o.soGhe} seed=${o.seed} `
        + `(seedIdx=${o.seedIdx}) phiên_bản=${o.phienBan} hanhViIdx=${o.hanhViIdx}: `
        + `${(err as Error).message}\n${(err as Error).stack ?? ''}`);
    }
    const digest = canon(trichXuat(ket.r));
    sweep[o.key] = fnv1a(JSON.stringify(digest));
    if (DEEP_KEYS.has(o.key)) {
      deep.push({
        key: o.key, phien_ban: o.phienBan, co_map: o.coMap, so_ghe: o.soGhe,
        seed_idx: o.seedIdx, seed: o.seed, hanh_vi_idx: o.hanhViIdx,
        vong_dat_duoc: ket.vongDatDuoc, digest,
      });
    }
  }
  const oList = moiO();

  // ── B5 — TRẬN THẬT: cùng nếp trên, KHÔNG đường digest thứ hai (D61) ──────
  const thatRaw = taiThatRaw();
  const dsTranThat = thatRaw.tran.map(tranThatTuRaw);
  const thatSweep: Record<string, string> = {};
  const thatDeep: GoldenFixture['that']['deep'] = [];
  for (const t of dsTranThat) {
    let r: ReturnType<typeof replay>;
    try {
      r = chayMotTranThat(t);
    } catch (err) {
      throw new Error(
        `SINH FIXTURE (TRẬN THẬT) LỖI ở phiên_bản=${t.phienBan} seed=${t.seed}: `
        + `${(err as Error).message}\n${(err as Error).stack ?? ''}`);
    }
    const digest = canon(trichXuat(r));
    thatSweep[t.key] = fnv1a(JSON.stringify(digest));
    if (DEEP_KEYS_THAT.has(t.key)) {
      thatDeep.push({
        key: t.key, phien_ban: t.phienBan, seed: t.seed, so_o: t.soO ?? null, digest,
      });
    }
  }

  return {
    chup_tai_commit: chupHead(),
    ma_tran: {
      phien_ban: PHIEN_BAN_DO, co_map: CO_MAP, so_ghe: SO_GHE_CHON,
      so_seed: SO_SEED, so_hanh_vi: SO_HANH_VI,
    },
    tong_tran: oList.length,
    sweep,
    deep,
    that: {
      nguon: THAT_PATH,
      da_doi_chieu_prod: thatRaw.da_doi_chieu_prod,
      tong_tran: dsTranThat.length,
      sweep: thatSweep,
      deep: thatDeep,
    },
  };
}

const FIXTURE_PATH = path.join('tests', 'fixtures', 'holdem_replay_golden.json');

function ghiFixture(): void {
  const t0 = process.hrtime.bigint();
  const data = sinhToanBo();
  const t1 = process.hrtime.bigint();
  mkdirSync(path.join('tests', 'fixtures'), { recursive: true });
  writeFileSync(FIXTURE_PATH, JSON.stringify(data));
  const ms = Number(t1 - t0) / 1e6;
  console.log(`✓ golden: ${data.tong_tran} trận synthetic × ${data.ma_tran.phien_ban.length} `
    + `balance_version, ${data.deep.length} deep snapshot — sinh trong ${ms.toFixed(0)}ms`);
  console.log(`  + ${data.that.tong_tran} trận THẬT (B5), ${data.that.deep.length} deep snapshot`
    + (data.that.da_doi_chieu_prod ? '' : ' — ⚠ nguồn CHƯA đối chiếu máy với prod '
      + '(da_doi_chieu_prod=false trong holdem_tran_that.json — chạy '
      + '"npx tsx scripts/lay_tran_that.ts --kiem" với env prod để xác nhận)'));
  console.log(`  ghi ${FIXTURE_PATH}`);
  console.log(`  chup_tai_commit=${data.chup_tai_commit}`);
}

/** Chế độ `--kiem`: sinh lại toàn ma trận, SO với fixture đã lưu, KHÔNG ghi đè. */
function kiemTraVoiFixture(): boolean {
  let golden: GoldenFixture;
  try {
    golden = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as GoldenFixture;
  } catch (err) {
    console.error(`✗ Không đọc được fixture tại ${FIXTURE_PATH}: ${(err as Error).message}`);
    console.error('  (chạy "npx tsx scripts/holdem_replay_golden.ts" — không có --kiem — để tạo lần đầu)');
    return false;
  }

  const t0 = process.hrtime.bigint();
  let soLoi = 0;
  let soDaKiem = 0;
  for (const o of moiO()) {
    let ket: { r: ReturnType<typeof replay>; vongDatDuoc: number };
    try {
      ket = chayMotTran(o.coMap, o.soGhe, o.seed, o.phienBan, o.hanhViIdx);
    } catch (err) {
      throw new Error(
        `KIỂM LỖI ở map=${o.coMap} ghế=${o.soGhe} seed=${o.seed} (seedIdx=${o.seedIdx}) `
        + `phiên_bản=${o.phienBan}: ${(err as Error).message}`);
    }
    soDaKiem += 1;
    const hash = fnv1a(canonStringify(trichXuat(ket.r)));
    const kyVong = golden.sweep[o.key];
    if (kyVong === undefined) {
      console.error(`✗ THIẾU trong fixture: ${o.key} (map=${o.coMap} ghế=${o.soGhe} `
        + `seed=${o.seed} phiên_bản=${o.phienBan})`);
      soLoi += 1;
      continue;
    }
    if (hash !== kyVong) {
      console.error(`✗ LỆCH HASH map=${o.coMap} ghế=${o.soGhe} seed=${o.seed} `
        + `(seedIdx=${o.seedIdx}) phiên_bản=${o.phienBan} — fixture=${kyVong} vừa_sinh=${hash} `
        + `(vòng đạt ${ket.vongDatDuoc}/${o.coMap})`);
      soLoi += 1;
    }
  }

  for (const d of golden.deep) {
    const { r } = chayMotTran(d.co_map, d.so_ghe, d.seed, d.phien_ban, d.hanh_vi_idx);
    const moi = JSON.parse(canonStringify(trichXuat(r))) as unknown;
    const duong = timKhacBietDauTien(moi, d.digest);
    if (duong) {
      console.error(`✗ DEEP LỆCH ${d.key} — field lệch đầu tiên: ${duong}`);
      soLoi += 1;
    }
  }

  // ── B5 — TRẬN THẬT: cùng --kiem, KHÔNG đường so sánh thứ hai (D61) ───────
  let soDaKiemThat = 0;
  if (!golden.that) {
    console.error('✗ Fixture thiếu khối `that` (trận THẬT, B5) — chạy lại '
      + '"npx tsx scripts/holdem_replay_golden.ts" (không --kiem) để sinh lại đủ.');
    soLoi += 1;
  } else {
    const dsTranThat = moiTranThat();
    for (const t of dsTranThat) {
      let r: ReturnType<typeof replay>;
      try {
        r = chayMotTranThat(t);
      } catch (err) {
        throw new Error(
          `KIỂM LỖI (TRẬN THẬT) ở phiên_bản=${t.phienBan} seed=${t.seed}: ${(err as Error).message}`);
      }
      soDaKiemThat += 1;
      const hash = fnv1a(canonStringify(trichXuat(r)));
      const kyVong = golden.that.sweep[t.key];
      if (kyVong === undefined) {
        console.error(`✗ THIẾU trong fixture (TRẬN THẬT): ${t.key} `
          + `(phiên_bản=${t.phienBan} seed=${t.seed})`);
        soLoi += 1;
        continue;
      }
      if (hash !== kyVong) {
        console.error(`✗ LỆCH HASH (TRẬN THẬT) phiên_bản=${t.phienBan} seed=${t.seed} `
          + `— fixture=${kyVong} vừa_sinh=${hash}`);
        soLoi += 1;
      }
    }
    for (const d of golden.that.deep) {
      const t = dsTranThat.find((x) => x.key === d.key);
      if (!t) {
        console.error(`✗ DEEP (TRẬN THẬT) ${d.key} — không còn trong holdem_tran_that.json`);
        soLoi += 1;
        continue;
      }
      const r = chayMotTranThat(t);
      const moi = JSON.parse(canonStringify(trichXuat(r))) as unknown;
      const duong = timKhacBietDauTien(moi, d.digest);
      if (duong) {
        console.error(`✗ DEEP LỆCH (TRẬN THẬT) ${d.key} — field lệch đầu tiên: ${duong}`);
        soLoi += 1;
      }
    }
  }

  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  if (soLoi === 0) {
    console.log(`✓ --kiem: ${soDaKiem} trận synthetic + ${golden.deep.length} deep + `
      + `${soDaKiemThat} trận THẬT + ${golden.that?.deep.length ?? 0} deep THẬT khớp fixture `
      + `(${ms.toFixed(0)}ms).`);
  } else {
    console.error(`✗ --kiem: ${soLoi} chỗ lệch / ${soDaKiem + soDaKiemThat} trận đã kiểm `
      + `(${ms.toFixed(0)}ms).`);
  }
  return soLoi === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── CLI ENTRY — chỉ chạy khi gọi TRỰC TIẾP, không chạy khi bị import ─────────
// Cùng idiom `isMain` đã dùng ở scripts/migrate.ts, scripts/audit_supply.ts,
// scripts/seed_dev.ts — BẮT BUỘC ở đây vì tests/holdem_replay_golden.test.ts
// IMPORT các hàm thuần của tệp này (`moiO`/`chayMotTran`/...); thiếu guard này
// thì mỗi lần vitest nạp module là một lần sinh 360 trận (hoặc tệ hơn, ghi đè
// fixture) làm side effect của một câu `import`.
const isMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMain) {
  const KIEM = process.argv.includes('--kiem');
  try {
    if (KIEM) {
      const ok = kiemTraVoiFixture();
      process.exit(ok ? 0 : 1);
    } else {
      ghiFixture();
      process.exit(0);
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}
