/**
 * VIỆC TUẦN + LỘ TRÌNH MÙA 0.0 — lõi nghiệp vụ (không có route nào ở đây).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TIẾN ĐỘ ĐƯỢC **SUY RA TỪ DẤU VẾT ĐÃ CÓ**, KHÔNG DO CLIENT BÁO.
 *
 * Không endpoint nào nhận "tôi vừa xong việc X". Mỗi lần người chơi mở màn
 * nhiệm vụ, server ĐỌC LẠI bằng chứng trong `events` + `holdem_results` của cửa
 * sổ tuần hiện tại rồi tự chốt việc nào đã xong. Ba thứ có được:
 *
 *  1. **C4 nguyên vẹn** — client không tính, không khai, không gửi cửa sổ. Tuần
 *     suy từ đồng hồ SERVER; client gửi `week_no` cũng không ai đọc.
 *  2. **KHÔNG PHẢI CƠ CHẾ TRANG TRÍ** (bẫy #1, đã dính 8 lần). Bằng chứng là
 *     những dòng mà ĐƯỜNG CHẠY THẬT đã ghi từ trước: `market_view` (markets.ts),
 *     `holdem_results` (holdem_api.ts), `cos_equip` (avatar.ts). Không có hook
 *     mới nào phải cắm vào màn của luồng khác, nên không có đường nào "quên gọi".
 *     Việc duy nhất cần một đường ghi mới là điểm danh — và nó có endpoint riêng
 *     ở `nhiem_vu_api.ts`, tức nó không thể vừa tồn tại vừa không chạy.
 *  3. **Rẻ về hạ tầng** (C2/D11): hai truy vấn khi VÀO MÀN, không polling, không
 *     ghi gì ở đường nóng của trận hay của lệnh đặt.
 *
 * Giá phải trả, khai thẳng: một việc chỉ đo được nếu ĐÃ có ai đó ghi dấu vết cho
 * nó. Đó là lý do roster mùa 0.0 chỉ có 5 loại — không phải vì 5 là con số đẹp.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TRẦN CÀY NẰM Ở KHOÁ CHÍNH, KHÔNG Ở FILE NÀY
 *
 * `nhiem_vu_xong` PK (user_id, season_id, cua_so_key, nv_id). Một tuần chỉ TỒN
 * TẠI 5 mã việc; dòng thứ 6 không có mã nào để mang. Nên "chơi 40 phiên trong
 * một tuần = +0 chặng" không phải một câu `if` ở đây mà là hệ quả của hình dạng
 * dữ liệu — và một bug trong file này không thể phá nó.
 */
import type pg from 'pg';
import { ducBanThe } from './kinh_te/so_vat.js';
import {
  CHANG_LO_TRINH, MUA_0_0, NHIEM_VU_VERSION, changTuViec, rosterTuan,
  type NhiemVu,
} from '../config/progression.js';

/** Múi giờ hiển thị/nghiệp vụ (A8.8). DB vẫn lưu UTC. */
const VN = 'Asia/Ho_Chi_Minh';

/** Mốc 00:00 giờ VN của ngày mở mùa. */
const MUA_BAT_DAU_MS = Date.parse(`${MUA_0_0.NGAY_BAT_DAU}T00:00:00+07:00`);
const NGAY_MS = 24 * 60 * 60 * 1000;

export interface CuaSoTuan {
  /** 1..SO_TUAN. */
  readonly tuan: number;
  /** Khoá cửa sổ ghi vào DB — 'W3'. Ghép với `season_id` là đủ duy nhất. */
  readonly khoa: string;
  readonly bat_dau: Date;
  readonly ket_thuc: Date;
}

/**
 * Tuần của mùa tại thời điểm `now`, hoặc `null` khi mùa chưa mở / đã đóng.
 *
 * Tuần đếm từ NGÀY MỞ MÙA chứ không dùng tuần ISO. Lý do: tuần ISO làm tuần 1 và
 * tuần 8 bị CẮT NGẮN tuỳ ngày mở mùa, nên "điểm danh 4/7 ngày" thành bất khả thi
 * ở hai đầu mùa — một luật nhìn có vẻ chuẩn hoá lại tự đẻ ra hai tuần không công
 * bằng.
 */
