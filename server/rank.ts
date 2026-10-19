/**
 * ĐIỂM XẾP HẠNG ĐẤU TRƯỜNG — tầng ghi sổ (Hệ A).
 *
 * Toàn bộ TOÁN nằm ở `config/rank.ts` (thuần, test được không cần DB). File này
 * chỉ làm ba việc: đọc bậc lúc vào bàn, ghi sổ một trận, dựng snapshot bảng.
 *
 * ⚠ BA BẤT BIẾN, cả ba đều chặn ở đây VÀ ở tầng DB (0017):
 *   1. Tổng delta mỗi trận = 0. `deltaTran` throw nếu lệch, và CONSTRAINT TRIGGER
 *      `rank_ledger_zero_sum` nổ lúc COMMIT nếu tầng TS bị qua mặt.
 *   2. Chỉ trận TOÀN NGƯỜI THẬT mới ghi điểm (D31). Một ghế bot là REFUSE, không
 *      phải "bỏ qua ghế đó" — bỏ qua thì phần điểm của bot bay hơi và tổng ≠ 0,
 *      tức bot trở thành máy in điểm.
 *   3. Điểm KHÔNG PHẢI T, KHÔNG PHẢI Q (A3.5). File này không chạm bankroll,
 *      quest_points, wallet_ledger, treasury_ledger.
 */
import type pg from 'pg';
import { bacDaNhanStickerTrongMua, capStickerLenBac } from './huy_hieu.js';
import {
  diemPveTheoHang,
  BAC_MAC_DINH_CHUA_XEP, BXH, NGUONG_XEP_BAC_A, RANK_FORMULA_VERSION,
  type BacId, bacSoTuNhan, bacTuDiem, conThieuLenBac, deltaTran, dinhNghiaBac,
  nacTuDiem, soCapThang,
} from '../config/rank.js';

export type CheDoRank = 'rank_slot' | 'rank_bu';

type Db = pg.Pool | pg.PoolClient;

/** Một ghế trong bàn xếp hạng. `userId = null` ⇒ bàn không đủ điều kiện ghi điểm. */
export type GheKetTran = {
  gheId: string;
  userId: string | null;
  /** Bậc ĐÃ HIỂN THỊ cho đối thủ lúc vào bàn (`holdem_results.bac_rank`). */
  bacVaoBan: string;
};

export type KetQuaGhiDiem = {
  ghi: boolean;
  ly_do_bo_qua?: string;
  theo_ghe: Record<string, { user_id: string; delta: number; diem_sau: number }>;
};

/** Tiến độ xếp hạng của một người — thứ duy nhất được phép hiện cho chính chủ. */
export type TienDoRank = {
  season_id: string;
  diem: number;
  diem_dinh: number;
  so_tran: number;
  bac: BacId;
  bac_ten: string;
  bac_biet_danh: string;
  bac_icon: string;
  bac_icon_lon: string;
  nac: number | null;
  con_thieu_diem: number | null;
  con_thieu_tran: number;
  hang: number | null;
  /** D32 — phân vị cho MỌI người; `null` khi chưa xếp bậc hoặc bảng còn trống. */
  phan_vi: number | null;
  /** Id các bậc đã nhận sticker vinh danh TRONG MÙA NÀY (huy_hieu_cap) — ô nào chưa có thì màn vẽ bóng xám. */
  sticker_da_nhan: string[];
  formula_version: string;
};

/**
 * Bậc để GHI VÀO SƠ ĐỒ GHẾ lúc tạo trận.
 *
 * ⚠ Đây là chỗ sửa một lỗi đang sống: `holdem_api.ts` sinh `bac_rank` bằng
 *   `BAC_RANK[(seed + i*3) % 3]` với BAC_RANK = ['Đồng','Bạc','Vàng']. Tức badge
 *   rank của đối thủ (a) NGẪU NHIÊN theo seed, không dựa trên gì, và (b) trùng
 *   đúng ba chữ của bậc Brier ở Hệ B. Cả hai đều làm bẩn D25/R1: event ghi "bậc
 *   đối thủ mà người chơi đã thấy" để khử nhiễu nể-cao/lấn-thấp, mà nhãn đó lại
 *   là số ngẫu nhiên thì phép khử nhiễu cho ra kết luận sai — tệ hơn là không có.
 */
export async function bacVaoBanChoNguoi(
  db: Db, userId: string, seasonId: string,
): Promise<BacId> {
  const { rows } = await db.query(
    `SELECT diem, so_tran, hang FROM rank_diem WHERE user_id = $1 AND season_id = $2`,
    [userId, seasonId],
  );
  const r = rows[0];
  if (!r) return 'chua_xep';
  return bacTuDiem(Number(r.diem), Number(r.so_tran), r.hang === null ? null : Number(r.hang));
}

