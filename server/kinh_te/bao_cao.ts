/**
 * BÁO CÁO KINH TẾ — tầng T5 (`kien-truc-ky-thuat.md` §2): **CHỈ ĐỌC**.
 * Không một INSERT/UPDATE/DELETE nào trong file này, cùng lối `admin_kho.ts` (D209).
 *
 * ─── VÌ SAO CÓ TỆP NÀY ──────────────────────────────────────────────────────
 * D16 §6 đã yêu cầu "đo hàng tuần từ audit_supply" và liệt kê 7 ngưỡng vặn —
 * **nhưng chưa ai dựng cái bảng đó**, nên suốt 50 ngày không ai đọc được Kho bạc
 * còn sống bao lâu. Đây là bảng đó.
 *
 * ─── RANH VỚI `audit.ts` (D61 — một nguồn) ──────────────────────────────────
 * `audit.ts` sở hữu câu hỏi **"sổ có CÂN không"** và tệp này gọi nó chứ không
 * hỏi lại. Tệp này sở hữu câu hỏi khác: **"tiền chảy đi đâu, còn được bao lâu"**.
 * Không chép lại bất biến nào của audit; không đọc `AuditReport.numbers` theo
 * nhãn tiếng Việt (nhãn là để người đọc — khoá theo nhãn là một liên kết sẽ gãy
 * im lặng khi ai đó sửa chính tả).
 *
 * ─── HAI LUẬT ĐỌC SỐ, KHÔNG THƯƠNG LƯỢNG ───────────────────────────────────
 * 1. **Thiếu nguồn ⇒ `null`, KHÔNG phải 0** (A11.2/D62/D67). Một chỉ số chưa có
 *    đường dữ liệu mà trả 0 sẽ được đọc như "đã đo, và bằng không".
 * 2. **Mẫu số phải đi kèm mọi con số** (A11.1/D223: 26/26 tài khoản prod là của
 *    founder). Báo cáo luôn trả `mauSo`, và tự dựng cờ `canhBaoMauSo` khi số
 *    người thật quá nhỏ để một tỷ lệ có nghĩa.
 */
import type pg from 'pg';
import { ECONOMY } from '../../config/economy.js';
import { GR_BP, GUARDRAIL } from '../../config/guardrail.js';
import { tranQMua } from '../../config/progression.js';
import { auditSupply } from '../audit.js';
import { chiSoThucHien, sucMuaBp } from './chi_so_gia.js';
import { docGiaThucHien } from './gia_thuc_hien.js';
import {
  danhGiaGuardrail, runwayTuCuaSo, soDoRong,
  type DongBaoDong, type SoDoKinhTe,
} from './mo_phong.js';
import { soDuQuyCho } from './quy_cho.js';

/**
 * Tái xuất từ `config/guardrail.ts` — ngưỡng sống ở đó cùng mọi ngưỡng khác, đây
 * chỉ là cái tên ngắn cho test và CLI gọi. Không chép GIÁ TRỊ (D61).
 */
export const MAU_SO_TOI_THIEU = GUARDRAIL.MAU_SO_TOI_THIEU;

/** Số ngày của cửa sổ "gần đây" cho runway và ống trợ cấp→lò đốt. */
export const CUA_SO_NGAY = 7;

/**
 * Cửa sổ dài hơn cho XU HƯỚNG (sink/faucet). D16 nói "sink/faucet < 1 KÉO DÀI",
 * tức nó là một xu hướng chứ không phải ảnh chụp một tuần.
 */
export const CUA_SO_XU_HUONG_NGAY = 30;

/** Trên ngần này ví thì thôi kéo cả bảng về tính Gini — trả `null` và nói rõ. */
const TRAN_VI_TINH_GINI = 100_000;

