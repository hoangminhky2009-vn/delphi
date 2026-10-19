/**
 * TỪ VỰNG NGƯỜI CHƠI ĐỌC — NGUỒN CHÂN LÝ DUY NHẤT.
 *
 * Thay thế `lib/brand.ts` (đã gỡ 25/07/2026). Vì sao gộp về một file:
 * trước đó tên mode nằm ở brand.ts, nhãn hành động rải rác trong từng component,
 * và tên module chỉ tồn tại dưới dạng chuỗi gõ tay trong Hub. Ba nguồn = ba chỗ
 * lệch nhau, và đã lệch thật: brand.ts đổi thành "ALPHA DRAFT" ngày 20/07 mà
 * ArenaLobby.tsx:77 vẫn render "đấu trường quant" suốt 5 ngày.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LUẬT D26 — cột phải của bảng 1.1 là THỨ DUY NHẤT được render.
 *
 * Codename nội bộ (Market Hold'em, Alpha Draft, Quant Poker) được phép tồn tại
 * trong code và tài liệu thiết kế, NHƯNG KHÔNG BAO GIỜ lên màn hình. File này là
 * ranh giới: bên trong repo gọi gì cũng được, ra tới người chơi thì đi qua đây.
 *
 * ⚠ D91 (16/08, chỉ thị founder): ban-list D26 và `lint:lexicon` ĐÃ GỠ — chữ
 * casino/poker (chip, pot, cược, all-in…) KHÔNG còn bị cấm. Bảng từ vựng quỹ ở
 * đây vẫn là giọng MẶC ĐỊNH và là nguồn duy nhất của tên mode/nhãn — chỉ luật
 * "cấm" mất, luật "một nguồn" còn.
 *
 * ⚠ ĐỔI THƯƠNG HIỆU: sửa ĐÚNG file này. Mọi màn import từ đây, cấm gõ tay.
 */

// ══════════════════════════════════════════════════════════════════════════
// TÊN MODULE — 4 mảng của app + 1 mảng khóa
// ══════════════════════════════════════════════════════════════════════════

/**
 * Tên mode đấu. ⚠ ĐÃ ĐẢO CHIỀU HAI LẦN — đọc cả ba dòng trước khi sửa lần nữa:
 *   · 20/07 brand.ts đặt "ALPHA DRAFT";
 *   · 25/07 founder loại khỏi lớp render, lý do là optics D22 (chữ "Alpha" nghe
 *     như bán alpha thật) → khóa thành "Đấu trường";
 *   · 07/09 founder đảo lại: Alpha Draft là CỐT LÕI vòng lặp mới, nên nó phải
 *     mang đúng tên đó ở lớp người chơi đọc.
 * Optics D22 KHÔNG tự mất khi đổi tên — nó chuyển thành câu phải hỏi luật sư,
 * vì A10 là ranh KHÔNG dẻo (A11.17). ✔ Câu ấy ĐÃ VÀO TỜ HỎI (08/09, D308):
 * `docs/phap-ly/hoi-luat-su.md` §3.7 — trước D308 nó chỉ nằm trong chú thích
 * này, tức ở một chỗ không ai mang đi gặp luật sư.
 * Đổi thương hiệu lần sau: sửa ĐÚNG dòng này.
 */
export const NAME_ARENA = 'Alpha Draft';
export const NAME_ARENA_UPPER = 'ALPHA DRAFT';

/** Mặt chợ dự báo — mảng đẻ ra token T thật của hệ. */
export const NAME_PREDICT = 'Predict Market';
export const NAME_PREDICT_UPPER = 'PREDICT MARKET';

/** Mảng quản lý tài chính cá nhân (module độc lập, giữ nguyên hiện trạng). */
export const NAME_FINANCE = 'Personal Finance';
export const NAME_FINANCE_UPPER = 'PERSONAL FINANCE';

/** Phòng lab dữ liệu — KHÓA, chỉ vỏ (C1: hạ tầng 0đ, chưa có chỗ chạy). */
export const NAME_LAB = 'Oracle Lab';
export const NAME_LAB_UPPER = 'ORACLE LAB';

/** Khối hồ sơ trung tâm ở Sảnh + thang tiến trình dẫn xuất. */
export const NAME_CORE = 'ORACLE CORE';
export const NAME_LEVEL = 'Oracle Level';

