/**
 * Tham số auth (KHÔNG phải tham số kinh tế — A4 nằm ở config/economy.ts).
 * Đổi giá trị ở đây là quyết định kỹ thuật; đổi AGE_GATE_MIN phải qua economy.ts + founder.
 */
export const AUTH = {
  /** Argon2id — tham số OWASP tối thiểu (19 MiB, 2 vòng, song song 1). */
  ARGON2: {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  },

  /** Mật khẩu: dài tối thiểu 8 (founder chốt 18/07/2026 — 10 dài quá;
   * NIST: ưu tiên độ dài, không ép ký tự đặc biệt). */
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 200,

  /** Phiên đăng nhập sống 30 ngày (F5/đóng mở trình duyệt vẫn còn). */
  SESSION_TTL_DAYS: 30,
  SESSION_COOKIE: 'delphi_session',

  /**
   * D444 (28/09) — DỌN KHÁCH BỎ HOANG: số khách tối đa `donKhachBoHoang()` xử lý
   * MỖI LƯỢT (`server/auth/don_khach.ts`, gọi từ tick mỗi phút).
   *
   * ⚠ VÌ SAO 20, ví dụ có số: tick chạy mỗi phút ⇒ trần 20/lượt = tối đa 28.800/ngày
   * (20 × 60 × 24) — vượt xa REGISTER_MAX_PER_IP (5/giờ) nên không bao giờ là nút
   * thắt thật. Mỗi khách tốn khoảng 8 câu SQL (khoá dòng, kiểm lại events, gỡ
   * avatar_dang_mac, xoá avatar_so_huu/auth_accounts/users, ghi sổ đếm) ⇒ ≤160 câu
   * SQL/lượt tick — nằm gọn trong ngân sách 10 giây của hàm serverless (C1/D11),
   * cùng cỡ với các bước dọn khác đã có trong cùng lượt tick (purge sessions/attempts).
   *
   * KHÔNG đặt tuổi tối thiểu ở đây làm hằng số riêng — dùng thẳng `SESSION_TTL_DAYS`
   * (một nguồn, A11.5): khách hết đường quay lại ĐÚNG lúc phiên của họ chết, không
   * sớm hơn, không cần một con số tuổi thứ hai phải nhớ giữ đồng bộ với nó.
   */
  KHACH_DON_MOI_LUOT: 20,

  /** Token verify email / reset mật khẩu. */
  VERIFY_TOKEN_TTL_HOURS: 24,
  RESET_TOKEN_TTL_HOURS: 2,

  /** Rate limit (GĐ2 việc 6 + nghiệm thu "10 lần sai liên tiếp → chặn tạm"). */
  LOGIN_MAX_FAILS: 10,
  LOGIN_FAIL_WINDOW_MINUTES: 15,
  LOGIN_LOCK_MINUTES: 15,
  REGISTER_MAX_PER_IP: 5,
  /**
   * Trần chung cho luồng KHÔNG xác thực được IP = hệ số này × trần theo IP.
   * Rộng hơn trần một IP (để proxy hỏng thì người thật vẫn còn cửa hẹp mà đi),
   * nhưng HỮU HẠN (để kẻ xoay IP không có hạn mức vô tận). Xem `tieuHanMucIp`.
   */
  KHONG_TIN_HE_SO: 4,
  /**
   * QUÊN MẬT KHẨU — mỗi lần gọi là một email THẬT qua SMTP dùng chung.
   * Đếm cả theo IP lẫn theo email: chỉ IP thì kẻ xoay IP vẫn dội thư vào một
   * nạn nhân; chỉ email thì ai cũng khoá được đường reset của người khác.
   */
  QUEN_MK_MAX_PER_IP: 5,
  QUEN_MK_MAX_PER_EMAIL: 3,
  QUEN_MK_WINDOW_PHUT: 60,
  /**
   * B9 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — số lần gõ MẬT KHẨU HIỆN TẠI ở `/account/password` + `/account/delete`,
   * CHUNG một xô theo tài khoản (`mk:<account_id>`). 5/15 phút: người thật gõ nhầm vài lần vẫn còn suất; kẻ cầm được
   * phiên (máy mượn) không dò được mật khẩu. Số kỹ thuật agent đặt, founder đổi được.
   */
  MAT_KHAU_THU: { MAX: 5, CUA_SO_PHUT: 15 },
  /**
   * B14 — trần thân request toàn cục cho `/api/*`, đọc `content-length` (KHÔNG tiêu luồng — bài học 12/08 ở
   * `server/app.ts`). 256 KB: thân lớn nhất app gửi hợp lệ là lát PFM 64 KB (`PFM_LO.THAN_TOI_DA`); các trần riêng
   * từng route vẫn chặt hơn. Số kỹ thuật agent đặt, founder đổi được.
   */
  THAN_TOI_DA_BYTE: 256 * 1024,
  REGISTER_WINDOW_HOURS: 1,
  /**
   * D333 — ĐĂNG KÝ QUA LINK BÀN BUỔI ĐO: xô hạn mức theo BÀN, không theo IP.
   *
   * ⚠ Vì sao: một buổi đo chạy trong MỘT phòng học, cả lớp ra Internet qua MỘT IP (Wi-Fi trường),
   * nên trần `REGISTER_MAX_PER_IP` = 5/giờ chặn người thứ sáu ở đúng phút thứ mười lăm của buổi.
   * Nới trần IP cho cả app là nới cho kẻ dội thư đốt hạn ngạch SMTP; nới cho MỘT BÀN thì cần một mã
   * chỉ người điều phối tạo được, mã còn mở, và có trần riêng.
   * ⚠ Trần theo BÀN, trong một cửa sổ: lớp 12–40 người (hướng dẫn điều phối §1) + chỗ cho gõ sai,
   * age gate chặn (mọi lần thử đều tiêu suất, như đường IP). Mã lọt ra ngoài thì thiệt hại có đáy:
   * tối đa chừng này tài khoản/ngày, tới khi bàn đóng.
   */
  REGISTER_MAX_PER_BAN: 60,
  REGISTER_BAN_WINDOW_HOURS: 24,

  /** Handle người dùng (D8: tự chọn, unique, lọc từ bậy). */
  HANDLE_PATTERN: /^[a-z0-9_]{3,20}$/,

  /**
   * ĐỔI TÊN — trần số lần trong một cửa sổ (founder 04/08).
   *
   * ⚠ Đây là VAN CHỐNG SPAM, không phải hình phạt. Người mới đổi vài lần cho vừa
   * ý là chuyện bình thường và không được chặn; thứ cần chặn là đổi liên tục bằng
   * script, vì mỗi lần đổi là một lần THẢ TÊN CŨ RA cho người khác lấy.
   *
   * ⚠ CỐ Ý KHÔNG khắt khe hơn: đổi tên KHÔNG xoá được thành tích. `events`,
   * `holdem_results`, `rank_diem` đều neo `user_id`, nên không có đường "thua rồi
   * đổi tên cho sạch". Siết chặt là siết một mối lo không tồn tại.
   * Xem lại khi BXH công khai bật — lúc đó tên mới thành thứ đáng chiếm.
   */
  HANDLE_DOI_MAX: 5,
  HANDLE_DOI_WINDOW_HOURS: 24,

  /**
   * KHOÁ CỬA ADMIN (bản yêu cầu 01 §3; founder chốt 03/08).
   *
   * ⚠ Mấy con số này là ĐÁNH ĐỔI giữa an toàn và phiền toái, không phải hằng số
   * kỹ thuật. Nới ra thì phải nói được nới vì cái gì.
   */
  ADMIN: {
    /**
     * Quyền admin sống bao lâu kể từ lúc qua TOTP. Hết hạn thì phiên người chơi
     * VẪN CÒN — chỉ cửa admin đóng lại, mở lại bằng một mã nữa.
     * 60 phút: đủ dài cho một buổi resolve loạt kèo, đủ ngắn để một cái laptop
     * bỏ quên qua đêm không còn là cửa admin.
     */
    TTL_PHUT: 60,

    /**
     * Xác thực lại còn "tươi" bao lâu cho thao tác phá huỷ.
     * 5 phút: resolve mười kèo liên tiếp không phải rút điện thoại mười lần,
     * nhưng đứng dậy đi pha cà phê về là phải rút lại.
     */
    XAC_THUC_LAI_PHUT: 5,

    /** Sai mã TOTP liên tiếp → khoá tạm (chống dò mã 6 chữ số). */
    TOTP_MAX_SAI: 10,
    TOTP_CUA_SO_PHUT: 15,

    /**
     * Rate limit MỌI route `/api/v1/admin/*` — hiện đang KHÔNG CÓ GÌ (§0.3).
     * Ở đây `consumeLimit` ghi một dòng mỗi request là chấp nhận được, khác hẳn
     * telemetry: admin là MỘT người, không phải 500 người gộp lô mỗi 30 giây.
     */
    MAX_MOI_PHUT: 60,

    /**
     * Allowlist IP: tên biến môi trường, danh sách ngăn cách bởi dấu phẩy.
     * ⚠ VẮNG BIẾN ⇒ KHÔNG KHOÁ AI (fail-OPEN) — NGƯỢC với CORS, và là ngoại lệ
     * CÓ CHỦ Ý (§3.3): fail-closed ở đây nghĩa là founder tự nhốt mình ngoài
     * cửa mỗi lần đổi mạng, mà kèo thì có hạn và đang giữ token người chơi.
     */
    BIEN_ALLOWLIST: 'ADMIN_IP_ALLOWLIST',
  },
} as const;