/**
 * Bậc của một ghế BOT.
 *
 * Bot KHÔNG có điểm xếp hạng và không bao giờ có (D31: rank toàn người thật), nên
 * nhãn trung thực duy nhất là "chưa xếp bậc". Gán cho bot một bậc trông thật là
 * bịa mất mát xã hội không tồn tại (D25 — "đối thủ thấy mình là cái để mất"), và
 * nó đầu độc đúng cột mà R1 dùng để đo phản ứng theo bậc đối thủ.
 */
export const BAC_BOT: BacId = 'chua_xep';

/** Nhãn hiển thị của một bậc — dùng cho badge trong trận, không lộ điểm (D25/R4). */
export function nhanBac(raw: string | null | undefined): string {
  if (!raw) return dinhNghiaBac('chua_xep').ten;
  const b = dinhNghiaBac(raw as BacId);
  return b.biet_danh ? `${b.ten} · ${b.biet_danh}` : b.ten;
}

/** Nhãn NGẮN cho badge chật (≤8 ghế trên một hàng): chỉ biệt danh sinh vật biển. */
export function nhanBacNgan(raw: string | null | undefined): string {
  const b = dinhNghiaBac((raw ?? 'chua_xep') as BacId);
  return b.biet_danh || 'Chưa xếp';
}

/**
 * GHI SỔ ĐIỂM một trận xếp hạng. Gọi TRONG transaction kết trận.
 *
 * Vì sao cùng transaction: A7 đòi event ghi cùng transaction với hành động nghiệp
 * vụ, và ở đây còn nặng hơn — nửa vời là bảng xếp hạng lệch khỏi kết quả trận, mà
 * `rank_ledger` là append-only nên không sửa lại được.
 */