// ══════════════════════════════════════════════════════════════════════════
// TAGLINE — một dòng dưới mỗi card ở Sảnh
// ══════════════════════════════════════════════════════════════════════════

/**
 * ⚠ CHỈ mặt Dự báo được nói "Earn Token" — vì chỉ nó đẻ ra T thật.
 * Card Đấu trường CẤM chữ đó (chỉ đạo founder 25/07 §1.2): trận không bao giờ
 * đẻ T hay Q, thứ duy nhất rời trận là thứ hạng. Hứa token trên card đấu là
 * quảng cáo sai và là mầm của chính đường nối mà tường lửa A3.5 cấm.
 */
export const TAGLINE_PREDICT = 'Forecast • Earn Token';
export const TAGLINE_ARENA = 'Draft • Climb Rank';
export const TAGLINE_FINANCE = 'Track • Plan • Review';
export const TAGLINE_LAB = 'Analyze • Insight';

/** Mô tả tiếng Việt một dòng — A8.8: chữ giải thích luôn là tiếng Việt. */
export const DESC_PREDICT = 'Phân bổ token vào câu hỏi kinh tế, đoán đúng thì chia pool.';
export const DESC_ARENA = 'Lật thẻ thị trường, dựng danh mục, chốt phiên — ai đọc thị trường giỏi hơn.';
// Founder 11/10 (chọn A): Tài chính cá nhân ghi TIỀN THẬT, không phải dòng token — câu 08/08 cũ nói nhầm đối tượng.
export const DESC_FINANCE = 'Ghi thu chi tiền thật · hiểu thói quen tiền của bạn.';
export const DESC_LAB = 'Mổ xẻ dữ liệu vĩ mô cùng Oracle.';

// ══════════════════════════════════════════════════════════════════════════
// BẢNG 1.1 — HAI NGUỒN TÀI NGUYÊN TRONG TRẬN
// ══════════════════════════════════════════════════════════════════════════

/** Vốn giao dịch trong trận. Reset mỗi trận, KHÔNG rời trận (tường lửa A3.5). */
export const T_VON = 'Vốn';
export const T_VON_UPPER = 'VỐN';

/** Lượt làm mới quầy thẻ. Tên tránh va chạm với 🥇 Vàng (một tài sản). */
export const T_LUOT_KHAO_SAT = 'Lượt khảo sát';

/** Vốn tranh chấp mỗi vòng. */
export const T_QUY_VONG = 'Quỹ vòng';
export const T_QUY_VONG_UPPER = 'QUỸ VÒNG';

// ══════════════════════════════════════════════════════════════════════════
// BẢNG 1.1 — HÀNH ĐỘNG NGƯỜI CHƠI
// ══════════════════════════════════════════════════════════════════════════

export const T_TAI_CO_CAU = 'Tái cơ cấu';
export const T_TAI_CO_CAU_UPPER = 'TÁI CƠ CẤU';
export const T_GIU_NGUYEN = 'Giữ nguyên';
export const T_KHAO_SAT_LAI = 'Khảo sát lại';

/**
 * LÕI VỐN B — cam kết nắm giữ một mã suốt chu kỳ khoá.
 *
 * ⚠ CỐ Ý KHÔNG gọi là "Giữ vị thế": `T_GIU_VI_THE` đã là hành động VÒNG CƯỢC
 * (vào vòng, không tăng tỷ trọng). Hai thứ khác hẳn nhau, và dùng chung một chữ
 * là người chơi đọc nút này tưởng mình đang chọn mức cam kết của vòng.
 *
 * Và KHÔNG gọi việc bỏ giữa chừng là "bẻ kèo" như codename trong engine: "kèo"
 * ở app này là một câu hỏi dự báo bên mặt Predict Market (A1), mượn sang đây là
 * trộn hai mảng vào nhau ngay trong một chữ.
 */
export const T_KHOA_NAM_GIU = 'Khoá nắm giữ';
export const T_KHOA_NAM_GIU_UPPER = 'KHOÁ NẮM GIỮ';
export const T_PHA_CAM_KET = 'Phá cam kết';
export const T_PHA_CAM_KET_UPPER = 'PHÁ CAM KẾT';

