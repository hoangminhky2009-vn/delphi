/**
 * Backup đêm — xuất toàn bộ dữ liệu lõi ra GitHub (storage KHÁC vendor với
 * Supabase + Vercel; D11: "lỡ một nhà sập vẫn còn dữ liệu").
 *
 * Thiết kế (A8.9 — không khóa nhà cung cấp, logic tách khỏi trigger):
 *   - `collectBackup()` CHỈ ĐỌC DB (SELECT), không ghi gì → backup không bao giờ
 *     làm hỏng dữ liệu thật. Trả về buffer .json.gz + số dòng mỗi bảng.
 *   - `pushToGitHub()` là adapter mạng duy nhất. Đổi nơi lưu (R2, S3, GitHub
 *     Actions…) = viết adapter khác, KHÔNG đụng collectBackup.
 *   - Trigger hiện tại là Vercel cron gọi GET /internal/backup (vercel.json).
 *     Đổi trigger = đổi 1 dòng lịch, không đụng module này.
 *
 * Vì sao dump toàn bảng mỗi đêm (không incremental): MVP dữ liệu nhỏ (KB→MB),
 * ảnh chụp đầy đủ là bản khôi phục thảm họa đơn giản nhất, không cần lưu con trỏ
 * "đã backup tới đâu". Khi `events` phình lớn (nút cổ chai tương lai) → chuyển
 * export tăng dần bằng cách thêm mốc thời gian, KHÔNG phải viết lại logic.
 */
import zlib from 'node:zlib';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import pgLib from 'pg';
import type pg from 'pg';

/**
 * ⚠⚠ CỘT KIỂU `date` PHẢI RA CHUỖI `YYYY-MM-DD`, KHÔNG PHẢI `Date` (D364).
 *
 * Mặc định `pg` dựng cột `date` thành `Date` ở **nửa đêm GIỜ MÁY ĐANG CHẠY**, rồi
 * `JSON.stringify` gọi `toISOString()`. Hệ quả: cùng một dòng, backup do cron Vercel
 * (UTC) ghi ra `"2026-09-16T00:00:00.000Z"`, còn `npm run backup:push` chạy tay trên
 * máy ở VN (+07) ghi ra `"2026-09-15T17:00:00.000Z"` — **lùi một ngày**. Đã đo, không
 * phải suy luận.
 *
 * Tám cột đang chịu: `pfm_ngay.ngay` (chuỗi điểm danh), `pfm_tuan.tuan`, `pfm_luu.thang`,
 * `pfm_dac_trung.ky`, `telemetry_ngay/_nhom/_cuon.ngay`, `holdem_ban.ngay`. Đây là bản
 * khôi phục thảm hoạ: nội dung của nó KHÔNG được phụ thuộc vào máy nào bấm nút.
 *
 * Ghi đè CỤC BỘ theo từng câu (`QueryConfig.types`), không đụng `pg.types` toàn tiến
 * trình: đổi parser toàn cục là đổi kiểu trả về của mọi câu SQL trong server, một bản
 * vá backup không được phép làm thế.
 */
const OID_DATE = 1082;
const KIEU_BACKUP: pg.CustomTypesConfig = {
  getTypeParser: ((oid: number, format?: unknown) => (oid === OID_DATE
    ? (v: string) => v
    : (pgLib.types.getTypeParser as (o: number, f?: unknown) => unknown)(oid, format))
  ) as pg.CustomTypesConfig['getTypeParser'],
};

/**
 * Các bảng đưa vào backup. Gồm sản phẩm thật (events), lõi kiểm toán tiền
 * (3 ledger + bets + markets), và danh tính đăng nhập (auth_accounts — cần để
 * khôi phục đăng nhập sau thảm họa; mật khẩu đã là hash argon2, repo PRIVATE).
 *
 * CỐ Ý loại các bảng phù du (tái tạo được, không cần khôi phục):
 *   auth_sessions, auth_tokens, auth_attempts, scheduler_heartbeat.
 */