export async function ghiDiemTran(
  /**
   * ⚠ PHẢI là một connection ĐANG TRONG TRANSACTION. `rank_ledger_zero_sum` là
   * CONSTRAINT TRIGGER DEFERRABLE INITIALLY DEFERRED, tức nó kiểm lúc COMMIT. Gọi
   * hàm này trên Pool (mỗi câu tự commit) thì dòng ĐẦU TIÊN đã nổ vì lúc đó tổng
   * mới chỉ là delta của một ghế.
   */
  client: Db,
  arg: {
    matchId: string;
    seasonId: string;
    cheDo: CheDoRank;
    soLa: number;
    /** id ghế theo thứ hạng cuối trận, TỐT NHẤT TRƯỚC. */
    hangTheoGhe: readonly string[];
    ghe: readonly GheKetTran[];
  },
): Promise<KetQuaGhiDiem> {
  const theoId = new Map(arg.ghe.map((g) => [g.gheId, g]));
  const bot = arg.ghe.filter((g) => !g.userId);
  if (bot.length > 0) {
    // D31: đấu tự do (có bot) KHÔNG tính điểm rank. Đây là chốt chặn cuối, không
    // phải nơi quyết định — người gọi phải không gọi mới đúng.
    return {
      ghi: false,
      ly_do_bo_qua: `bàn có ${bot.length} ghế không phải người thật`,
      theo_ghe: {},
    };
  }
  if (arg.hangTheoGhe.length < 2) {
    return { ghi: false, ly_do_bo_qua: 'bàn dưới 2 ghế', theo_ghe: {} };
  }

  const bacSo: Record<string, number> = {};
  for (const gheId of arg.hangTheoGhe) {
    const g = theoId.get(gheId);
    if (!g) throw new Error(`Ghế ${gheId} có trong bảng hạng nhưng không có trong sơ đồ`);
    bacSo[gheId] = bacSoTuNhan(g.bacVaoBan);
  }

  const delta = deltaTran(arg.hangTheoGhe, bacSo);
  const soGhe = arg.hangTheoGhe.length;
  const out: KetQuaGhiDiem['theo_ghe'] = {};

  for (let i = 0; i < arg.hangTheoGhe.length; i += 1) {
    const gheId = arg.hangTheoGhe[i]!;
    const g = theoId.get(gheId)!;
    const userId = g.userId!;
    const hang = i + 1;
    const d = delta[gheId]!;

    /*
     * UPSERT cache điểm — 1 UPDATE trong transaction đã có, KHÔNG phải một truy
     * vấn "SUM mọi trận" (L9/D11 §6.2). `diem_dinh` chỉ tăng: nó là sàn ghép bàn
     * chống thả rank, nên nó không được đi xuống cùng điểm.
     */
    const { rows } = await client.query(
      `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran, updated_at)
            VALUES ($1, $2, $3, GREATEST($3, 0), 1, now())
       ON CONFLICT (user_id, season_id) DO UPDATE
          SET diem = rank_diem.diem + $3,
              diem_dinh = GREATEST(rank_diem.diem_dinh, rank_diem.diem + $3),
              so_tran = rank_diem.so_tran + 1,
              updated_at = now()
       RETURNING diem, so_tran`,
      [userId, arg.seasonId, d],
    );
    const diemSau = Number(rows[0]!.diem);
    const soTran = Number(rows[0]!.so_tran);

    await client.query(
      `INSERT INTO rank_ledger
         (user_id, season_id, che_do, match_id, so_ghe, so_la, hang, so_cap_thang,
          bac_vao_ban, delta, diem_sau, formula_version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (match_id, user_id) DO NOTHING`,
      [userId, arg.seasonId, arg.cheDo, arg.matchId, soGhe, arg.soLa, hang,
       soCapThang(soGhe, hang), g.bacVaoBan, d, diemSau, RANK_FORMULA_VERSION],
    );

    /*
     * EVENT — snapshot gọn (A7, ≤~300 byte). Bối cảnh đối thủ D25/R1 là các BẬC
     * đã hiển thị, không phải điểm: điểm của đối thủ chưa bao giờ ở trên màn hình
     * nên log nó là log thứ người chơi không thấy.
     */
    const bacTruoc = bacTuDiem(diemSau - d, soTran - 1);
    const bacSauTran = bacTuDiem(diemSau, soTran);
    await client.query(
      `INSERT INTO events (user_id, context_type, context_id, action_type, value_num, value_json)
       VALUES ($1, 'holdem', $2, 'rank_diem_thay_doi', $3, $4)`,
      [userId, arg.matchId, d, JSON.stringify({
        hang,
        so_ghe: soGhe,
        so_cap_thang: soCapThang(soGhe, hang),
        bac_vao_ban: g.bacVaoBan,
        bac_doi_thu: arg.hangTheoGhe.filter((x) => x !== gheId).map((x) => theoId.get(x)!.bacVaoBan),
        diem_sau: diemSau,
        v: RANK_FORMULA_VERSION,
      })],
    );
    if (bacSauTran !== bacTruoc) {
      const len = (dinhNghiaBac(bacSauTran).bac || 0) > (dinhNghiaBac(bacTruoc).bac || 0);
      await client.query(
        `INSERT INTO events (user_id, context_type, context_id, action_type, value_json)
         VALUES ($1, 'holdem', $2, $3, $4)`,
        [userId, arg.matchId, len ? 'rank_len_bac' : 'rank_tut_bac',
         JSON.stringify({ tu: bacTruoc, den: bacSauTran, diem: diemSau })],
      );
      // Sticker vinh danh của bậc MỚI (SPEC huy-hieu-hang-sticker). Chỉ khi LÊN — tụt bậc không lấy lại gì,
      // và lên lại bậc cũ trong cùng mùa không cấp thêm (PK `huy_hieu_cap`).
      if (len) await capStickerLenBac(client, userId, arg.seasonId, bacSauTran);
    }

    await client.query(
      `UPDATE holdem_results SET diem_truoc = $1, diem_sau = $2
        WHERE match_id = $3 AND ghe_id = $4`,
      [diemSau - d, diemSau, arg.matchId, gheId],
    );

    out[gheId] = { user_id: userId, delta: d, diem_sau: diemSau };
  }

  return { ghi: true, theo_ghe: out };
}