/**
 * NGÂN HÀNG / SỔ TIẾT KIỆM (v43) — cần gạt vốn THAY CHỖ `T_KHOA_NAM_GIU` ngay
 * trên. Từ v43 hai thứ không bao giờ cùng sống trên một bàn.
 *
 * ⚠ CỐ Ý dùng đúng chữ đời thường — "gửi tiết kiệm", "sổ", "đáo hạn", "huỷ
 * trước hạn". Đây là một trong số ít cơ chế của trò có bản sao 1:1 ngoài đời mà
 * người chơi 16–30 ĐÃ biết trước khi mở app; đặt một cái tên game cho nó là vứt
 * đi vốn hiểu biết có sẵn và bắt họ học lại từ đầu.
 *
 * ⚠ KHÔNG gọi là "Gửi ngân hàng" ở nhãn nút: nút là hành động của vòng này
 * ("CHỌN GỬI"), còn `T_NGAN_HANG` là tên VÙNG trên bàn. Trộn hai vai vào một
 * chữ là chỗ `T_GIU_VI_THE` đã suýt trả giá.
 */
export const T_NGAN_HANG = 'Ngân hàng';
export const T_NGAN_HANG_UPPER = 'NGÂN HÀNG';
export const T_SO_TIET_KIEM = 'Sổ';
export const T_SO_TIET_KIEM_UPPER = 'SỔ';

/** Vào vòng, không tăng tỷ trọng. */
export const T_GIU_VI_THE = 'Giữ vị thế';
export const T_GIU_VI_THE_UPPER = 'GIỮ VỊ THẾ';

/** Tăng tỷ trọng / niềm tin. */
export const T_TANG_CAM_KET = 'Tăng cam kết';
export const T_TANG_CAM_KET_UPPER = 'TĂNG CAM KẾT';

/** Rút khỏi vòng, về tiền mặt. */
export const T_CAT_LO = 'Cắt lỗ';
export const T_CAT_LO_UPPER = 'CẮT LỖ';

/**
 * D302 — HƯỚNG LỆNH ở trận NAV (dải đối thủ). Máy cược tắt từ v10a nên hai nhãn
 * GIỮ VỊ THẾ / TĂNG CAM KẾT đứng im cả trận; đây mới là "stand/hit" của trận NAV:
 * VÀO (mua / mở khống) · RA (bán / đóng khống) · ĐẢO (vừa vào vừa ra) · ĐỨNG
 * (không lệnh). Ngắn vì ô ghế hẹp tới 45px ở bàn 8 người.
 */
export const T_HUONG_LENH_UPPER = {
  vao: 'VÀO', ra: 'RA', dao: 'ĐẢO', dung: 'ĐỨNG',
} as const;

/**
 * Dồn toàn bộ Vốn.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 26/07/2026 — QUAY LẠI "All-in" theo quyết định founder.
 *
 * Lịch sử để khỏi ai lật đi lật lại: 25/07 founder thêm "all in"/"all-in" vào
 * ban-list D26, nhãn đổi thành "DỒN HẾT VỐN". Nhưng 11 ký tự ở cỡ 26px làm vỡ ô
 * hiển thị mức cam kết (chữ dạt trái). Tôi sửa GỐC — khung cố định canh giữa, xem
 * `BetBar.module.css` — rồi nêu rằng đổi chữ lại sẽ vỡ lint fail-closed. Founder
 * cân nhắc và chọn gỡ hai chuỗi khỏi ban-list.
 *
 * ⚠ Bố cục đã sửa nên KHÔNG PHỤ THUỘC độ dài nhãn nữa: đổi chữ lần sau, dài ngắn
 * bao nhiêu, ô vẫn canh giữa. Đừng suy ngược rằng "phải dùng chữ ngắn".
 *
 * Là MỘT CHẾ ĐỘ RIÊNG, không phải mức 100%: xem BetBar.tsx docstring, lỗi
 * "bấm dồn hết mà thanh ra 60%" founder báo ba lượt liền.
 */
export const T_DON_HET = 'All-in';
export const T_DON_HET_UPPER = 'ALL-IN';

// ══════════════════════════════════════════════════════════════════════════
// BẢNG 1.1 — TRẠNG THÁI & VẬT
// ══════════════════════════════════════════════════════════════════════════