export const BACKUP_TABLES = [
  'users',
  'markets',
  'market_options',
  'bets',
  'wallet_ledger',
  'treasury_ledger',
  'burn_ledger',
  'scores',
  'rank_snapshots',
  'events',
  'admin_audit',
  // D335 (0067) — phân khúc quản trị đã lưu: điều kiện do người gõ tay, không suy lại được từ bảng nào. Vài dòng,
  // không PII (chỉ điều kiện + `tao_boi`), đứng sau `users` vì khoá ngoại.
  'admin_phan_khuc',
  'auth_accounts',
  /*
   * ── MỞ RỘNG 11/08 (rà soát) — trước đây bỏ sót 20 bảng CÓ DỮ LIỆU THẬT ────
   *
   * Danh sách trên viết ở GĐ4 rồi đứng yên trong khi repo mọc thêm cả đấu
   * trường, rank, cosmetic, quà beta, nhiệm vụ. Bốn trong số bỏ sót là bảng
   * APPEND-ONLY (`rank_ledger`, `rank_quy_diem`, `quest_ledger`,
   * `nhiem_vu_xong`) — tức thứ A3.3 bảo vệ vì KHÔNG dựng lại được, mà bản
   * khôi phục thảm hoạ lại không có chúng. Cộng toàn bộ lịch sử trận
   * (`holdem_matches` + `holdem_results`): mất là mất sạch mọi ván đã đánh.
   *
   * ⚠ VẪN CỐ Ý LOẠI bảng PHÙ DU — tái tạo được, hoặc có hạn lưu riêng:
   *   auth_sessions · auth_tokens · auth_attempts · scheduler_heartbeat
   *   telemetry* (A9: xoá được, hạn 90 ngày, giá trị ở XU HƯỚNG không ở dòng)
   *   bet_intents (bộ nhớ chống-gửi-lại, hết hạn theo ngày)
   * Loại chúng là quyết định, không phải bỏ quên — nên chúng có tên ở đây.
   */
  'auth_identities',
  // 0040 — bàn chung theo seed: khoá tham chiếu của `holdem_matches.ban_ma`; mất
  // là mọi trận trong bàn mồ côi mã, bảng đội không dựng lại được.
  'holdem_ban',
  'holdem_matches',
  // 0073 (D466) — màn minigame: bối cảnh đã tính + nhật ký cú bấm (nguồn replay phần màn của trận). Mất là trận khung minigame
  // không dựng lại được phần màn — NAV cuối trận mất một nửa lý do.
  'holdem_minigame_man',
  'holdem_results',
  // 0078 — ghép bàn xếp hạng theo suất: `rank_ledger.ban_id` trỏ vào `rank_ban`, nên bốn bảng đứng TRƯỚC `rank_ledger`
  // (và sau `holdem_matches` — `rank_ban_nguoi.match_id`). Mất chúng là mất ai ngồi bàn nào, điểm đã chia không truy lại được.
  'rank_suat',
  'rank_ban',
  'rank_dang_ky',
  'rank_ban_nguoi',
  'rank_diem',
  'rank_ledger',
  'rank_quy_diem',
  'season_points',
  'bxh_snapshots',
  'quest_ledger',
  'nhiem_vu_xong',
  'lo_trinh_nhan',
  'qua_beta_nhan',
  'cosmetic_items',
  'user_cosmetics',
  'user_titles',
  // 0077 — sổ sticker vinh danh hạng theo mùa: chốt idempotent (người · mùa · bậc) nhận một lần. Mất sổ này mà giữ
  // `kho_sticker` thì người leo lại cùng bậc cùng mùa nhận thêm bản. Đứng sau `cosmetic_items` (khoá ngoại).
  'huy_hieu_cap',
  // D106 — ẢNH CHỤP hồ sơ theo gói: thứ người chơi ĐÃ THẤY với công thức lúc đó.
  // Dựng lại được về toán nhưng công thức đổi thì không ra y bản cũ ⇒ giữ.
  'ho_so_goi',
  // D106 bước 6 — câu tự khai: dữ liệu "ngoài đời" đầu tiên, không dựng lại được.
  'tu_khai',
  // 0079 — người chơi tự báo lỗi (sau `users`: khoá ngoại). Không tái tạo được từ hành vi ⇒ không phải phù du.
  'bao_loi',
  'avatar_dan',
  'avatar_so_huu',
  'kho_sticker',
  /*
   * ── SỔ VẬT (0057) — ĐỢT TRƯỚC, BẢN THỂ SAU ────────────────────────────
   * Thứ tự có ý nghĩa lúc phục hồi: `vat_pham_ban_the.dot_id` là khoá ngoại
   * trỏ vào `dot_phat_hanh`.
   *
   * ⚠ HAI BẢNG NÀY KHÔNG DỰNG LẠI ĐƯỢC, và đó là cả điểm của chúng: từ B1,
   * `vat_pham_ban_the` là CHÂN LÝ về ai sở hữu bản nào, còn `user_cosmetics`
   * và `kho_sticker` hạ xuống thành bản đọc nhanh. Mất sổ mà giữ cache thì
   * còn số đếm nhưng mất DANH TÍNH — "bản 3/20" không suy lại được từ một
   * con số 20.
   */
  'dot_phat_hanh',
  'vat_pham_ban_the',
  // Sổ tiền thứ tư (0058) — cùng lý do với ba sổ tiền kia: không dựng lại được.
  'quy_cho_ledger',
  'gacha_pity',
  'sandbox_mastery',
  /*
   * ── PFM (0047) — NĂM BẢNG VÀO, MỘT BẢNG RA ────────────────────────────
   * Năm bảng dưới là JSON nghiệp vụ thuần: nhẹ, nén tốt, và KHÔNG DỰNG LẠI
   * ĐƯỢC nếu mất (điểm danh, tuần đã niêm phong, sổ cái token, cúp đã trao,
   * đặc trưng đã chốt theo kỳ — không có nguồn nào khác để tính lại).
   *
   * ⚠ `pfm_luu` (két) CỐ Ý KHÔNG Ở ĐÂY — xem BANG_PHU_DU bên dưới.
   */
  'pfm_ngay', 'pfm_tuan', 'pfm_token_ledger', 'pfm_cup', 'pfm_dac_trung',
  /*
   * D444 (0072) — sổ đếm khách bỏ hoang đã bị `donKhachBoHoang()` XOÁ HẲN.
   * KHÔNG DỰNG LẠI ĐƯỢC nếu mất: nguồn duy nhất của con số này là chính các
   * dòng `users` đã bị xoá — một khi `khach_da_don_ngay` mất, không bảng nào
   * khác còn giữ dấu vết những khách đó từng tồn tại để đếm lại. Khác các
   * bảng "phù du" ở BANG_PHU_DU (auth_sessions…) vốn tái tạo được từ hành vi
   * sống tiếp — đây là phần CÒN LẠI DUY NHẤT sau khi hành vi (không-hành-vi)
   * đã bị xoá theo đúng thiết kế.
   */
  'khach_da_don_ngay',
] as const;