/** Đọc tiến độ xếp hạng cho HỒ SƠ và màn Chốt phiên. Hai lookup theo khoá chính. */
export async function layTienDoRank(
  db: Db, userId: string, seasonId: string,
): Promise<TienDoRank> {
  const [diemQ, snapQ, stickerDaNhan] = await Promise.all([
    db.query(
      `SELECT diem, diem_dinh, so_tran, hang
         FROM rank_diem WHERE user_id = $1 AND season_id = $2`,
      [userId, seasonId],
    ),
    /*
     * Tổng người đã xếp bậc lấy từ SNAPSHOT, không phải COUNT(*) lúc có request:
     * bảng xếp hạng là truy vấn ai cũng mở (L9), nên mọi con số tổng phải đã được
     * tính sẵn bởi job 10 phút.
     */
    db.query(
      `SELECT payload_json -> 'tong_xep_bac' AS tong
         FROM bxh_snapshots WHERE bang_id = 'dau_truong' AND season_id = $1`,
      [seasonId],
    ),
    bacDaNhanStickerTrongMua(db, userId, seasonId),
  ]);

  const r = diemQ.rows[0] ?? { diem: 0, diem_dinh: 0, so_tran: 0, hang: null };
  const diem = Number(r.diem);
  const soTran = Number(r.so_tran);
  const hang = r.hang === null || r.hang === undefined ? null : Number(r.hang);
  const bac = bacTuDiem(diem, soTran, hang);
  const b = dinhNghiaBac(bac);
  const tong = Number(snapQ.rows[0]?.tong ?? 0);

  return {
    season_id: seasonId,
    diem,
    diem_dinh: Number(r.diem_dinh),
    so_tran: soTran,
    bac,
    bac_ten: b.ten,
    bac_biet_danh: b.biet_danh,
    bac_icon: b.icon,
    bac_icon_lon: b.icon_lon,
    nac: nacTuDiem(diem, bac),
    con_thieu_diem: bac === 'chua_xep' ? null : conThieuLenBac(diem, bac),
    con_thieu_tran: Math.max(0, NGUONG_XEP_BAC_A - soTran),
    hang,
    // Phân vị: 1 = dẫn đầu. Làm tròn LÊN để "top 12%" không bao giờ nói quá.
    phan_vi: hang !== null && tong > 0 ? Math.max(1, Math.ceil((hang / tong) * 100)) : null,
    sticker_da_nhan: stickerDaNhan,
    formula_version: RANK_FORMULA_VERSION,
  };
}

export type DongBxh = {
  hang: number; user_id: string; handle: string; diem: number; so_tran: number;
};

/** Đọc snapshot bảng Đấu trường — 1 SELECT theo khoá chính, không aggregate. */
export async function docBxhDauTruong(
  db: Db, seasonId: string,
): Promise<{ dong: DongBxh[]; tong_xep_bac: number; computed_at: string | null }> {
  const { rows } = await db.query(
    `SELECT payload_json, computed_at FROM bxh_snapshots
      WHERE bang_id = 'dau_truong' AND season_id = $1`,
    [seasonId],
  );
  const p = rows[0]?.payload_json as { dong?: DongBxh[]; tong_xep_bac?: number } | undefined;
  return {
    dong: (p?.dong ?? []).slice(0, BXH.SO_DONG),
    tong_xep_bac: Number(p?.tong_xep_bac ?? 0),
    computed_at: rows[0]?.computed_at ? new Date(rows[0].computed_at).toISOString() : null,
  };
}

/**
 * Dựng lại snapshot. Gọi từ pg_cron ở prod (0 request Vercel) VÀ từ /internal/tick
 * (lớp 2 dự phòng) VÀ từ test — vì pg_cron không tồn tại ở DB local (0005) và
 * A8.9 cấm mock để né thiết kế sai.
 */
export async function xayBxh(db: Db, seasonId: string): Promise<number> {
  const { rows } = await db.query('SELECT xay_bxh_dau_truong($1, $2) AS so_dong',
    [seasonId, BXH.SO_DONG]);
  return Number(rows[0]?.so_dong ?? 0);
}

/**
 * KIỂM TOÁN LẠM PHÁT — đọc trực tiếp từ sổ, không tin cache.
 *
 * Founder: "nhớ tính toán sao cho không bị lạm phát". Đây là phép kiểm SỐ của câu
 * đó, chạy được bất cứ lúc nào: `tran_lech` phải rỗng và `tong_he` phải bằng
 * `−quy_diem` (Σ điểm người + Quỹ điểm = 0).
 */
export async function kiemToanLamPhat(
  db: Db, seasonId: string,
): Promise<{ tran_lech: string[]; tong_he: number; quy_diem: number; can: boolean }> {
  const [lech, tong, quy] = await Promise.all([
    db.query('SELECT match_id FROM rank_kiem_toan LIMIT 20'),
    db.query('SELECT COALESCE(SUM(diem), 0)::int AS t FROM rank_diem WHERE season_id = $1',
      [seasonId]),
    db.query(
      `SELECT COALESCE((SELECT so_du_sau FROM rank_quy_diem
                         WHERE season_id = $1 ORDER BY entry_id DESC LIMIT 1), 0)::int AS q`,
      [seasonId]),
  ]);
  const tongHe = Number(tong.rows[0]!.t);
  const quyDiem = Number(quy.rows[0]!.q);
  return {
    tran_lech: lech.rows.map((x) => String(x.match_id)),
    tong_he: tongHe,
    quy_diem: quyDiem,
    can: lech.rows.length === 0 && tongHe + quyDiem === 0,
  };
}