export const T_CHOT_PHIEN = 'Chốt phiên';
export const T_CHOT_PHIEN_UPPER = 'CHỐT PHIÊN';

/** Thuật ngữ trading thật, không phải tiếng casino. */
export const T_CHAY_TK = 'Cháy tài khoản';
export const T_CHAY_TK_SHORT = 'CHÁY';

/** Portfolio. */
export const T_DANH_MUC = 'Danh mục';
export const T_DANH_MUC_UPPER = 'DANH MỤC';

export const T_BOI_CANH = 'Bối cảnh';
export const T_THE_THI_TRUONG = 'Thẻ thị trường';

/** Lá tin bịa — là TIN, không phải quân bài. */
export const T_TIN_GIA = 'TIN GIẢ';

/** Đứng ngoài / đầu hàng — hai nhánh của Cắt lỗ (founder 20/07). */
export const T_DUNG_NGOAI = 'Đứng ngoài';
export const T_DAU_HANG = 'Đầu hàng';

// ══════════════════════════════════════════════════════════════════════════
// ROUTE — hằng số, không gõ tay path
// ══════════════════════════════════════════════════════════════════════════

/**
 * Gốc route mode đấu. `/arena` chứ không phải `/dau-truong`: path sau đang bị
 * loop CŨ (12 vòng) chiếm và KHÔNG được gỡ — điều kiện gỡ là sau khi founder
 * chốt playtest gate D24 mục 12 (Cổng 1). Hai mode cùng path là gãy điều hướng.
 *
 * `/alpha-draft` (tên cũ) redirect về đây — link cũ founder đã mở không được chết.
 */
export const ROUTE_ARENA = '/arena';
/** Phòng HƯỚNG DẪN cho người mới (founder 02/08) — đứng trong sảnh Đấu trường. */
export const ROUTE_ARENA_GUIDE = '/arena/huong-dan';

/**
 * Bàn đấu ĐỊA CHỈ HOÁ THEO matchId.
 *
 * ⚠ Trước 25/07 route là `/arena/tran` không tham số, và màn tự TẠO trận trong
 * `useEffect`. Hai hậu quả thật:
 *   1. tải lại trang giữa trận = TẠO TRẬN MỚI, mất trận đang chơi;
 *   2. màn treo vĩnh viễn ở skeleton khi callback của `mutate` bị react-query bỏ
 *      (StrictMode dọn observer) — POST trả 201 mà không có gì hiển thị.
 * Địa chỉ hoá theo id chữa cả hai: sảnh tạo trận rồi điều hướng, bàn đấu chỉ ĐỌC
 * theo id. Cùng lối loop cũ `/dau-truong/tran/:matchId` vốn đã đúng.
 */
export const ROUTE_ARENA_MATCH_MAU = '/arena/tran/:matchId';
export const duongDanTran = (matchId: string) => `/arena/tran/${matchId}`;

/** Mặt Dự báo: giữ nguyên `/du-bao` vì nó LÀ gốc module, không phải tab bị xóa. */
export const ROUTE_PREDICT = '/du-bao';

/**
 * Tham số lọc trạng thái của module Dự báo (`?tt=chot` = lớp "đã chốt").
 * Redirect từ tab Kết quả cũ mang theo nó, nên link/thông báo cũ vẫn hạ cánh
 * đúng chỗ người ta mong đợi.
 *
 * ⚠ Đặt ở đây chứ KHÔNG ở `app/routes.tsx`: routes.tsx import màn PredictMarket,
 * nên màn đó import lại hằng số từ routes.tsx là IMPORT VÒNG. Vite gói được
 * nhưng một trong hai module sẽ thấy `undefined` lúc khởi tạo — lỗi chạy, không
 * lỗi biên dịch.
 */
export const PREDICT_TAB_PARAM = 'tt';
export const PREDICT_TAB_DONE = 'chot';
export const PREDICT_POOL_PARAM = 'pool';