export function tuanCuaMua(now: Date = new Date()): CuaSoTuan | null {
  const troi = now.getTime() - MUA_BAT_DAU_MS;
  if (troi < 0) return null;
  const chiSo = Math.floor(troi / (7 * NGAY_MS));
  if (chiSo >= MUA_0_0.SO_TUAN) return null;
  const batDau = new Date(MUA_BAT_DAU_MS + chiSo * 7 * NGAY_MS);
  return {
    tuan: chiSo + 1,
    khoa: `W${chiSo + 1}`,
    bat_dau: batDau,
    ket_thuc: new Date(batDau.getTime() + 7 * NGAY_MS),
  };
}

/** Ngày lịch VN dạng 'YYYY-MM-DD' — dùng cho trần điểm danh 1 lần/ngày. */
export function ngayVN(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Đếm bằng chứng của một cửa sổ tuần. Mọi trường là biến ĐƯỢC PHÉP (A1/L-N1). */
interface BangChung {
  /** Số NGÀY đã điểm danh trong tuần. */
  ngay_diem_danh: number;
  /** Số lần chạm bề mặt dự báo (xem hoặc phân bổ — không phân biệt, cố ý). */
  cham_du_bao: number;
  /** Số NHÓM câu hỏi khác nhau đã ghé. */
  nhom_da_ghe: number;
  /** Số phiên Đấu trường đã chơi xong. */
  phien_xong: number;
  /** Số NGÀY khác nhau có phiên đã xong. */
  ngay_co_phien: number;
  /** Số câu hỏi ĐÃ CHỐT khác nhau đã mở lại. */
  keo_da_chot_da_xem: number;
  /** Số lần đổi diện mạo. */
  lan_doi_dien_mao: number;
}

/**
 * MỘT truy vấn cho toàn bộ bằng chứng của tuần.
 *
 * Vì sao gộp: màn nhiệm vụ nằm ở Hub — màn đầu tiên người chơi thấy. Bảy truy
 * vấn tuần tự ở đây là bảy lần cộng độ trễ vào ấn tượng đầu, mà cả bảy đọc cùng
 * một cửa sổ thời gian.
 *
 * ⚠ Không truy vấn nào đọc `bets.amount`, `option_id`, `hang`, `von_cuoi` hay
 * `rank_ledger`. Đó không phải sự cẩu thả tiết kiệm — đó là luật L-N1: biến nào
 * bị gắn thưởng thì thôi đo cái nó từng đo. Danh sách CẤM ở đầu
 * `config/progression.ts`, và mỗi cột trong `BangChung` phải nằm ở danh sách
 * ĐƯỢC PHÉP.
 */
async function demBangChung(
  db: pg.Pool | pg.PoolClient,
  userId: string,
  cs: CuaSoTuan,
): Promise<BangChung> {
  const { rows } = await db.query(
    `WITH ev AS (
        SELECT action_type, context_id, value_json, ts
          FROM events
         WHERE user_id = $1 AND ts >= $2 AND ts < $3
     ), hr AS (
        SELECT created_at
          FROM holdem_results
         WHERE user_id = $1 AND created_at >= $2 AND created_at < $3
     )
     SELECT
       (SELECT COUNT(DISTINCT (ts AT TIME ZONE $4)::date) FROM ev
         WHERE action_type = 'nv_diem_danh')::int                AS ngay_diem_danh,
       (SELECT COUNT(*) FROM ev
         WHERE action_type IN ('market_view','bet_place','bet_adjust'))::int
                                                                 AS cham_du_bao,
       (SELECT COUNT(DISTINCT value_json->>'pool') FROM ev
         WHERE action_type = 'market_view'
           AND value_json->>'pool' IS NOT NULL)::int             AS nhom_da_ghe,
       (SELECT COUNT(*) FROM hr)::int                            AS phien_xong,
       (SELECT COUNT(DISTINCT (created_at AT TIME ZONE $4)::date) FROM hr)::int
                                                                 AS ngay_co_phien,
       (SELECT COUNT(DISTINCT context_id) FROM ev
         WHERE action_type = 'market_view'
           AND value_json->>'status' = 'resolved')::int          AS keo_da_chot_da_xem,
       (SELECT COUNT(*) FROM ev
         WHERE action_type IN ('cos_equip','avatar_chon','avatar_tao'))::int
                                                                 AS lan_doi_dien_mao`,
    [userId, cs.bat_dau.toISOString(), cs.ket_thuc.toISOString(), VN],
  );
  const r = rows[0]!;
  return {
    ngay_diem_danh: r.ngay_diem_danh, cham_du_bao: r.cham_du_bao,
    nhom_da_ghe: r.nhom_da_ghe, phien_xong: r.phien_xong,
    ngay_co_phien: r.ngay_co_phien, keo_da_chot_da_xem: r.keo_da_chot_da_xem,
    lan_doi_dien_mao: r.lan_doi_dien_mao,
  };
}

/**
 * Tiến độ HIỆN TẠI của một việc trên bằng chứng đã đếm.
 *
 * Trả về số ĐÃ ĐẠT (không phải boolean) vì màn nhiệm vụ phải hiện "3/4 ngày" —
 * người chơi cần biết còn thiếu gì, và ô trần ngày là chỗ cơ chế chống spam TỰ
 * GIẢI THÍCH MÌNH ("cày thêm không có thêm" chỉ thuyết phục khi thấy được).
 */
export function tienDoViec(nv: NhiemVu, bc: BangChung): number {
  switch (nv.nv_id) {
    case 'co_mat':
    case 'co_mat_sau':
      return bc.ngay_diem_danh;
    case 'xem_xet':
      return bc.cham_du_bao;
    case 'phu_ba_nhom':
      return bc.nhom_da_ghe;
    case 'mot_tran':
      return bc.phien_xong;
    case 'hai_ngay_dau':
      return bc.ngay_co_phien;
    case 'doc_lai':
    case 'doc_lai_hai':
      return bc.keo_da_chot_da_xem;
    case 'doi_dien_mao':
      return bc.lan_doi_dien_mao;
    default:
      // Fail-closed: việc mới mà quên khai bằng chứng thì KHÔNG BAO GIỜ xong,
      // chứ không âm thầm xong. Người thêm việc sẽ thấy ngay ở test.
      return 0;
  }
}

export interface ViecHienThi {
  readonly nv_id: string;
  readonly ten: string;
  readonly muc: number;
  readonly da: number;
  readonly xong: boolean;
  readonly be_mat: string;
}

/**
 * RÀ SOÁT tuần hiện tại: đọc bằng chứng, ghi việc đã xong, trả roster đã chấm.
 *
 * `ON CONFLICT DO NOTHING` là chỗ tính idempotent sống: rà soát chạy MỖI LẦN mở
 * màn, nên nó phải chạy được vô hạn lần mà không sinh thêm gì. Và vì trần nằm ở
 * PK, một bug làm rà soát chạy 100 lần/giây cũng không đúc thêm được một chặng.
 */
export async function raSoatTuan(
  db: pg.Pool | pg.PoolClient,
  userId: string,
  now: Date = new Date(),
): Promise<{ cua_so: CuaSoTuan | null; viec: ViecHienThi[] }> {
  const cs = tuanCuaMua(now);
  if (cs === null) return { cua_so: null, viec: [] };

  const bc = await demBangChung(db, userId, cs);
  const roster = rosterTuan(cs.tuan);
  const viec: ViecHienThi[] = [];
  const xongIds: string[] = [];

  for (const nv of roster) {
    const da = tienDoViec(nv, bc);
    const xong = da >= nv.muc;
    if (xong) xongIds.push(nv.nv_id);
    viec.push({ nv_id: nv.nv_id, ten: nv.ten, muc: nv.muc, da, xong, be_mat: nv.be_mat });
  }

  if (xongIds.length > 0) {
    /*
     * Ghi MỘT lệnh cho cả roster (unnest) thay vì N lệnh: rà soát chạy ở đường
     * vào màn, và số lệnh SQL trên mỗi lần mở màn là thứ đếm vào ngân sách D11.
     */
    await db.query(
      `INSERT INTO nhiem_vu_xong (user_id, season_id, cua_so_key, nv_id)
       SELECT $1, $2, $3, x FROM unnest($4::text[]) AS x
       ON CONFLICT DO NOTHING`,
      [userId, MUA_0_0.SEASON_ID, cs.khoa, xongIds],
    );
  }

  return { cua_so: cs, viec };
}

/**
 * CỘNG/TRỪ Q — ĐƯỜNG DUY NHẤT chạm `users.quest_points`.
 *
 * Ba ràng buộc, mỗi cái chặn một cách hỏng đã thấy ở ví T:
 *  · `FOR UPDATE` trên dòng user: hai lần nhận mốc song song mà không khoá thì
 *    `balance_after` của hai bút toán bằng nhau ⟹ sổ không recompute được.
 *  · UPDATE `users` đi CÙNG transaction với dòng sổ — constraint trigger
 *    `users_quest_points_khop_so` (migration 0016) kiểm lúc COMMIT, nên "ghi ví
 *    mà quên ghi sổ" nổ ngay chứ không trôi thành số lệch.
 *  · `reason` nằm trong một danh mục KHÔNG có giá trị nào chung với
 *    `wallet_ledger.reason` (A3.5). Không có 'convert', không có 'exchange'.
 */
export async function themQ(
  client: pg.PoolClient,
  userId: string,
  delta: number,
  reason: 'lo_trinh_moc' | 'mo_he' | 'shop_q' | 've_ban_thi_dau' | 'hoan_ve'
  | 'admin_sua_q' | 'qua_beta_q',
  refId: string | null,
): Promise<number> {
  const { rows } = await client.query(
    `SELECT quest_points FROM users WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  if (rows.length === 0) throw new Error('user không tồn tại');
  const truoc = Number(rows[0]!.quest_points);
  const sau = truoc + delta;
  if (sau < 0) throw new Error('Q không đủ');

  await client.query(
    `INSERT INTO quest_ledger (user_id, delta, balance_after, reason, ref_id, season_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, delta, sau, reason, refId, MUA_0_0.SEASON_ID],
  );
  await client.query(
    `UPDATE users SET quest_points = $1 WHERE user_id = $2`,
    [sau, userId],
  );
  return sau;
}

export interface MocDaNhan {
  readonly chang_no: number;
  readonly thuong_id: string;
}

/**
 * NHẬN MỌI MỐC ĐÃ ĐẠT MÀ CHƯA NHẬN — tự động, không cần bấm.
 *
 * D31 ("dấu thưởng mở ngay") + D26 (feedback rõ và NGAY). Bấm-nhận đẻ thêm một
 * trạng thái phải xử ở mọi màn, và một trạng thái "đã đạt nhưng chưa nhận" là
 * chỗ Q có thể bốc hơi khi người chơi bỏ app.
 *
 * `lo_trinh_nhan` PK (user, season, chặng) là thứ chống nhận hai lần khi retry —
 * KHÔNG phải một cờ trong bộ nhớ. Một transaction cho toàn bộ mốc: hoặc cả cụm
 * vào sổ, hoặc không gì cả.
 */
export async function nhanMocDaDat(
  pool: pg.Pool,
  userId: string,
  chang: number,
): Promise<MocDaNhan[]> {
  if (chang < 1) return [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: daNhan } = await client.query(
      `SELECT chang_no FROM lo_trinh_nhan
        WHERE user_id = $1 AND season_id = $2 FOR UPDATE`,
      [userId, MUA_0_0.SEASON_ID],
    );
    const co = new Set(daNhan.map((r) => Number(r.chang_no)));
    const moi: MocDaNhan[] = [];

    for (const moc of CHANG_LO_TRINH) {
      if (moc.chang_no > chang || co.has(moc.chang_no)) continue;

      /*
       * CHỖ CHỜ ART — fail-closed, và cố ý KHÔNG ghi `lo_trinh_nhan`.
       *
       * Bỏ qua mà vẫn ghi "đã nhận" là mất phần thưởng vĩnh viễn (bảng là
       * append-only theo tinh thần, và người chơi không có đường đòi lại). Để
       * mốc MỞ nghĩa là khi luồng art cấp mã món, lần rà soát kế tiếp trao ngay
       * cho cả người đã vượt mốc từ lâu — không cần backfill.
       */
      /*
       * ⚠⚠ ĐIỀU KIỆN SỬA 04/08 — BẢN CŨ ĐỂ LỌT ĐÚNG MỐC QUAN TRỌNG NHẤT.
       *
       * Cũ: `moc.q === 0 && moc.mon_id === null`. Nó giả định "mốc chờ art thì
       * không phát Q" — đúng với 9/10 mốc chờ art, và SAI với chặng 30:
       *
       *     { chang_no: 30, q: 60, mon_id: null, nhan: 'Avatar "KỸ THUẬT VIÊN 0.0"' }
       *
       * Chặng 30 là mốc CUỐI, phần thưởng lớn nhất mùa, và `doc_ban` — không bao
       * giờ phát lại. Với điều kiện cũ, `q: 60` làm vế trái sai ⇒ nhánh fail-closed
       * KHÔNG chạy ⇒ trao 60 Q, ghi `lo_trinh_nhan`, **mốc đóng sổ vĩnh viễn**.
       * Ngày art về thì lần rà soát kế tiếp thấy mốc đã nhận và bỏ qua: người cày
       * hết cả mùa nhận được 60 Q thay vì món vinh danh, và không có đường đòi lại.
       * Không lỗi nào nổ, không dòng log nào lạ.
       *
       * Mới: hỏi đúng câu cần hỏi — **mốc này có HỨA một món không, và món đó đã
       * có mã chưa**. `nhan` chính là lời hứa (mốc chỉ-Q không khai `nhan`), nên
       * nó phân biệt chuẩn xác hai nhóm mà `q === 0` chỉ phân biệt gần đúng.
       *
       * Hệ quả có chủ đích: chặng 30 giữ nguyên cả 60 Q lẫn món cho tới khi art
       * về, rồi trao TRỌN GÓI. Trao nửa gói rồi đóng sổ mới là thứ không sửa được.
       */
      if (moc.mon_id === null && moc.nhan !== undefined) continue;

      let thuongId = '';
      if (moc.q > 0) {
        await themQ(client, userId, moc.q, 'lo_trinh_moc', `chang:${moc.chang_no}`);
        thuongId = `q:${moc.q}`;
      }
      if (moc.mon_id !== null) {
        /*
         * `source = 'bp'` đã có trong CHECK của `user_cosmetics` từ 0013 — dùng
         * đúng nó, không đẻ nguồn mới. ON CONFLICT: một món chỉ sở hữu một lần,
         * và mốc lộ trình không bao giờ trao trùng món.
         */
        const traoMoc = await client.query(
          `INSERT INTO user_cosmetics (user_id, cosmetic_id, source)
           VALUES ($1, $2, 'bp') ON CONFLICT DO NOTHING`,
          [userId, moc.mon_id],
        );
        // ⚠ CHỈ đúc bản thể khi dòng THẬT SỰ được chèn. `ON CONFLICT DO NOTHING`
        // nghĩa là lời gọi lặp lại không trao thêm gì — đúc bất kể rowCount sẽ
        // sinh bản thể thừa mỗi lần chạy lại, và sổ lệch đúng theo số lần lặp.
        if (traoMoc.rowCount === 1) {
          await ducBanThe(client, {
            mauId: moc.mon_id, chuSoHuu: userId, nguon: 'tang', soLuong: 1,
          });
        }
        thuongId = thuongId === '' ? moc.mon_id : `${thuongId}+${moc.mon_id}`;
      }

      await client.query(
        `INSERT INTO lo_trinh_nhan (user_id, season_id, chang_no, thuong_id)
         VALUES ($1, $2, $3, $4)`,
        [userId, MUA_0_0.SEASON_ID, moc.chang_no, thuongId],
      );
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type,
                             value_num, value_json)
         VALUES ($1, 'lo_trinh', $2, 'bp_chang_nhan', $3, $4)`,
        [userId, `${MUA_0_0.SEASON_ID}:${moc.chang_no}`, moc.chang_no,
          JSON.stringify({ chang: moc.chang_no, thuong: thuongId })],
      );
      moi.push({ chang_no: moc.chang_no, thuong_id: thuongId });
    }

    await client.query('COMMIT');
    return moi;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export interface TrangThaiLoTrinh {
  readonly version: string;
  readonly season_id: string;
  readonly mua_mo: boolean;
  readonly tuan: number | null;
  readonly so_tuan: number;
  readonly chang: number;
  readonly so_chang: number;
  readonly viec_da_xong: number;
  readonly quest_points: number;
  readonly viec: ViecHienThi[];
  readonly da_diem_danh_hom_nay: boolean;
  readonly moc: ReadonlyArray<{
    chang_no: number; q: number; nhan: string | null; doc_ban: boolean;
    da_nhan: boolean; cho_art: boolean;
  }>;
  readonly vua_nhan: MocDaNhan[];
}

/**
 * TOÀN BỘ trạng thái cho màn nhiệm vụ — một hàm, một đường chạy.
 *
 * Thứ tự CỐ Ý: rà soát ⟶ đếm chặng ⟶ nhận mốc ⟶ đọc lại. Nếu đọc trước khi
 * nhận thì người chơi vừa xong việc thứ 30 sẽ thấy "đã đạt" mà chưa có Q, rồi Q
 * mới xuất hiện ở lần mở màn sau — đúng lớp lỗi mà D26 gọi là feedback không
 * NGAY, và nó cũng làm người chơi tưởng hệ thống nợ mình.
 */
export async function trangThaiLoTrinh(
  pool: pg.Pool,
  userId: string,
  now: Date = new Date(),
): Promise<TrangThaiLoTrinh> {
  const { cua_so, viec } = await raSoatTuan(pool, userId, now);

  const { rows: demRows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM nhiem_vu_xong
      WHERE user_id = $1 AND season_id = $2`,
    [userId, MUA_0_0.SEASON_ID],
  );
  const viecDaXong = demRows[0]!.n as number;
  const chang = changTuViec(viecDaXong);

  const vuaNhan = await nhanMocDaDat(pool, userId, chang);

  const [nhanRows, qRows, ddRows] = await Promise.all([
    pool.query(
      `SELECT chang_no FROM lo_trinh_nhan WHERE user_id = $1 AND season_id = $2`,
      [userId, MUA_0_0.SEASON_ID],
    ),
    pool.query(`SELECT quest_points FROM users WHERE user_id = $1`, [userId]),
    pool.query(
      `SELECT 1 FROM events
        WHERE user_id = $1 AND action_type = 'nv_diem_danh'
          AND (ts AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
        LIMIT 1`,
      [userId, VN],
    ),
  ]);
  const daNhan = new Set(nhanRows.rows.map((r) => Number(r.chang_no)));

  return {
    version: NHIEM_VU_VERSION,
    season_id: MUA_0_0.SEASON_ID,
    mua_mo: cua_so !== null,
    tuan: cua_so?.tuan ?? null,
    so_tuan: MUA_0_0.SO_TUAN,
    chang,
    so_chang: MUA_0_0.SO_CHANG,
    viec_da_xong: viecDaXong,
    quest_points: Number(qRows.rows[0]?.quest_points ?? 0),
    viec,
    da_diem_danh_hom_nay: ddRows.rows.length > 0,
    // Cả 30 mốc hiện từ phút 0 — "không biết chơi để làm gì" là bệnh của THÔNG
    // TIN, không phải bệnh của số lượng phần thưởng.
    moc: CHANG_LO_TRINH.map((m) => ({
      chang_no: m.chang_no,
      q: m.q,
      nhan: m.nhan ?? null,
      doc_ban: m.doc_ban === true,
      da_nhan: daNhan.has(m.chang_no),
      cho_art: m.mon_id === null && m.nhan !== undefined,
    })),
    vua_nhan: vuaNhan,
  };
}