/** Danh mục demographic (C7 — chỉ khoảng, không PII). */
export const DEMOGRAPHIC = {
  AGE_BANDS: ['16-17', '18-22', '23-30', '31-45', '46+'] as const,
  REGIONS: ['bac', 'trung', 'nam', 'khac'] as const,
  OCCUPATION_BANDS: ['hs_sv', 'van_phong', 'tu_do', 'khac'] as const,
} as const;

export type AgeBand = (typeof DEMOGRAPHIC.AGE_BANDS)[number];

/**
 * GIỌNG HỒ SƠ (D106) — `users.giong_ho_so`, CHECK ở migration 0043. `tu_dong` = suy
 * từ `age_band` (16–22 trẻ · 23–30 vừa · 31+ chững — luật ở `web/src/lib/tinh_cach.ts`).
 */
export const GIONG_HO_SO = ['tu_dong', 'tre', 'vua', 'chung'] as const;
export type GiongHoSo = (typeof GIONG_HO_SO)[number];
export type Region = (typeof DEMOGRAPHIC.REGIONS)[number];
export type OccupationBand = (typeof DEMOGRAPHIC.OCCUPATION_BANDS)[number];

/**
 * Chặn handle bậy/mạo danh. v0.1 giữ danh sách tối giản, mở rộng bằng commit sau
 * (cố ý không dùng thư viện lọc tiếng Anh: sai ngữ cảnh tiếng Việt nhiều hơn lợi).
 */