/**
 * BẢNG CỐ Ý KHÔNG SAO LƯU — tái tạo được, hoặc có hạn lưu riêng.
 *
 * ⚠ TỒN TẠI ĐỂ MỖI BẢNG ĐỀU CÓ MỘT QUYẾT ĐỊNH. Trước 11/08 những bảng này
 * chỉ "không có tên trong danh sách", mà "không có tên" thì không phân biệt
 * được với BỎ QUÊN — và đúng 20 bảng đã bị bỏ quên theo cách đó. Có bài test
 * đối chiếu hai danh sách này với `pg_tables`, nên thêm bảng mới mà không
 * quyết là đỏ.
 */
export const BANG_PHU_DU = [
  // Phiên/token/nhịp tim: dựng lại được, mất không sao.
  'auth_sessions', 'auth_tokens', 'auth_attempts', 'scheduler_heartbeat',
  // A9 — telemetry XOÁ ĐƯỢC, hạn 90 ngày; giá trị nằm ở XU HƯỚNG, không ở dòng.
  'telemetry', 'telemetry_lo', 'telemetry_ngay', 'telemetry_ngay_nhom',
  'telemetry_cuon',
  // Bộ nhớ chống-gửi-lại, hết hạn theo ngày.
  'bet_intents',
  /*
   * ⚠ `pfm_lo_da_nhan` (0056/D251) — bộ nhớ chống trùng của POST /pfm/dong-bo, hạn
   * PFM_LO.NHO_MON_NGAY. Nó KHÔNG phải dữ liệu: mỗi dòng chỉ nói "id món này đã
   * nhận rồi", không dựng lại được thứ gì và không ai đọc nó ngoài chính cửa ghi.
   * ⚠ Mất nó trong một cú khôi phục thảm hoạ là CHẤP NHẬN ĐƯỢC, và lý do phải nói
   * rõ vì nó nghe như đang mở lại đúng cái lỗ 0056 dựng ra để bịt: khôi phục backup
   * kéo LÙI cả `events` về cùng mốc, nên cặp (events, bộ nhớ) vẫn khớp nhau — món
   * gửi lại sau đó ghi một dòng cho một sự kiện mà bản khôi phục cũng đã đánh mất.
   * Cái 0056 chặn là nhân đôi trong VẬN HÀNH BÌNH THƯỜNG, không phải sau thảm hoạ.
   */
  'pfm_lo_da_nhan',
  // Engine sandbox đã ngừng đường vào từ UI (nợ dọn dẹp, xem D79) — dữ liệu
  // của nó không nuôi màn nào và không phải append-only.
  'sandbox_matches', 'sandbox_results',
  // D106 — tầng chung chuyển hành vi: PHÁI SINH 100% từ events + holdem_matches,
  // dựng lại bằng `scripts/hanh_vi_dung_lai.ts` (xem đầu migration 0043).
  'hanh_vi_vong', 'hanh_vi_tran', 'hanh_vi_tieu_dung',
  /*
   * ⚠⚠ KÉT PFM — LOẠI CÓ CHỦ Ý, VÀ ĐÂY LÀ SỬA MỘT CÂU VIẾT SAI (K12/D146).
   *
   * Bản kiến trúc đầu khai "két vào được backup đêm" như một CÁI LỢI của mã
   * hoá. Đúng về AN TOÀN (ciphertext đẩy đi đâu cũng kín), **sai về TẢI** —
   * và chỉ xét vế đầu là thiếu. Ba lý do, đo chứ không đoán:
   *   (1) ciphertext KHÔNG NÉN ĐƯỢC (đo: nén lại còn phình 0,1%) ⇒ vào bản
   *       sao lưu nguyên cỡ, mà bản sao lưu sống nhờ nén;
   *   (2) `JSON.stringify` biến `Buffer` thành MẢNG SỐ THẬP PHÂN ⇒ nở
   *       ~3,57× trong RAM, ~1,3× trong file cuối;
   *   (3) `BACKUP_PAGE` đếm DÒNG chứ không đếm BYTE ⇒ một trang `pfm_luu`
   *       có thể là hàng trăm MB — bản vá "viết dòng chảy" 03/08 KHÔNG chặn
   *       được bảng này.
   * ⇒ vỡ trần 10 giây ở ~500 user PFM, và bị nền tảng cắt thì HỎNG IM LẶNG.
   *
   * Mất gì khi loại: đúng MỘT kịch bản — user mất máy VÀ ta mất DB cùng lúc.
   * Mà két BẢN THÂN NÓ đã là một bản sao (bản gốc nằm ở máy user); sao lưu
   * một bản sao mỗi đêm, vĩnh viễn, là giá quá đắt cho hai thảm hoạ chồng nhau.
   */
  'pfm_luu',
] as const;