export interface BaoCaoKinhTe {
  mauSo: {
    tongTaiKhoan: number;
    tester: number;
    khach: number;
    /** Không phải tester, không phải khách, chưa xoá. */
    that: number;
    canhBaoMauSo: boolean;
  };
  cung: {
    mintRong: string;
    daDot: string;
    tongCung: string;
    sigmaVi: string;
    khoBac: string;
    /** Verdict CÂN lấy nguyên từ `audit.ts` — không tính lại. */
    can: boolean;
    vanDe: string[];
  };
  khoBacDong: {
    vaoTheoLyDo: Record<string, string>;
    raTheoLyDo: Record<string, string>;
    soDu: string;
    chiMoiNgay7Ngay: string;
    /** `null` = không chi gì trong cửa sổ ⇒ runway không xác định, KHÔNG phải vô hạn-bằng-0. */
    runwayNgay: number | null;
  };
  troCap: {
    phat7Ngay: string;
    /** Gacha đốt của những người CÓ nhận trợ cấp trong cửa sổ — xem ghi chú dưới. */
    dotBoiNguoiNhan7Ngay: string;
    vaoLoDotBp: number | null;
    /** Người ĐỦ ĐIỀU KIỆN (dưới ngưỡng, không phải khách, chưa xoá) — không phải mọi ví thấp. */
    soNguoiDuDieuKien: number;
    tuanDuKien: string;
    /** Đây là ƯỚC LƯỢNG THEO NGƯỜI, không phải truy vết từng đồng. */
    ghiChu: string;
  };
  q: {
    phat: string;
    tieu: string;
    ton: string;
    tranPhatMua: number;
    tonBinhQuan: number | null;
    sinkPhatBp: number | null;
  };
  xuHuong: {
    cuaSoNgay: number;
    /** Phát trong cửa sổ. **KHÔNG gồm vốn genesis** — genesis là vốn hoá một lần. */
    phat: string;
    dot: string;
    sinkFaucetBp: number | null;
  };
  /**
   * CHỢ VẬT PHẨM — vòng quay, phí thực thu, và chỉ số giá THỰC HIỆN (D286).
   *
   * Đây là chỗ trả lời câu trung tâm của cả bản thiết kế (D68/D263): *"chợ vật
   * phẩm có thay nổi vai rake không?"* — nên nó phải nằm cạnh dòng Kho bạc, chứ
   * không nằm trong một màn riêng ai đó phải nhớ mở.
   */
  cho: {
    cuaSoNgay: number;
    /** Số giao dịch MUA (người chơi trả tiền) trong cửa sổ. */
    soLuotMua: number;
    /** Tổng T người chơi đã trả — vòng quay chợ. */
    vongQuayT: string;
    phiDot: string;
    phiKhoBac: string;
    /**
     * Số lượt mua đóng **0 phí** vì 3% và 2% đều làm tròn xuống 0 (giao dịch
     * dưới 34 T / 50 T). Con số này là điều kiện kích hoạt đo được cho câu hỏi
     * "có cần sàn phí không" — hoãn phải kèm mốc đo, không phải "để sau" (A11.15).
     */
    soLuotPhiBang0: number;
    /**
     * Chỉ số giá THỰC HIỆN, bp. `null` = **chưa đủ giao dịch để nói**, không
     * phải 0 (A11.2). Rổ thiếu một bậc là cả chỉ số `null` — cố ý.
     */
    chiSoThucHienBp: number | null;
    /** Sức mua của T so với kỳ gốc, bp. 10.000 = y như kỳ gốc. */
    sucMuaBp: number | null;
    /** Số giao dịch từng bậc đã tính — để người đọc biết mẫu mỏng cỡ nào. */
    soGiaoDichTheoBac: Record<string, number>;
    /** Số dư quỹ chợ. `null` = migration 0058 chưa chạy trên DB này. */
    quyCho: string | null;
  };
  phanPhoi: {
    /**
     * Dân số của median/Gini: **TẤT CẢ tài khoản**, gồm tester và khách — cùng
     * dân số với `cung.sigmaVi` để hai con số đọc được cạnh nhau. Ở mẫu số hôm
     * nay (D223) lọc tester đi thì không còn ai để tính.
     */
    tren: 'tat_ca_tai_khoan';
    medianVi: string | null;
    giniBp: number | null;
  };
  baoDong: DongBaoDong[];
}