/**
 * ĐIỂM DANH — nút thuần, trần 1 lần/ngày lịch VN.
 *
 * Vì sao điểm danh CHỨ KHÔNG PHẢI "đặt 1 lệnh" làm điều kiện mở lương: nếu điều
 * kiện là đặt lệnh thì cái bấm-cho-xong ghi một dòng `bets` + một dòng `events`
 * có `state_snapshot_json` — rác nằm đúng trong bảng sản phẩm (A1). Điểm danh
 * ghi một dòng SIÊU DỮ LIỆU TRUNG THỰC ("người này mở app hôm nay"), và đó là
 * thông tin đúng kể cả khi họ không chơi gì.
 *
 * Vì sao KHÔNG dùng lại event `checkin` đã có: `checkin` chỉ được ghi khi trợ cấp
 * thật sự chi ra (`server/subsidy.ts` — chặn bởi `SUBSIDY_THRESHOLD` 500 T và
 * trần tháng), nên nó là tín hiệu "ví cạn", không phải tín hiệu "có mặt". Dùng nó
 * làm điểm danh sẽ khiến người giàu KHÔNG BAO GIỜ mở được lương tuần.
 */
export async function diemDanh(
  pool: pg.Pool,
  userId: string,
  now: Date = new Date(),
): Promise<{ moi: boolean; ngay: string }> {
  const ngay = ngayVN(now);
  const { rowCount } = await pool.query(
    `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
     SELECT $1, 'nhiem_vu', $2, 'nv_diem_danh', $3
      WHERE NOT EXISTS (
        SELECT 1 FROM events
         WHERE user_id = $1 AND action_type = 'nv_diem_danh' AND context_id = $2)`,
    [userId, ngay, JSON.stringify({ ngay })],
  );
  return { moi: (rowCount ?? 0) > 0, ngay };
}