/**
 * ⚠⚠ CỘT KHÔNG BAO GIỜ ĐƯỢC RỜI DATABASE (rà soát 11/08 — lỗ đang mở).
 *
 * `SELECT *` lấy MỌI cột, mà bản backup đi lên một repo GitHub — tức một hệ
 * thống thứ ba, mỗi đêm. `auth_accounts.totp_secret` là BÍ MẬT CHIA SẺ lưu
 * BẢN GỐC (không băm được — máy chủ phải tự tính lại mã để so, xem D61), nên
 * ai đọc được backup là ĐỌC ĐƯỢC lớp khoá thứ hai của cửa admin.
 *
 * Đây đúng lớp lỗi repo hay dính: danh sách bảng backup viết TRƯỚC, cột
 * `totp_secret` thêm SAU (D61), và không có gì báo rằng hai thứ đó vừa va nhau.
 *
 * ⚠ LOẠI CỘT, KHÔNG LOẠI BẢNG: `auth_accounts` nối `user_id` với danh tính
 * đăng nhập — bỏ cả bảng là bản khôi phục thảm hoạ không biết ai là ai.
 * Đánh đổi đã khai: khôi phục từ backup thì admin phải ghi danh 2FA lại. Đó
 * là cái giá ĐÚNG — bí mật 2FA nằm trong một file trên GitHub thì nó không
 * còn là bí mật để mà khôi phục.
 */