/**
 * GHI ĐIỂM PvE — chế độ XẾP HẠNG mùa Beta (founder mở khoá 28/07).
 *
 * KHÔNG đi qua `rank_ledger` (sổ đó zero-sum theo bàn, PvP-only, có trigger DB
 * gác) — điểm PvE là QUỸ CHI RA, đúng khuôn 0017 đã khắc: "mọi dịch chuyển điểm
 * KHÔNG PHẢI từ một bàn phải có đối ứng ở rank_quy_diem". Nhờ vậy bất biến
 * kiểm toán Σ điểm + quỹ = 0 giữ nguyên, `kiemToanLamPhat` không đổi một dòng.
 *
 * ⚠ PHẢI trong transaction (cùng lý do `ghiDiemTran`). Khoá dòng quỹ mới nhất
 * bằng advisory lock theo mùa: hai trận PvE kết cùng lúc mà cùng đọc một
 * `so_du_sau` là sổ chẻ nhánh — hiếm, nhưng sổ thì không được phép hiếm-sai.
 */
export async function ghiDiemPve(
  client: Db,
  arg: { userId: string; seasonId: string; hang: number },
): Promise<number> {
  /*
   * ⚠⚠ KHOÁ RANK CHO KHÁCH — TẦNG HAI (founder chốt 04/08).
   *
   * Tầng một chặn ở cửa tạo trận (`holdem_api.ts`), và đó là LỜI HỨA VỚI NGƯỜI
   * DÙNG: họ biết trước trận này không tính. Tầng này là BẤT BIẾN CỦA THANG XẾP
   * HẠNG: dù đường nào gọi tới đây — endpoint mới, script vá dữ liệu, một nhánh
   * ai đó thêm sau — điểm cũng không rơi vào tài khoản khách.
   *
   * Hai tầng vì chúng hỏng theo hai cách khác nhau: quên tầng một thì người dùng
   * bị lừa; quên tầng hai thì bảng xếp hạng bị bẩn, và `rank_diem` thì cộng dồn
   * nên bẩn rồi phải đi bút toán ngược (D55 đã phải làm đúng việc đó một lần).
   */
  const { rows: kh } = await client.query(
    `SELECT la_khach FROM users WHERE user_id = $1`, [arg.userId]);
  if (kh[0]?.la_khach === true) return 0;

  const diem = diemPveTheoHang(arg.hang);
  // Trận về hạng không điểm VẪN đếm so_tran: bậc cần ≥5 trận để xếp, và "đã
  // đánh 5 trận toàn bét" là thông tin thật, không phải thứ để giấu.
  const { rows: sau } = await client.query(
    `INSERT INTO rank_diem (user_id, season_id, diem, diem_dinh, so_tran)
       VALUES ($1, $2, $3, GREATEST($3, 0), 1)
     ON CONFLICT (user_id, season_id) DO UPDATE SET
       diem = rank_diem.diem + $3,
       diem_dinh = GREATEST(rank_diem.diem_dinh, rank_diem.diem + $3),
       so_tran = rank_diem.so_tran + 1,
       updated_at = now()
     RETURNING diem, so_tran`,
    [arg.userId, arg.seasonId, diem]);
  // PvE cũng leo bậc được (điểm +3/+1) nhưng không đi qua sổ `rank_ledger`/event `rank_len_bac` — sticker vinh
  // danh phải đi theo BẬC, không theo chế độ, nên so bậc trước/sau ngay tại chỗ điểm đổi.
  const diemSau = Number(sau[0]!.diem);
  const soTranSau = Number(sau[0]!.so_tran);
  const bacTruoc = bacTuDiem(diemSau - diem, soTranSau - 1);
  const bacSauPve = bacTuDiem(diemSau, soTranSau);
  if ((dinhNghiaBac(bacSauPve).bac || 0) > (dinhNghiaBac(bacTruoc).bac || 0)) {
    await capStickerLenBac(client, arg.userId, arg.seasonId, bacSauPve);
  }
  if (diem > 0) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('rank_quy_diem:' || $1))`,
      [arg.seasonId]);
    await client.query(
      `INSERT INTO rank_quy_diem (season_id, delta, so_du_sau, reason)
       VALUES ($1, $2,
         COALESCE((SELECT so_du_sau FROM rank_quy_diem
                    WHERE season_id = $1 ORDER BY entry_id DESC LIMIT 1), 0) + $2,
         'chi_pve')`,
      [arg.seasonId, -diem]);
  }
  return diem;
}

/** Bậc số của người chưa từng chơi — export để test khỏi chép lại hằng số. */
export const BAC_SO_CHUA_XEP = BAC_MAC_DINH_CHUA_XEP;