/** Tab Token giữ path `/vi` — 5 chỗ link cứng + chấm đỏ trợ cấp neo vào chuỗi này. */
export const ROUTE_TOKEN = '/vi';
export const ROUTE_SHOP = '/shop';
/** Trang Hành trình mùa — BP + nhiệm vụ (founder 01/08, kiểu TFT/LOL). */
export const ROUTE_HANH_TRINH = '/hanh-trinh';
export const ROUTE_PROFILE = '/ho-so';
/**
 * THẺ TÍNH CÁCH ĐO TỪ TRẬN — radar sáu chỉ số · khẩu vị × nét · dòng token.
 *
 * ⚠⚠ NHÀ MỚI TỪ 21/09 (chỉ thị founder: *"Thẻ tính cách từ alpha draft thì vẫn giữ nguyên
 * nhưng để trên profile còn thẻ PFM thì riêng nhé"*). Trước đó màn này sống ở
 * `/tai-chinh/the`, tức thẻ ĐO TỪ ĐẤU TRƯỜNG nằm trong thanh tab của PFM và được giới
 * thiệu ở `Profile` dưới nhãn "TÀI CHÍNH CÁ NHÂN" — hai thẻ khác nguồn bị đọc thành một.
 *
 * RANH GIỚI TỪ NAY LÀ **NGUỒN BẰNG CHỨNG**, không phải chủ đề:
 *   · `/ho-so/the`      — ĐO từ hành vi trong trận (bằng chứng mạnh, cần đã chơi)
 *   · `/tai-chinh/the`  — chân dung PFM: LỜI KHAI ở phỏng vấn + sau này là sổ thật
 * Hai thứ đều nói về tiền, nên gộp chỗ là mời người đọc tin lời khai ngang hành vi đã đo.
 *
 * Nội dung màn KHÔNG đổi một dòng — chỉ đổi nhà (founder: *"vẫn giữ nguyên"*).
 * Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_PROFILE_THE = '/ho-so/the';
/** Tài chính cá nhân — hồ sơ Tính cách tài chính (04 §3, founder 08/08). */
export const ROUTE_TAI_CHINH = '/tai-chinh';
/** Cài đặt — giọng hồ sơ tính cách (D106, founder 22/08). */
/**
 * Khu TÀI CHÍNH đi theo route PHẲNG, không lồng (chốt founder 04/09: PFM nằm CHUNG khu
 * `/tai-chinh`, không tab riêng ở BottomNav). Mỗi màn tự vẽ dải tab ở đầu.
 * ⚠ Thêm route ở đây thì phải thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — có bài canh đẳng
 *   thức giữa hai danh sách ấy (`web/tests/telemetry.test.ts`).
 */
export const ROUTE_TAI_CHINH_SO = '/tai-chinh/so';
/** Màn HŨ MỤC TIÊU — cùng khu phẳng với SỔ (D277). Thêm route thì thêm ở `routes.tsx` VÀ
 *  `MAN_HOP_LE` — xem chú thích của `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_HU = '/tai-chinh/hu';
/** Màn GƯƠNG — chỉ số + hai bảng chi tiết + luật nếu-thì + chốt sổ tuần (demo `#manGuong`).
 *  Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem chú thích của `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_GUONG = '/tai-chinh/guong';
/**
 * Màn CHÂN DUNG PFM — hành tinh suy từ ba câu ĐO của phỏng vấn (`chan_dung_hanh.ts`).
 *
 * ⚠⚠ ĐỊA CHỈ NÀY ĐỔI CHỦ 21/09. Tới 20/09 nó là màn thẻ ĐO TỪ TRẬN (`TaiChinh.tsx`), nay
 * màn ấy về `ROUTE_PROFILE_THE` — xem chú thích dài ở đó về vì sao tách theo NGUỒN BẰNG
 * CHỨNG. Giữ nguyên đường `/tai-chinh/the` cho thẻ PFM là cố ý: thanh tab PFM đã có ô THẺ,
 * và ô ấy từ nay trỏ vào thứ thuộc về PFM thật.
 *
 * ⚠ Link cũ tới đây (sau trận · cài đặt · profile) đã được trỏ lại `ROUTE_PROFILE_THE` —
 * chúng nói về thẻ GAME. Ai còn bookmark đường cũ sẽ thấy chân dung PFM, không phải 404.
 * Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_THE = '/tai-chinh/the';
/**
 * Màn PHỎNG VẤN cửa vào (08/09) — sáu câu chạm-là-xong, theo demo `#man-pv` của
 * `docs/ui-ux/demo/pfm-lo-trinh.html`. Founder: hiện NGAY LẦN ĐẦU bấm PFM.
 * Có địa chỉ riêng để mở lại được sau, không chỉ là một trạng thái của cửa.
 * Thêm route thì thêm ở `routes.tsx` VA `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_PHONG_VAN = '/tai-chinh/phong-van';
/**
 * LỘ TRÌNH và CAM KẾT — hai chặng sau phỏng vấn (demo `#man-lt` / `#man-ck`).
 * Chuỗi founder chốt 08/09: PHỎNG VẤN -> LỘ TRÌNH -> CAM KẾT -> SỔ.
 * Thêm route thì thêm ở `routes.tsx` VA `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_LO_TRINH = '/tai-chinh/lo-trinh';
export const ROUTE_TAI_CHINH_CAM_KET = '/tai-chinh/cam-ket';
/**
 * NGÀY ĐẦU — chân dung + ba việc hôm nay + thanh "mức độ hiểu bạn" (D355/D356, GIAI ĐOẠN A).
 * Theo demo `docs/ui-ux/demo/pfm-ngay-dau.html` màn `cd`/`viec`. Từ D355 đây là đích MỚI
 * sau khi phỏng vấn xong (thay LỘ TRÌNH cũ) — LỘ TRÌNH vẫn sống, vẫn tới được từ ⚙.
 * Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`. */