const COT_CAM: Record<string, readonly string[]> = {
  auth_accounts: ['totp_secret'],
};


/** BigInt (cột BIGINT parse ở db.ts) không JSON hoá được → lưu dạng chuỗi, không mất số. */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}

/** Tên file theo mốc UTC: backups/YYYY/MM/DD/delphi-YYYYMMDDTHHMMSSZ.json.gz (luôn duy nhất → luôn tạo mới). */
export function backupPath(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  const yyyy = p(now.getUTCFullYear(), 4);
  const mm = p(now.getUTCMonth() + 1);
  const dd = p(now.getUTCDate());
  const hh = p(now.getUTCHours());
  const mi = p(now.getUTCMinutes());
  const ss = p(now.getUTCSeconds());
  return `backups/${yyyy}/${mm}/${dd}/delphi-${yyyy}${mm}${dd}T${hh}${mi}${ss}Z.json.gz`;
}

export interface CollectResult {
  path: string;
  buffer: Buffer;
  rowCounts: Record<string, number>;
  jsonBytes: number;
}

/**
 * Đọc mọi bảng lõi → JSON nén gzip. KHÔNG ghi DB (read-only).
 * Toàn bộ đọc trong MỘT transaction REPEATABLE READ: mọi bảng chụp từ CÙNG một
 * snapshot — bet đang commit song song không thể làm users/wallet_ledger/bets
 * lệch nhau trong bản backup (restore xong audit_supply vẫn CÂN).
 */
/**
 * SỐ DÒNG MỖI TRANG. Chọn 5.000 vì đây là cỡ giữ mỗi trang ở hàng MB chứ
 * không phải hàng trăm MB, mà vẫn ít vòng lượt đi-về DB.
 */
export const BACKUP_PAGE = 5000;