async function mot(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<bigint> {
  const { rows } = await pool.query(sql, params);
  return BigInt(rows[0]?.s ?? 0);
}

/**
 * Tổng theo `reason`, chia hai chiều vào/ra.
 *
 * ⚠ `bang` là UNION TYPE, không phải `string`, và đó là chủ ý. Một hàm nhận tên
 * bảng kiểu `string` rồi ghép thẳng vào SQL là hình dạng mà sau này ai đó sẽ
 * truyền vào một giá trị đến từ URL — `admin_kho.ts` đã phải dựng cả một hàng
 * rào riêng cho đúng ca đó (D209). Đóng miền giá trị ở tầng kiểu thì không có
 * ca đó để mà rào.
 */
async function theoLyDo(
  pool: pg.Pool, bang: 'treasury_ledger' | 'wallet_ledger' | 'quest_ledger',
  chieu: 'vao' | 'ra',
): Promise<Record<string, string>> {
  const dau = chieu === 'vao' ? '>' : '<';
  const { rows } = await pool.query(
    `SELECT reason, COALESCE(SUM(delta), 0)::text AS s
       FROM ${bang} WHERE delta ${dau} 0 GROUP BY reason ORDER BY reason`,
  );
  const ra: Record<string, string> = {};
  for (const r of rows) ra[r.reason as string] = String(r.s);
  return ra;
}

/**
 * Gini trên ví T. Trả `null` khi không đủ mẫu (< 2 ví) hoặc quá nhiều ví để kéo
 * về — cả hai đều là "không đo được", và cả hai phải là `null` chứ không phải 0
 * (0 nghĩa là "bình đẳng tuyệt đối", một kết luận hoàn toàn khác).
 */
export function giniBp(viDaSapXep: readonly bigint[]): number | null {
  const n = viDaSapXep.length;
  if (n < 2) return null;
  let tong = 0n;
  let congDon = 0n;
  for (let i = 0; i < n; i += 1) {
    const v = viDaSapXep[i]!;
    tong += v;
    congDon += BigInt(i + 1) * v;
  }
  if (tong === 0n) return null; // mọi ví bằng 0 ⇒ không có phân phối để nói
  // Gini = (2·Σ(i·x_i) / (n·Σx)) − (n+1)/n, tính bằng bp, số nguyên thuần (C5).
  const bn = BigInt(n);
  const veTrai = (2n * congDon * BigInt(GR_BP)) / (bn * tong);
  const vePhai = ((bn + 1n) * BigInt(GR_BP)) / bn;
  const g = veTrai - vePhai;
  return Number(g < 0n ? 0n : g);
}

export async function docBaoCaoKinhTe(pool: pg.Pool): Promise<BaoCaoKinhTe> {
  // ── mẫu số ───────────────────────────────────────────────────────────────
  const { rows: ms } = await pool.query(
    `SELECT COUNT(*)::int                                              AS tong,
            COUNT(*) FILTER (WHERE la_tester)::int                     AS tester,
            COUNT(*) FILTER (WHERE la_khach)::int                      AS khach,
            COUNT(*) FILTER (WHERE NOT la_tester AND NOT la_khach
                             AND deleted_at IS NULL)::int              AS that
       FROM users`,
  );
  const mauSo = {
    tongTaiKhoan: ms[0].tong as number,
    tester: ms[0].tester as number,
    khach: ms[0].khach as number,
    that: ms[0].that as number,
    canhBaoMauSo: (ms[0].that as number) < MAU_SO_TOI_THIEU,
  };

  // ── cung (verdict CÂN lấy từ audit, không tính lại) ──────────────────────
  const kiemToan = await auditSupply(pool);
  const mintVi = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger
      WHERE reason IN ('signup_grant', 'admin_adjust')`);
  const mintGenesis = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger
      WHERE reason = 'genesis_grant'`);
  const daDot = await mot(pool, `SELECT COALESCE(SUM(amount), 0)::text AS s FROM burn_ledger`);
  const sigmaVi = await mot(pool, `SELECT COALESCE(SUM(bankroll), 0)::text AS s FROM users`);
  const khoBac = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger`);
  const mintRong = mintVi + mintGenesis;

  // ── dòng Kho bạc + runway ────────────────────────────────────────────────
  const chi7 = await mot(pool,
    `SELECT COALESCE(-SUM(delta), 0)::text AS s FROM treasury_ledger
      WHERE delta < 0 AND created_at > now() - make_interval(days => $1)`, [CUA_SO_NGAY]);
  // Chi bình quân vẫn in ra cho người đọc, nhưng runway KHÔNG suy từ nó — xem
  // chú thích `runwayTuCuaSo`: chia trước thì chi 6 T/7 ngày thành 0 T/ngày.
  const chiMoiNgay = chi7 / BigInt(CUA_SO_NGAY);
  const runway = runwayTuCuaSo(khoBac < 0n ? 0n : khoBac, chi7, CUA_SO_NGAY);

  // ── ống trợ cấp → lò đốt ─────────────────────────────────────────────────
  //
  // ⚠ ĐÂY LÀ ƯỚC LƯỢNG THEO NGƯỜI, KHÔNG PHẢI TRUY VẾT TỪNG ĐỒNG. T không có
  // màu: không có cách nào biết đồng T bị đốt có phải chính đồng trợ cấp hay
  // không. Phép đo trung thực nhất làm được: trong cùng cửa sổ, những người CÓ
  // nhận trợ cấp đã đốt bao nhiêu. Tỷ lệ này KHÔNG phải "phần trăm trợ cấp bị
  // đốt"; nó là "so với số trợ cấp đã phát, nhóm nhận đã đốt bằng chừng này".
  // Ghi rõ ở `ghiChu` để không ai đọc nhầm thành phép truy vết.
  const troCapPhat7 = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger
      WHERE reason = 'subsidy' AND created_at > now() - make_interval(days => $1)`,
    [CUA_SO_NGAY]);
  const dotBoiNguoiNhan7 = await mot(pool,
    `SELECT COALESCE(-SUM(w.delta), 0)::text AS s
       FROM wallet_ledger w
      WHERE w.reason = 'gacha_burn'
        AND w.created_at > now() - make_interval(days => $1)
        AND EXISTS (SELECT 1 FROM wallet_ledger t
                     WHERE t.user_id = w.user_id AND t.reason = 'subsidy'
                       AND t.created_at > now() - make_interval(days => $1))`,
    [CUA_SO_NGAY]);
  const vaoLoDotBp = troCapPhat7 > 0n
    ? Number((dotBoiNguoiNhan7 * BigInt(GR_BP)) / troCapPhat7)
    : null;

  // ── sink/faucet theo CỬA SỔ, KHÔNG tính genesis ──────────────────────────
  //
  // ⚠ Bản đầu đo trên tổng tích luỹ và tính cả vốn genesis. Hậu quả: mẫu số
  // phình vĩnh viễn bởi 20.000 T một-lần, nên tỷ lệ luôn thấp và chuông
  // `t_lam_phat` kêu ở MỌI lần chạy. Một chuông kêu mãi là một chuông sắp bị
  // tắt — và lúc nó bị tắt thì nó cũng thôi bảo vệ được gì.
  const phatCuaSo = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM wallet_ledger
      WHERE reason IN ('signup_grant', 'admin_adjust')
        AND created_at > now() - make_interval(days => $1)`, [CUA_SO_XU_HUONG_NGAY]);
  const dotCuaSo = await mot(pool,
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM burn_ledger
      WHERE created_at > now() - make_interval(days => $1)`, [CUA_SO_XU_HUONG_NGAY]);
  const tSinkFaucetBp = phatCuaSo > 0n
    ? Number((dotCuaSo * BigInt(GR_BP)) / phatCuaSo)
    : null;

  // ── Q ────────────────────────────────────────────────────────────────────
  const qPhat = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM quest_ledger WHERE delta > 0`);
  const qTieu = await mot(pool,
    `SELECT COALESCE(-SUM(delta), 0)::text AS s FROM quest_ledger WHERE delta < 0`);
  const qTon = await mot(pool, `SELECT COALESCE(SUM(quest_points), 0)::text AS s FROM users`);
  const tran = tranQMua();
  const qTonBinhQuan = mauSo.that > 0 ? Number(qTon) / mauSo.that : null;
  const qSinkPhatBp = qPhat > 0n ? Number((qTieu * BigInt(GR_BP)) / qPhat) : null;

  // ── chợ vật phẩm ─────────────────────────────────────────────────────────
  //
  // ⚠ Quỹ chợ có thể CHƯA TỒN TẠI (0058 chưa chạy trên DB này). Bảng thiếu ⇒
  // `null`, KHÔNG phải 0 (A11.2/D62) — "chưa có sổ" và "sổ rỗng" là hai chuyện,
  // và đọc nhầm cái đầu thành cái sau là báo cáo một quỹ cạn không tồn tại.
  const choTom = await docGiaThucHien(pool, CUA_SO_NGAY);
  const chiSoCho = chiSoThucHien(choTom.ro);
  const coQuyCho = (await pool.query(
    `SELECT to_regclass('quy_cho_ledger') AS r`)).rows[0].r !== null;
  const quyChoSoDu = coQuyCho ? await soDuQuyCho(pool) : null;
  const phiDot = await mot(pool,
    `SELECT COALESCE(SUM(amount), 0)::text AS s FROM burn_ledger
      WHERE reason = 'phi_cho_burn' AND created_at > now() - make_interval(days => $1)`,
    [CUA_SO_NGAY]);
  const phiKhoBac = await mot(pool,
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM treasury_ledger
      WHERE reason = 'phi_cho_in' AND created_at > now() - make_interval(days => $1)`,
    [CUA_SO_NGAY]);

  // ── phân phối ────────────────────────────────────────────────────────────
  let medianVi: bigint | null = null;
  let gini: number | null = null;
  const soVi = Number(await mot(pool, `SELECT COUNT(*)::text AS s FROM users`));
  if (soVi > 0 && soVi <= TRAN_VI_TINH_GINI) {
    const { rows } = await pool.query(
      `SELECT bankroll::text AS b FROM users ORDER BY bankroll`);
    const vis = rows.map((r) => BigInt(r.b as string));
    // Median DƯỚI khi số ví chẵn (lấy phần tử giữa bên trái). Chọn một quy ước
    // và ghi ra, vì "median" của n chẵn có hai định nghĩa và số sẽ lệch nhau.
    medianVi = vis[Math.floor((vis.length - 1) / 2)] ?? null;
    gini = giniBp(vis);
  }

  // ── guardrail ────────────────────────────────────────────────────────────
  // ⚠ Chỉ đếm người ĐỦ ĐIỀU KIỆN nhận trợ cấp. Khách bị `chanKhach` chặn từ
  // D79 (khách từng rút được Kho bạc), tài khoản đã xoá thì không nhận gì. Đếm
  // cả hai vào đây là thổi phồng "trợ cấp tuần dự kiến" ⇒ chuông `kho_bac_mong`
  // kêu vì một khoản chi không bao giờ xảy ra.
  const soDuoiNguong = Number(await mot(pool,
    `SELECT COUNT(*)::text AS s FROM users
      WHERE bankroll < $1 AND NOT la_khach AND deleted_at IS NULL`,
    [ECONOMY.SUBSIDY_THRESHOLD]));
  const soDo: SoDoKinhTe = {
    ...soDoRong(tran),
    medianVi,
    // Chuỗi tuần liên tiếp cần một bảng cuộn median theo tuần — CHƯA CÓ NGUỒN.
    // `null`, không phải 0: xem chú thích ở `SoDoKinhTe.soTuanMedianDuoiSan`.
    soTuanMedianDuoiSan: null,
    giniBp: gini,
    khoBacSoDu: khoBac,
    khoBacRunwayNgay: runway,
    troCapTuanDuKien: BigInt(soDuoiNguong) * BigInt(ECONOMY.SUBSIDY_AMOUNT) * 7n,
    tSinkFaucetBp,
    troCapVaoLoDotBp: vaoLoDotBp,
    qTonBinhQuan,
    qSinkPhatBp,
  };

  return {
    mauSo,
    cung: {
      mintRong: mintRong.toString(),
      daDot: daDot.toString(),
      tongCung: (mintRong - daDot).toString(),
      sigmaVi: sigmaVi.toString(),
      khoBac: khoBac.toString(),
      can: kiemToan.ok,
      vanDe: kiemToan.problems,
    },
    khoBacDong: {
      vaoTheoLyDo: await theoLyDo(pool, 'treasury_ledger', 'vao'),
      raTheoLyDo: await theoLyDo(pool, 'treasury_ledger', 'ra'),
      soDu: khoBac.toString(),
      chiMoiNgay7Ngay: chiMoiNgay.toString(),
      runwayNgay: runway,
    },
    troCap: {
      phat7Ngay: troCapPhat7.toString(),
      dotBoiNguoiNhan7Ngay: dotBoiNguoiNhan7.toString(),
      vaoLoDotBp,
      soNguoiDuDieuKien: soDuoiNguong,
      tuanDuKien: (soDo.troCapTuanDuKien ?? 0n).toString(),
      ghiChu: 'Ước lượng THEO NGƯỜI: T không có màu nên không truy vết được từng '
        + 'đồng. Đây là "nhóm có nhận trợ cấp đã đốt bao nhiêu trong cùng cửa sổ", '
        + 'KHÔNG phải "bao nhiêu phần trăm trợ cấp bị đốt".',
    },
    q: {
      phat: qPhat.toString(),
      tieu: qTieu.toString(),
      ton: qTon.toString(),
      tranPhatMua: tran,
      tonBinhQuan: qTonBinhQuan,
      sinkPhatBp: qSinkPhatBp,
    },
    xuHuong: {
      cuaSoNgay: CUA_SO_XU_HUONG_NGAY,
      phat: phatCuaSo.toString(),
      dot: dotCuaSo.toString(),
      sinkFaucetBp: tSinkFaucetBp,
    },
    cho: {
      cuaSoNgay: CUA_SO_NGAY,
      soLuotMua: choTom.tongLuot,
      vongQuayT: choTom.tongT.toString(),
      phiDot: phiDot.toString(),
      phiKhoBac: phiKhoBac.toString(),
      soLuotPhiBang0: choTom.soGiaoDichPhiBang0,
      chiSoThucHienBp: chiSoCho,
      sucMuaBp: sucMuaBp(chiSoCho),
      soGiaoDichTheoBac: choTom.soGiaoDich,
      quyCho: quyChoSoDu === null ? null : quyChoSoDu.toString(),
    },
    phanPhoi: {
      tren: 'tat_ca_tai_khoan',
      medianVi: medianVi === null ? null : medianVi.toString(),
      giniBp: gini,
    },
    baoDong: danhGiaGuardrail(soDo),
  };
}