export const ROUTE_TAI_CHINH_NGAY_DAU = '/tai-chinh/ngay-dau';

export const ROUTE_CAI_DAT = '/cai-dat';
export const ROUTE_HUB = '/';

/**
 * MẶT QUẢN TRỊ (bước 3, founder chốt phương án A ngày 03/08).
 *
 * ⚠ KHÔNG đặt ở `/admin`, và đó là quyết định chứ không phải tuỳ tiện đặt tên.
 * `/admin` hôm nay bị chặn ở HAI TẦNG độc lập để luôn ra tới trang Hono
 * server-render: `run_worker_first` trong `wrangler.jsonc` và
 * `navigateFallbackDenylist` trong `vite.config.ts` (bug thật 19/07 — service
 * worker trả index.html từ cache nên request chưa bao giờ ra tới mạng).
 * Trang đó là ĐƯỜNG THOÁT khi bản build của `web/` hỏng. Cho SPA chiếm `/admin`
 * là giết đúng cánh cửa sinh ra để phòng cái hỏng ấy — nên nó ở lại nguyên vẹn,
 * và mặt mới đứng ở một đường khác.
 */
export const ROUTE_QUAN_TRI = '/quan-tri';

/**
 * D333 — MÀN ĐIỀU PHỐI BUỔI ĐO: tạo bàn · chia sẻ link · đếm người · đóng · bức tranh nhóm. Chỉ người có cờ
 * `la_dieu_phoi` dùng được (server canh); người khác mở vào thấy một câu nói thẳng như vậy.
 * Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`.
 */
export const ROUTE_BUOI_DO = '/buoi-do';

/**
 * D334 — BÁCH KHOA: danh sách mục + trang từng mục. Cửa vào chính là icon cuốn sách ở sảnh Đấu trường (founder
 * 14/09: *"bách khoa thành cái icon cuốn sách ở màn hình hub của alpha draft"*). Đọc được khi chưa đăng nhập —
 * phần số luật và "bạn đã gặp" chỉ hiện khi có phiên.
 * Thêm route thì thêm ở `routes.tsx` VÀ `MAN_HOP_LE` — xem `ROUTE_TAI_CHINH_SO`.
 */
export const ROUTE_BACH_KHOA = '/bach-khoa';
export const ROUTE_BACH_KHOA_MUC_MAU = '/bach-khoa/:mucId';
export function duongBachKhoa(mucId: string): string {
  return `${ROUTE_BACH_KHOA}/${encodeURIComponent(mucId)}`;
}

/**
 * Loop CŨ 12 vòng — NGHỈ HƯU, không hồi sinh (founder 25/07 §0).
 * Route còn sống để founder gõ URL chạy Cổng 1; KHÔNG có cửa vào từ UI.
 * ĐIỀU KIỆN GỠ: sau khi Cổng 1 (playtest) chốt.
 */
export const ROUTE_LEGACY = '/dau-truong';