export async function collectBackup(pool: pg.Pool, now: Date = new Date()): Promise<CollectResult> {
  /*
   * ⚠ VÌ SAO PHẢI VIẾT DÒNG CHẢY, KHÔNG PHẢI VÌ "CHO SẠCH" (vá 03/08, đợt
   * kiểm 02/08 bắt được): bản cũ làm ba việc đều ôm trọn dữ liệu vào RAM
   * cùng lúc — `SELECT * FROM events` giữ cả bảng, `JSON.stringify` đẻ MỘT
   * chuỗi khổng lồ, rồi `gzipSync` nhân thêm một bản nữa. Ở mốc tải C2
   * (5.000 user) `events` là bảng phình nhanh nhất và nó là SẢN PHẨM THẬT
   * (A1) — tức thứ đầu tiên chết vì hết bộ nhớ lại đúng là thứ đắt nhất.
   *
   * Nay: đọc THEO TRANG, đẩy thẳng từng trang qua gzip, không bao giờ giữ
   * quá `BACKUP_PAGE` dòng dạng thô. Chỉ bản ĐÃ NÉN còn nằm trong RAM, và
   * nó buộc phải thế: GitHub Contents API nhận base64 của trọn file.
   *
   * ĐỊNH DẠNG KHÔNG ĐỔI MỘT KÝ TỰ — vẫn đúng object cũ, chỉ khác cách ghép.
   * Bản khôi phục thảm hoạ không được đổi hình dạng nhân dịp vá bộ nhớ.
   */
  const rowCounts: Record<string, number> = {};
  const gzip = zlib.createGzip();
  const nen: Buffer[] = [];
  let jsonBytes = 0;
  gzip.on('data', (c: Buffer) => nen.push(c));
  const xong = new Promise<void>((res, rej) => {
    gzip.on('end', res); gzip.on('error', rej);
  });
  const ghi = (s: string): void => {
    jsonBytes += Buffer.byteLength(s);
    if (!gzip.write(s)) {
      // Backpressure: gzip là transform đồng bộ trong tiến trình này nên hàng
      // đợi tự rút; không chặn ở đây để giữ transaction ngắn nhất có thể.
    }
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    ghi(`{"meta":${JSON.stringify({
      generated_at: now.toISOString(),
      format: 1,
      note: 'DELPHI full-table snapshot; token là chuỗi số nguyên (BigInt).',
    })},"tables":{`);

    let dauBang = true;
    for (const t of BACKUP_TABLES) {
      ghi(`${dauBang ? '' : ','}${JSON.stringify(t)}:[`);
      dauBang = false;
      let dem = 0;
      for (;;) {
        /*
         * Tên bảng là hằng số trong repo (không phải input người dùng) → an toàn.
         * ORDER BY ctid: khoá sắp xếp DUY NHẤT dùng được cho mọi bảng mà không
         * cần biết khoá chính của từng bảng, và nó ỔN ĐỊNH trong một snapshot
         * REPEATABLE READ — nên phân trang không bỏ sót cũng không lặp dòng.
         */
        const { rows } = await client.query({
          text: `SELECT * FROM ${t} ORDER BY ctid LIMIT $1 OFFSET $2`,
          values: [BACKUP_PAGE, dem],
          types: KIEU_BACKUP,
        });
        for (const r of rows) {
          // Bỏ cột cấm NGAY TRÊN HÀNG, không dựng câu SELECT thứ hai: đường
          // ghi chỉ có một, nên không có bản sao nào để mà trôi (D61).
          const cam = COT_CAM[t];
          const ra = cam
            ? Object.fromEntries(
              Object.entries(r as Record<string, unknown>)
                .filter(([k]) => !cam.includes(k)))
            : r;
          ghi(`${dem++ === 0 ? '' : ','}${JSON.stringify(ra, bigintReplacer)}`);
        }
        if (rows.length < BACKUP_PAGE) break;
      }
      ghi(']');
      rowCounts[t] = dem;
    }
    ghi(`},"row_counts":${JSON.stringify(rowCounts)}}`);
    await client.query('COMMIT');
  } catch (err) {
    gzip.destroy();
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
  gzip.end();
  await xong;
  return { path: backupPath(now), buffer: Buffer.concat(nen), rowCounts, jsonBytes };
}

export interface GitHubBackupConfig {
  /** owner/repo, ví dụ "<owner>/<backup-repo>" (PHẢI private). */
  repo: string;
  /** fine-grained PAT chỉ quyền Contents:write trên đúng repo backup. */
  token: string;
  branch: string;
}

/** Đẩy một file lên GitHub qua Contents API. Ném lỗi rõ ràng nếu không 2xx. */
export async function pushToGitHub(
  cfg: GitHubBackupConfig,
  path: string,
  buffer: Buffer,
  message: string,
): Promise<void> {
  const url = `https://api.github.com/repos/${cfg.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'delphi-backup',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: buffer.toString('base64'), branch: cfg.branch }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    // KHÔNG in token; chỉ status + phần đầu thông điệp GitHub.
    throw new Error(`GitHub Contents API ${res.status}: ${detail.slice(0, 300)}`);
  }
}

export interface BackupResult {
  path: string;
  bytes: number;
  rowCounts: Record<string, number>;
  pushed: boolean;
  /** Kết quả dọn bản > `BACKUP_GIU_NGAY` ngày; `null` = lượt dọn lỗi (đã log), bản đêm nay vẫn đẩy xong. */
  don?: { da_xoa: number } | null;
}

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * MÃ HOÁ BẢN SAO LƯU — B2 (SPEC va-bao-mat-chuan-hoa-api-dot-1, Q3 = A; D2 SPEC phap-ly-giam-rui-ro).
 *
 * ⚠ Trước bản vá, mỗi đêm `auth_accounts.email` + `password_hash` (cùng mọi bảng) lên repo GitHub dạng gzip TRẦN:
 * repo private là lớp duy nhất, và một token lộ / một cú bấm "public" nhầm là lộ cả danh sách người chơi. Nay
 * AES-256-GCM (`node:crypto`, không thêm gói) bằng `BACKUP_KHOA` (32 byte, base64) SAU gzip — mã hoá trước thì gzip
 * không nén được gì.
 *
 * ĐỊNH DẠNG `.json.gz.enc` (đọc được bằng mắt, không cần tài liệu): một dòng JSON `{"v":1,"alg":"aes-256-gcm","iv":…,
 * "tag":…}` + xuống dòng + bản mã. IV 12 byte ngẫu nhiên mỗi tệp (GCM chết nếu lặp IV với cùng khoá); `tag` 16 byte ⇒
 * sai khoá hoặc tệp bị sửa một bit là giải mã NÉM, không bao giờ ra rác lặng lẽ.
 * Khôi phục: `npm run khoi-phuc -- <tệp .enc>` với `BACKUP_KHOA` trong `.env` (`scripts/khoi_phuc.ts`).
 * ═══════════════════════════════════════════════════════════════════════════
 */
const ALG = 'aes-256-gcm';

/** `BACKUP_KHOA` → khoá 32 byte. Vắng/rỗng ⇒ `undefined`; có mà sai độ dài ⇒ NÉM (khoá hỏng không được coi là "không cần mã"). */
export function docKhoaBackup(raw: string | undefined): Buffer | undefined {
  if (!raw || !raw.trim()) return undefined;
  const k = Buffer.from(raw.trim(), 'base64');
  if (k.length !== 32) {
    throw new Error(`BACKUP_KHOA phải là 32 byte base64 (đang là ${k.length} byte). `
      + `Sinh: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  return k;
}

export function maHoaBackup(gz: Buffer, khoa: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, khoa, iv);
  const ma = Buffer.concat([c.update(gz), c.final()]);
  const dau = JSON.stringify({ v: 1, alg: ALG, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64') });
  return Buffer.concat([Buffer.from(`${dau}\n`, 'utf8'), ma]);
}

/** Ngược của `maHoaBackup` ⇒ buffer gzip. Sai khoá / tệp bị sửa ⇒ ném (GCM). */
export function giaiMaBackup(tep: Buffer, khoa: Buffer): Buffer {
  const xuong = tep.indexOf(0x0a);
  if (xuong < 0) throw new Error('tệp backup mã hoá thiếu dòng đầu {v, iv, tag}');
  const dau = JSON.parse(tep.subarray(0, xuong).toString('utf8')) as { v?: unknown; alg?: unknown; iv: string; tag: string };
  if (dau.v !== 1 || dau.alg !== ALG) throw new Error(`định dạng mã hoá lạ: v=${String(dau.v)} alg=${String(dau.alg)}`);
  const d = createDecipheriv(ALG, khoa, Buffer.from(dau.iv, 'base64'));
  d.setAuthTag(Buffer.from(dau.tag, 'base64'));
  return Buffer.concat([d.update(tep.subarray(xuong + 1)), d.final()]);
}

/**
 * D2 pháp lý: bản sao lưu hết đọc được sau ≤ 30 ngày (k4 Đ5 NĐ 356). Mỗi lượt backup đêm xoá tệp của mọi NGÀY cũ hơn
 * mốc này (theo đường `backups/YYYY/MM/DD/`, ngày UTC).
 * ⚠ Contents API DELETE gỡ tệp khỏi nhánh, KHÔNG khỏi lịch sử git của repo backup — bản mã cũ vẫn nằm trong lịch sử và
 * vẫn giải được bằng chính `BACKUP_KHOA`. Q3 = A chấp nhận điều đó (một khoá); muốn "hết đọc được" tuyệt đối thì đổi
 * khoá (khoá cũ huỷ ⇒ lịch sử thành rác) hoặc làm sạch lịch sử repo backup.
 */
export const BACKUP_GIU_NGAY = 30;

interface MucGithub { name: string; path: string; type: string; sha: string }

function dauGithub(cfg: GitHubBackupConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'delphi-backup',
  };
}

async function lietKe(cfg: GitHubBackupConfig, duong: string): Promise<MucGithub[]> {
  const res = await fetch(
    `https://api.github.com/repos/${cfg.repo}/contents/${duong}?ref=${encodeURIComponent(cfg.branch)}`,
    { headers: dauGithub(cfg) },
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`GitHub liệt kê ${duong}: ${res.status}`);
  const j = await res.json() as unknown;
  return Array.isArray(j) ? j as MucGithub[] : [];
}

/** Xoá mọi tệp của các ngày cũ hơn `BACKUP_GIU_NGAY` ngày trước `now`. Chỉ đi đúng cây `backups/YYYY/MM/DD/`. */
export async function xoaBanCu(cfg: GitHubBackupConfig, now: Date = new Date()): Promise<{ da_xoa: number }> {
  const moc = new Date(now.getTime() - BACKUP_GIU_NGAY * 86_400_000).toISOString().slice(0, 10);
  const thuMucSo = (m: MucGithub) => m.type === 'dir' && /^\d+$/.test(m.name);
  let daXoa = 0;
  for (const nam of (await lietKe(cfg, 'backups')).filter(thuMucSo)) {
    for (const thang of (await lietKe(cfg, nam.path)).filter(thuMucSo)) {
      for (const ngay of (await lietKe(cfg, thang.path)).filter(thuMucSo)) {
        if (`${nam.name}-${thang.name}-${ngay.name}` >= moc) continue;
        for (const tep of (await lietKe(cfg, ngay.path)).filter((m) => m.type === 'file')) {
          const res = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${tep.path}`, {
            method: 'DELETE',
            headers: { ...dauGithub(cfg), 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `chore(backup): xoá bản quá ${BACKUP_GIU_NGAY} ngày ${tep.path}`, sha: tep.sha, branch: cfg.branch,
            }),
          });
          if (!res.ok) throw new Error(`GitHub xoá ${tep.path}: ${res.status}`);
          daXoa += 1;
        }
      }
    }
  }
  return { da_xoa: daXoa };
}

/**
 * Tạo hàm chạy backup end-to-end (collect + mã hoá + push + dọn bản cũ) để tiêm vào createApp.
 * Endpoint chỉ biết "gọi runBackup(pool)" — không dính GitHub, dễ test.
 */
export function makeGithubBackupRunner(cfg: GitHubBackupConfig & { khoa: Buffer }) {
  return async (pool: pg.Pool): Promise<BackupResult> => {
    const { path: duongGz, buffer, rowCounts } = await collectBackup(pool);
    const path = `${duongGz}.enc`;
    const ma = maHoaBackup(buffer, cfg.khoa);
    await pushToGitHub(cfg, path, ma, `chore(backup): ${path}`);
    /*
     * Dọn SAU khi đẩy, và lỗi dọn KHÔNG làm hỏng lượt: bản đêm nay đã nằm an toàn — một lỗi GitHub lúc liệt kê không
     * được biến thành "backup_failed" (cron đọc 500 ⇒ tưởng mất bản). Lỗi ghi log; đêm sau dọn bù (đi lại cả cây).
     */
    let don: { da_xoa: number } | null = null;
    try {
      don = await xoaBanCu(cfg);
    } catch (err) {
      console.error('[backup] dọn bản cũ lỗi:', (err as Error).message);
    }
    return { path, bytes: ma.length, rowCounts, pushed: true, don };
  };
}

/**
 * Dựng runner từ biến môi trường (`api/index.ts`). THIẾU một trong ba (token · repo · `BACKUP_KHOA`) hoặc khoá hỏng ⇒
 * `undefined` ⇒ `/internal/backup` trả 501. Không có nhánh "thiếu khoá thì đẩy trần" ở BẤT KỲ môi trường nào (chặt hơn
 * SPEC — SPEC chỉ đòi ở production): một bản trần lên GitHub không rút lại được (lịch sử git), nên vắng khoá phải là
 * không đẩy — chuông 501 kêu, dữ liệu ở yên.
 */
export function taoBackupRunnerTuEnv(env: Record<string, string | undefined> = process.env) {
  const token = env.BACKUP_GH_TOKEN;
  const repo = env.BACKUP_GH_REPO;
  if (!token || !repo) return undefined;
  let khoa: Buffer | undefined;
  try {
    khoa = docKhoaBackup(env.BACKUP_KHOA);
  } catch (err) {
    console.error('[backup] TẮT:', (err as Error).message);
    return undefined;
  }
  if (!khoa) return undefined;
  return makeGithubBackupRunner({ token, repo, branch: env.BACKUP_GH_BRANCH ?? 'main', khoa });
}