/**
 * ─── LỌC TÊN HIỂN THỊ — hai tầng, có lý do ─────────────────────────────────
 *
 * D25/R2 (19/07/2026): trước khi Market Hold'em hiện TÊN + AVATAR cho người lạ,
 * bộ lọc phải dùng được. Bản cũ (một danh sách + `includes`) hỏng CẢ HAI CHIỀU,
 * đo được:
 *
 *   CHẶN NHẦM:  account · success · vaccine · london · soccer · dmitri
 *               (vì 'cc' / 'lon' / 'dm' khớp như chuỗi con — trong app tài
 *                chính mà cấm đăng ký tên "account" thì hỏng thật)
 *   BỎ LỌT:     suckmydik · fuckyou · bitch · nigger · pussy · porn · hitler
 *               và toàn bộ leetspeak (sh1t, d1ck)
 *
 * Nên tách hai tầng theo ĐỘ MƠ HỒ của token, không theo ngôn ngữ:
 *
 *   TẦNG TỪ (EXACT)      — token ngắn/mơ hồ, chỉ chặn khi là NGUYÊN tên hoặc
 *                          nguyên một phần tách bởi '_'. Ví dụ 'anal' phải ở
 *                          đây: app tài chính chắc chắn có người tên "analyst".
 *                          'ass' cũng vậy — "assets" là từ nghiệp vụ.
 *                          'rape' cũng vậy — "grape" chứa nó.
 *   TẦNG CHUỖI CON (SUB) — token đủ dài/đặc thù để không đụng từ lành. Chặn ở
 *                          bất kỳ vị trí nào, SAU KHI đã chuẩn hoá leetspeak.
 *
 * Chuẩn hoá trước khi so: bỏ '_' (chống "s_u_c_k") và quy đổi số về chữ
 * (chống "sh1t", "d1ck", "f4g"). HANDLE_PATTERN chỉ cho a–z 0–9 '_' nên không
 * cần lo '@' hay '$'.
 *
 * KHÔNG bao giờ tuyên bố danh sách này "đủ" — nó chỉ chặn lớp lười nhất. Người
 * quyết tâm vẫn lách được; phòng tuyến thật là báo cáo + admin đổi tên.
 */

/** Token chặn khi là NGUYÊN tên, hoặc nguyên một phần tách bởi '_'. */
export const HANDLE_BLOCK_EXACT: readonly string[] = [
  // mạo danh hệ thống (ngắn, dễ đụng từ lành nếu quét chuỗi con)
  'root', 'mod', 'ceo', 'sys',
  // TÊN THƯƠNG HIỆU phải ở tầng TỪ, không phải chuỗi con: "dubao"/"hotro" là
  // từ tiếng Việt thông dụng ghép lại. Quét chuỗi con sẽ chặn "nguoi_du_bao"
  // — tên tự nhiên và đúng chủ đề app. Ở tầng từ thì "dubao_hotro" (mạo danh)
  // vẫn bị chặn vì 'dubao' là NGUYÊN một phần, còn "nguoi_du_bao" thì qua.
  'dubao', 'delphi', 'hotro', 'chinhthuc',
  // tục tiếng Việt viết tắt
  'dm', 'dmm', 'dcm', 'dkm', 'cmm', 'vcl', 'vkl', 'cc', 'ml', 'clm',
  'lon', 'buoi', 'dit', 'djt', 'cak', 'loz', 'cai', 'deo',
  // tiếng Anh NGẮN — bắt buộc ở tầng này vì đụng từ lành thông dụng:
  //   anal → analyst/analysis (app tài chính!) · ass → assets · cum → document
  //   tit  → title/petition   · rape → grape   · hoe → shoe · fag → (ít gặp)
  'anal', 'ass', 'cum', 'tit', 'hoe', 'fag', 'rape', 'damn',
];

/** Token chặn ở BẤT KỲ vị trí nào (sau chuẩn hoá). Chỉ token đủ đặc thù. */
export const HANDLE_BLOCK_SUBSTRING: readonly string[] = [
  // mạo danh
  'admin', 'administrator', 'moderator', 'support', 'system', 'official',
  // tục / thù ghét / khiêu dâm — đủ dài để không đụng từ lành
  'fuck', 'shit', 'cunt', 'dick', 'cock', 'pussy', 'bitch', 'whore', 'slut',
  'nigg', 'porn', 'penis', 'vagina', 'boob', 'wank', 'jizz', 'blowjob',
  'handjob', 'suckmy', 'rapist', 'raped', 'faggot', 'sex', 'orgasm',
  'masturb', 'incest', 'pedo', 'molest', 'hitler', 'nazi', 'retard',
];

/**
 * Chuẩn hoá tên trước khi so với danh sách chặn.
 * Bỏ dấu ngăn cách + quy số về chữ (leetspeak).
 */
export function normalizeHandleForCheck(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/_/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/8/g, 'b').replace(/9/g, 'g');
}

/** Quy số về chữ, GIỮ nguyên gạch dưới. */
function leet(handle: string): string {
  return handle
    .toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't')
    .replace(/8/g, 'b').replace(/9/g, 'g');
}

/**
 * Tên có dạng "tách từng ký tự" (s_u_c_k_m_y) — thủ thuật lách bộ lọc.
 *
 * CHỈ khi đó mới được gộp gạch dưới trước khi quét chuỗi con. Gộp vô điều kiện
 * là hỏng với tiếng Việt: "nguoi_du_bao" -> "nguoidubao" (dính 'dubao'),
 * "nguoi_se_xinh" -> "nguoisexinh" (dính 'sex'). Ghép âm tiết tiếng Việt vô
 * tình tạo ra từ cấm — chặn nhầm hàng loạt tên bình thường.
 */
function looksCharSplit(handle: string): boolean {
  const parts = handle.split('_').filter(Boolean);
  if (parts.length < 3) return false;
  const tong = parts.reduce((n, p) => n + p.length, 0);
  return tong / parts.length <= 2;
}

/** Lý do tên bị từ chối, hoặc null nếu hợp lệ. */
export function handleBlockReason(handle: string): string | null {
  const raw = leet(handle);                    // giữ '_'
  const merged = normalizeHandleForCheck(handle); // bỏ '_'
  const parts = raw.split('_').filter(Boolean);

  // Tầng TỪ: nguyên tên, hoặc nguyên một phần tách bởi '_'.
  // Cũng so với bản đã gộp, để "du_bao" (= tên app viết tách) vẫn bị bắt.
  for (const bad of HANDLE_BLOCK_EXACT) {
    if (raw === bad || merged === bad || parts.includes(bad)) return bad;
  }

  // Tầng CHUỖI CON: quét trên bản GIỮ gạch dưới. Chỉ gộp thêm khi tên có dạng
  // tách từng ký tự (xem looksCharSplit).
  const targets = looksCharSplit(handle) ? [raw, merged] : [raw];
  for (const bad of HANDLE_BLOCK_SUBSTRING) {
    if (targets.some((t) => t.includes(bad))) return bad;
  }
  return null;
}

/** @deprecated Giữ để mã cũ không vỡ; dùng handleBlockReason(). */
export const HANDLE_BLOCKLIST: readonly string[] = [
  ...HANDLE_BLOCK_EXACT, ...HANDLE_BLOCK_SUBSTRING,
];
