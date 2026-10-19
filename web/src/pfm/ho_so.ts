/**
 * PFM — HỒ SƠ HOÀN CẢNH (G1): ba câu user TỰ KHAI ở cửa vào Sổ, và là nguồn duy nhất
 * của ba đặc trưng `ctx_*`.
 *
 * ⚠⚠ BA MÃ `ctx_*` ĐÃ NẰM TRONG SỔ ĐĂNG KÝ TỪ ĐẦU MÀ **CHƯA BAO GIỜ CÓ AI PHÁT** —
 * `grep ctx_` ngoài `config/` ra 0. Tức sổ đăng ký khai một trục nghiên cứu, viết rõ
 * *"vì sao"* cho từng mã, rồi trục ấy rỗng ở mọi kỳ. Cùng họ với R8/D242/D261/D264: đầy
 * đủ ở một đầu, không nối được sang đầu kia, và không có gì đỏ.
 *
 * ⚠⚠ VÀ ĐÂY LÀ THỨ LÀM MỌI CHỈ SỐ CHI TIÊU CÓ NGHĨA. Chính sổ đăng ký nói: *"chi 2tr/
 * tháng"* của người phụ thuộc gia đình và của người tự trả tiền nhà là **hai hành vi
 * khác hẳn nhau*. Thiếu `ctx_*` thì mọi so sánh cohort là so hai nhóm không so được.
 *
 * ⚠ TỰ KHAI, KHÔNG SUY DIỄN (A10 · P14). App không đoán hoàn cảnh từ số tiền; nó hỏi ba
 * câu bằng MENU và chấp nhận "để sau". Đoán sai ở màn đầu tiên là mất niềm tin cho cả
 * phần sau — và một app tài chính đoán về hoàn cảnh người dùng thì đang kê đơn, không
 * còn mô tả.
 */
import { SO_DANG_KY } from '@config/pfm_dac_trung';
import type { BanGhi, KhoPfm } from './kho.js';
import type { KetQuaDoan } from './cham_doan.js';
import type { KyDaCham } from './so_doan.js';
import type { LuaChonHuong } from './huong.js';

/* ═══ 1. KIỂU SUY TỪ SỔ ĐĂNG KÝ — không chép tay miền ═══════════════════════ */

/**
 * ⚠⚠ SUY TỪ `SO_DANG_KY`, KHÔNG GÕ LẠI. Ba miền này đã có ở `config/pfm_dac_trung.ts`
 * và `kiemGiaTri` chặn theo đúng chúng; gõ lại ở client là dựng bản thứ hai của một enum
 * — đúng thứ R9/D250 vừa phải dọn khi `TRANG_THAI_NGAY`/`CHUYEN_TIEP_HU` bị chép sang
 * client. Bản thứ hai không sai lúc viết, nó sai vào ngày ai đó thêm một giá trị vào
 * config và quên chỗ này: TypeScript im, `kiemGiaTri` ném lúc chạy, và cú ném ấy nằm
 * trong `dongGoiKy` nên nó làm hỏng **cả gói của kỳ**, không riêng một dòng.
 */
export type MaTuLap = (typeof SO_DANG_KY)['ctx_tu_lap']['mien'][number];
export type MaNguonThu = (typeof SO_DANG_KY)['ctx_nguon_thu']['mien'][number];
export type MaKhung = (typeof SO_DANG_KY)['ctx_khung']['mien'][number];

export interface HoSo {
  /** Mức tự lập — trục cohort mạnh nhất của mọi chỉ số chi tiêu. */
  tuLap?: MaTuLap;
  /** Nguồn thu ⇒ NHỊP tiền vào (đều/thất thường). */
  nguonThu?: MaNguonThu;
  /** Khung phương pháp user CHỌN — biến cohort của P14/G6. */
  khung?: MaKhung;
  /**
   * ⚠ CHỈ Ở LẠI MÁY — cố ý KHÔNG có `ctx_*` nào cho nó.
   *
   * Nó chỉ dùng để `mauHopVoiHoSo` đưa hũ trả nợ lên đầu, tức một quyết định TRÌNH BÀY.
   * Thêm một mã đặc trưng cho nó là biến "tôi đang có nợ" thành dữ liệu nghiên cứu rời
   * máy — mà A8.2 nói agent không tự thêm trục đo, và đây còn là trục nhạy nhất trong
   * ba câu. Muốn đo thì founder chốt và thêm vào `SO_DANG_KY` trước.
   */
  coNo?: boolean;
  /* ── BA CÂU THÊM 08/09 (màn phỏng vấn) — CÙNG HẠNG VỚI `coNo` ────────────
   * Chỉ ở lại máy, KHÔNG có `ctx_*` nào, và giữ NGUYÊN NHÃN người đọc chứ chưa
   * đúc mã. Đúc mã bây giờ là tự đặt một trục nghiên cứu (A8.2) — muốn đo thì
   * founder chốt, thêm vào `SO_DANG_KY`, rồi mới đúc và mới cho vào `CAU_RA`.
   * Đến lúc đó nhớ: dữ liệu cũ trên máy người dùng vẫn là NHÃN, phải chuyển đổi
   * khi đọc chứ không được vứt.
   */
  /** Nhịp tiền vào — nhãn demo: 'đều mỗi tháng' · 'thất thường' · 'theo mùa'. */
  deu?: string;
  /** Việc muốn tiền làm được — nhãn demo, nhiều lựa chọn; `hu_mau` xếp mẫu theo nó. */
  mucTieu?: readonly string[];
  /** Lúc dễ tiêu quá tay — nhãn demo, nhiều lựa chọn. */
  nhip?: readonly string[];
  /* ── HAI NHÃN GỐC THÊM 08/09 (D308) — để SỬA LẠI được câu đã trả lời ─────
   * ⚠⚠ ĐÂY KHÔNG PHẢI BẢN SAO CỦA `nguonThu`/`coNo` (A11.5), mà là thứ chúng
   * KHÔNG giữ nổi. `nguonThu` đúc SÁU nhãn về BỐN mã và `coNo` đúc năm nhãn về
   * một `boolean` — cả hai đều MẤT THÔNG TIN, nên từ giá trị đã đúc không dựng
   * lại được người dùng đã chạm chip nào. Bốn câu còn lại đảo ngược đúng 1:1
   * (`khung`) hoặc vốn đã giữ nguyên nhãn (`deu`/`mucTieu`/`nhip`) ⇒ **cố ý
   * không** có `…Nhan` cho chúng: chép lại là dựng bản thứ hai thật.
   * ⚠ Chỉ ở lại máy, cùng hạng với `coNo`. Không mã `SO_DANG_KY` nào (A8.2).
   */
  /** Nhãn thô câu 1, giữ để màn phỏng vấn mở lại đúng chip đã chạm. */
  nguonThuNhan?: readonly string[];
  /** Nhãn thô câu 3 — xem `nguonThuNhan`. */
  coNoNhan?: readonly string[];
  /**
   * Khối lộ trình người chơi đã bấm `BỎ` (khoá = nhãn câu 4).
   *
   * ⚠ VÌ SAO KHÔNG XOÁ THẲNG NHÃN KHỎI `mucTieu`: "bỏ khối này khỏi lộ trình"
   * và "tôi không còn muốn mục tiêu ấy" là hai câu khác nhau, và `mucTieu` là
   * một câu trả lời phỏng vấn — sửa nó vì một cú ẩn thẻ là sửa lời khai của
   * người dùng sau lưng họ. Đường về: trả lời lại câu 4 ⇒ danh sách này bị xoá
   * sạch (xem `PhongVan.xong`).
   */
  loTrinhBo?: readonly string[];
  /* ── BA TRƯỜNG MÀN NGÀY ĐẦU (D355/D356, GIAI ĐOẠN A) ─────────────────────
   * ⚠⚠ CHỈ Ở LẠI MÁY, cùng hạng với `coNo`/ba câu 08/09: không `ctx_*` nào cho chúng
   * (A8.2 — agent không tự đặt trục đo). `web/src/pfm/chan_dung.ts` là nơi DUY NHẤT
   * đọc `chanDungBac`/`chanDungNhip` để suy chân dung + gợi ý luật; `dac_trung.ts` chỉ
   * đọc qua `ctxCuaHoSo()` (ba trường `tuLap`/`nguonThu`/`khung`) nên ba trường này
   * KHÔNG lọt vào gói đặc trưng — có bài canh ở `pfm_chan_dung.test.ts`.
   */
  /**
   * Khoá nét chân dung đã bác (`'nhip' | 'deu' | 'nguon'`) — người dùng chạm KHÔNG HẲN.
   * ⚠ "HOÀN TÁC"/"ĐỔI"/"THÔI, GIỮ NHƯ CŨ" đều XOÁ khoá khỏi đây (về lại nguyên trạng),
   * không có bản lưu lịch sử tách riêng — xem `chan_dung.ts` §`mucDoHieu` về hệ quả
   * cho thanh hiểu (điểm của nét ấy về 0 cùng lúc, khác demo giữ điểm vĩnh viễn).
   */
  chanDungBac?: readonly string[];
  /**
   * Khoá nét người dùng ĐÃ TỪNG chạm (bác hoặc tự chọn lại) — chỉ THÊM, HOÀN TÁC không gỡ. Thanh "mức độ hiểu
   * bạn" đếm trường NÀY chứ không đếm `chanDungBac`: demo đã duyệt (D356) giữ nguyên thanh khi người dùng đổi ý,
   * vì bấm nhầm rồi hoàn tác không được thành một hình phạt. CHỈ Ở LẠI MÁY như hai trường kia.
   */
  chanDungDaCham?: readonly string[];
  /** Chip câu 6 người dùng TỰ CHỌN LẠI sau khi bác nét `nhip` — override `hoSo.nhip[0]`. */
  chanDungNhip?: string;
  /** Việc "ba việc hôm nay" đã bấm BỎ — chỉ số 0(hũ)/1(luật)/2(ghi), xem `chan_dung.ts`. */
  ngayDauBo?: readonly number[];
  /* ── BỐN CÂU THÊM 21/09 (phỏng vấn bản mới) — CÙNG HẠNG VỚI `coNo` ───────────
   * ⚠⚠ CHỈ Ở LẠI MÁY, giữ NGUYÊN NHÃN người đọc, KHÔNG `ctx_*` nào. Ba câu đầu là
   * ba trục của chân dung hành tinh (`chan_dung_hanh.ts`), và chúng là thứ NHẠY hơn
   * hẳn sáu câu cũ: chúng nói người này xoay xở với tiền ra sao, không chỉ tiền từ
   * đâu tới. Đúc mã cho chúng = mở một trục nghiên cứu mới = A8.2 cấm, và còn là
   * CỬA MỘT CHIỀU (A11.1: thứ vào `events` không rút lại được).
   * Muốn đo thì founder chốt → thêm vào `SO_DANG_KY` → mới đúc → mới cho vào `CAU_RA`.
   * `docs/thiet-ke-de-xuat/pfm-hanh-vi/pfm-nhu-danh-muc-dau-tu.md` §8 đã vạch sẵn
   * ranh giới: chữ tự do ở lại máy, chỉ SỐ trần (độ chắc · sai số) mới được bàn cho ra.
   */
  /** Chi tiết khoản phải trả — chỉ hỏi khi câu nợ khác "không có". Nhãn thô. */
  noSo?: string;
  /** "Tiền vừa về, việc đầu tiên bạn làm với nó" — trục β của chân dung. Nhãn thô. */
  lucTienVe?: string;
  /** "Trả tiền xong một món hơi đắt, bạn thường…" — trục đau khi tiêu. Nhãn thô. */
  sauKhiTieu?: string;
  /** "Đầu tháng, bạn có biết tháng này tiền sẽ đi đâu không" — vành đai. Nhãn thô. */
  dauThang?: string;
  /* ── HAI TRƯỜNG SỔ LỜI ĐOÁN (D385) — CHỈ Ở LẠI MÁY, cùng hạng `coNo` ──────────
   * Để màn chân dung giữ được lời hứa "KIỂM ĐƯỢC": trước D385 `chamDoan()` không được màn nào
   * gọi. Không `ctx_*` nào (A8.2); nằm trong hồ sơ nên đi theo két như phần còn lại.
   */
  /**
   * Ngày (YYYY-MM-DD) lời đoán HIỆN TẠI được đưa ra = lần đầu nó hiện trên màn chân dung.
   * ⚠ Chỉ kỳ mở ra TỪ ngày này mới được chấm — chấm kỳ đã khép trước đó là đoán sau khi biết kết
   *   quả (`so_doan.ts`). `suaHoSo` tự GỠ trường này khi chip nhịp đổi: lời đoán mới, mốc mới.
   */
  doanTu?: string;
  /** Kỳ đã chấm (khoá `tuan:YYYY-MM-DD` · `thang:YYYY-MM`). Chỉ lưu TRÚNG/TRẬT — xem `so_doan.ts`. */
  soDoan?: Readonly<Record<string, KyDaCham>>;
  /**
   * ⭐ HƯỚNG ĐÃ CHẠM (D453 — `huong.ts`): mỗi lần người dùng CHỌN / GẠT ("không phải tôi") / BỎ CHỌN một hướng trên tấm
   * HƯỚNG của GƯƠNG. CHỈ NỐI THÊM (giữ `SO_LUA_CHON_NHO` lần gần nhất) — là lịch sử mà dòng học `huong_giu` đếm và phép
   * xếp hướng đọc. CHỈ Ở LẠI MÁY, cùng hạng `soDoan`: không `ctx_*` nào (A8.2), đi theo két như phần còn lại của hồ sơ.
   * Ghi qua `suaHoSo` (+ `noiLuaChon` của `huong.ts`), không bao giờ dựng từ state của màn.
   */
  huong?: readonly LuaChonHuong[];
}

/**
 * Chip "hiệu lực" của câu nhịp — dùng CHUNG cho `chanDung()`, gợi ý luật của `baViec()` (D61: một nguồn,
 * để chân dung và việc-2 không bao giờ kể hai chuyện khác nhau) VÀ cửa ghi `suaHoSo` (D385). Ưu tiên lựa
 * chọn người dùng TỰ CHỌN LẠI (`chanDungNhip`, A2); không có thì chip ĐẦU TIÊN của câu nhịp gốc.
 * ⚠ Sống ở đây chứ không ở `chan_dung.ts`: tệp này import ngược `chan_dung.ts` là thành vòng import.
 */
export function chipHieuLuc(hoSo: Pick<HoSo, 'nhip' | 'chanDungNhip'>): string | undefined {
  return hoSo.chanDungNhip ?? hoSo.nhip?.[0];
}

/** Ba câu ĐI RA NGOÀI. `coNo` + ba câu 08/09 cố ý vắng mặt — xem chú thích của chúng. */
const CAU_RA: readonly (keyof HoSo)[] = ['tuLap', 'nguonThu', 'khung'];

const MIEN: Record<string, readonly string[]> = {
  tuLap: SO_DANG_KY.ctx_tu_lap.mien,
  nguonThu: SO_DANG_KY.ctx_nguon_thu.mien,
  khung: SO_DANG_KY.ctx_khung.mien,
};

/* ═══ 2. ĐỌC / GHI ═════════════════════════════════════════════════════════ */

/** Khoá bản ghi `meta`. ⚠ Phải được PHÂN LOẠI ở `ket_chay.ts` (D264). */
export const ID_HO_SO = 'ho_so';

export class LoiHoSo extends Error {}

/**
 * ⚠⚠ GHI THÌ NÉM, ĐỌC THÌ LỌC — hai cửa, hai thái độ, và sự lệch ấy là có chủ ý.
 *
 * Cửa GHI đứng sau một MENU cố định: một giá trị ngoài miền ở đó là **lỗi lập trình**,
 * và nuốt nó là giấu lỗi cho tới lúc nó nổ ở chỗ khác.
 * Cửa ĐỌC đứng trước dữ liệu ĐÃ NẰM TRÊN MÁY người dùng, có thể do một bản app cũ ghi:
 * một giá trị đã bị gỡ khỏi miền ở đó **không phải lỗi hôm nay**, nó là lịch sử. Nhưng
 * để nó đi tiếp thì `them()` ném trong `dongGoiKy`, và cú ném ấy làm hỏng **cả gói của
 * kỳ** — mất mọi đặc trưng của tháng vì một câu trả lời cũ. Nên đọc thì bỏ, im lặng
 * đúng chỗ nên im.
 */
export function kiemHoSo(h: HoSo): string | null {
  for (const k of CAU_RA) {
    const v = h[k];
    if (v === undefined) continue;
    if (typeof v !== 'string' || !MIEN[k]!.includes(v)) {
      return `${k}: "${String(v)}" không thuộc miền (${MIEN[k]!.join(' · ')})`;
    }
  }
  if (h.coNo !== undefined && typeof h.coNo !== 'boolean') return 'coNo phải là boolean';
  return null;
}

export async function ghiHoSo(kho: KhoPfm, h: HoSo, luc: string): Promise<void> {
  const loi = kiemHoSo(h);
  if (loi !== null) throw new LoiHoSo(`Hồ sơ không hợp lệ — ${loi}`);
  await kho.ghi('meta', { id: ID_HO_SO, thang: luc.slice(0, 7), suaLuc: luc, d: h });
}

/**
 * ⚠ CHƯA KHAI ⇒ `{}`, KHÔNG PHẢI `null`. Ba câu đều "để sau" được, nên "chưa trả lời
 * câu nào" và "chưa từng mở màn hồ sơ" là **cùng một trạng thái** với mọi thứ phía sau:
 * `mauHopVoiHoSo({})` vẫn trả về mẫu, `dongGoiKy` vẫn phát gói (thiếu ba dòng `ctx_*`).
 * Bắt người gọi phân biệt hai thứ không phân biệt được là đẻ ra một nhánh `null` chết.
 */
export async function docHoSo(kho: KhoPfm): Promise<HoSo> {
  const b = await kho.doc<HoSo>('meta', ID_HO_SO);
  if (b === null) return {};
  return locHoSo(b.d);
}

/** Kết quả hợp lệ của một kỳ đã chấm. `satisfies` khoá với kiểu gốc — thêm kết quả mới mà quên đây là lỗi biên dịch. */
const KQ_HOP_LE = ['trung', 'trat', 'chua_du'] as const satisfies readonly KetQuaDoan[];

/**
 * Lọc sổ lời đoán: chỉ giữ dòng ĐÚNG HÌNH. Chỉ kiểm hình chứ không kiểm `ma` theo danh mục — `chan_dung.ts`
 * import tệp này, import ngược là vòng; và `ma` cũ chỉ để ghi lịch sử, không ai tra bảng bằng nó.
 */
function locSoDoan(x: unknown): Record<string, KyDaCham> | undefined {
  if (x === null || typeof x !== 'object') return undefined;
  const ra: Record<string, KyDaCham> = {};
  for (const [khoa, d] of Object.entries(x as Record<string, unknown>)) {
    if (!/^(tuan:\d{4}-\d{2}-\d{2}|thang:\d{4}-\d{2})$/.test(khoa)) continue;
    if (d === null || typeof d !== 'object') continue;
    const k = d as Record<string, unknown>;
    const so = (n: unknown): n is number | null => n === null || (typeof n === 'number' && Number.isFinite(n));
    if (typeof k.ma !== 'string' || !KQ_HOP_LE.includes(k.kq as KetQuaDoan)) continue;
    if (!so(k.doDuoc) || !so(k.moc)) continue;
    ra[khoa] = { ma: k.ma as KyDaCham['ma'], kq: k.kq as KetQuaDoan, doDuoc: k.doDuoc, moc: k.moc };
  }
  return Object.keys(ra).length ? ra : undefined;
}

/**
 * Lọc lịch sử lựa chọn hướng: chỉ giữ dòng ĐÚNG HÌNH. `ma` chỉ kiểm là chuỗi — mã lạ (bản app sau gỡ một bước dựng) đọc
 * lên vẫn là lịch sử; `dichCuaLuaChon` trả `null` cho nó và phép chấm bỏ qua, không ném. Không import danh mục từ
 * `huong.ts` (tệp ấy kéo `phong_cach.ts` ⇒ vòng import về đây).
 */
function locHuong(x: unknown): LuaChonHuong[] | undefined {
  if (!Array.isArray(x)) return undefined;
  const ngay = /^\d{4}-\d{2}-\d{2}$/;
  const chuoi = (t: unknown, dai = 120): t is string => typeof t === 'string' && t.length > 0 && t.length <= dai;
  const ra: LuaChonHuong[] = [];
  for (const d of x) {
    if (d === null || typeof d !== 'object') continue;
    const k = d as Record<string, unknown>;
    if (!chuoi(k.tuan) || !ngay.test(k.tuan) || !chuoi(k.khoa) || !chuoi(k.ma, 40) || !chuoi(k.luc, 40)) continue;
    if (k.kieu !== 'theo' && k.kieu !== 'bo' && k.kieu !== 'thoi') continue;
    const lc: LuaChonHuong = {
      tuan: k.tuan, khoa: k.khoa, ma: k.ma as LuaChonHuong['ma'], kieu: k.kieu, luc: k.luc,
    };
    if (chuoi(k.huId)) lc.huId = k.huId;
    if (chuoi(k.dk, 40)) lc.dk = k.dk as LuaChonHuong['dk'];
    if (k.nhom === 'tich_luy' || k.nhom === 'tieu_dung') lc.nhom = k.nhom;
    if (k.td === 'ngay' || k.td === 'phan_tram') lc.td = k.td;
    if (chuoi(k.khung, 20)) lc.khung = k.khung as LuaChonHuong['khung'];
    ra.push(lc);
  }
  return ra.length ? ra : undefined;
}

/** Bỏ mọi giá trị ngoài miền hiện tại. Xem `kiemHoSo` về vì sao đọc thì lọc chứ không ném. */
export function locHoSo(tho: unknown): HoSo {
  if (tho === null || typeof tho !== 'object') return {};
  const v = tho as Record<string, unknown>;
  const ra: HoSo = {};
  for (const k of CAU_RA) {
    const x = v[k];
    if (typeof x === 'string' && MIEN[k]!.includes(x)) (ra as Record<string, unknown>)[k] = x;
  }
  if (typeof v.coNo === 'boolean') ra.coNo = v.coNo;
  /*
   * ⚠ BA CÂU CHỈ-Ở-LẠI-MÁY PHẢI ĐƯỢC CHÉP LẠI Ở ĐÂY. `locHoSo` dựng một object
   * MỚI và chỉ chép những khoá nó biết — quên một khoá là mỗi lần đọc lại xoá
   * sạch câu trả lời ấy, im lặng, và người dùng thấy màn phỏng vấn hỏi lại một
   * câu họ vừa trả lời. Không miền để kiểm (chưa có `SO_DANG_KY`), nên chỉ kiểm
   * KIỂU và lọc phần tử không phải chuỗi.
   */
  if (typeof v.deu === 'string') ra.deu = v.deu;
  const chuoiMang = (x: unknown): string[] | undefined => {
    if (!Array.isArray(x)) return undefined;
    const c = x.filter((t): t is string => typeof t === 'string');
    return c.length ? c : undefined;
  };
  const mt = chuoiMang(v.mucTieu);
  if (mt) ra.mucTieu = mt;
  const nh = chuoiMang(v.nhip);
  if (nh) ra.nhip = nh;
  // Ba khoá của D308 — cùng cái bẫy "quên chép là xoá im lặng" ở khối trên.
  const ntn = chuoiMang(v.nguonThuNhan);
  if (ntn) ra.nguonThuNhan = ntn;
  const cnn = chuoiMang(v.coNoNhan);
  if (cnn) ra.coNoNhan = cnn;
  const ltb = chuoiMang(v.loTrinhBo);
  if (ltb) ra.loTrinhBo = ltb;
  // Ba trường màn NGÀY ĐẦU (D355/D356) — cùng cái bẫy "quên chép là xoá im lặng" ở trên.
  const cdb = chuoiMang(v.chanDungBac);
  if (cdb) ra.chanDungBac = cdb;
  const cdc = chuoiMang(v.chanDungDaCham);
  if (cdc) ra.chanDungDaCham = cdc;
  if (typeof v.chanDungNhip === 'string') ra.chanDungNhip = v.chanDungNhip;
  /* Bốn câu thêm 21/09 — CÙNG cái bẫy "quên chép là xoá im lặng" mà khối trên đã cảnh báo
     ba lần. Với ba trục chân dung thì hậu quả nặng hơn: mất chúng là mất luôn hành tinh,
     và người dùng thấy chân dung của mình bốc hơi giữa hai lần mở app. */
  if (typeof v.noSo === 'string') ra.noSo = v.noSo;
  if (typeof v.lucTienVe === 'string') ra.lucTienVe = v.lucTienVe;
  if (typeof v.sauKhiTieu === 'string') ra.sauKhiTieu = v.sauKhiTieu;
  if (typeof v.dauThang === 'string') ra.dauThang = v.dauThang;
  /* Hai trường sổ lời đoán (D385) — cùng bẫy "quên chép là xoá im lặng": mất chúng là mất mốc lời
     đoán (tuần nào cũng thành "chưa chấm được") và mất thành tích app đã tự chấm. */
  if (typeof v.doanTu === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.doanTu)) ra.doanTu = v.doanTu;
  const sd = locSoDoan(v.soDoan);
  if (sd) ra.soDoan = sd;
  /* Lựa chọn hướng (D453) — cùng bẫy "quên chép là xoá im lặng": mất nó là mất lịch sử app học trên, và tuần nào tấm
     HƯỚNG cũng như mới gặp. */
  const hg = locHuong(v.huong);
  if (hg) ra.huong = hg;
  if (Array.isArray(v.ngayDauBo)) {
    const so = v.ngayDauBo.filter((x): x is number => typeof x === 'number' && Number.isInteger(x));
    if (so.length) ra.ngayDauBo = so;
  }
  return ra;
}

/* ═══ 2b. SỬA MỘT PHẦN — đọc–sửa–ghi, XẾP HÀNG (D360) ═════════════════════ */

/** Đuôi hàng đợi sửa của TỪNG kho. `WeakMap` ⇒ kho bị thu hồi thì hàng đợi đi theo, không ai phải dọn. */
const hangDoiSua = new WeakMap<KhoPfm, Promise<unknown>>();

/**
 * ⭐⭐ SỬA MỘT PHẦN HỒ SƠ: đọc bản ĐANG NẰM TRONG KHO → `f` → ghi. Người gọi KHÔNG BAO GIỜ đưa vào một hồ sơ
 * dựng sẵn — chỉ đưa vào PHÉP SỬA.
 *
 * ⚠⚠ VÌ SAO NHẬN HÀM, KHÔNG NHẬN HỒ SƠ. `ghiHoSo` GHI ĐÈ TRỌN bản ghi, nên ai gọi nó cũng phải tự có trong tay
 * MỘT BẢN ĐỦ của hồ sơ — và thứ các màn có trong tay là state React: `useHoSo()` trả `{}` trong lúc chưa nạp xong,
 * và trả bản CŨ giữa một cú ghi với lượt nạp lại sau nó. Màn LỘ TRÌNH lên prod từ 0.0.5 với đúng thế ấy
 * (`{ ...hoSo, loTrinhBo: […] }`): chạm BỎ trong cửa sổ chưa nạp xong là `{ loTrinhBo: […] }` đè lên sáu câu phỏng
 * vấn, im lặng. D358 bắt được nó ở màn NGÀY ĐẦU; D360 dọn màn LỘ TRÌNH và đặt phép sửa về MỘT chỗ (A11.5).
 *
 * ⚠⚠ VÀ VÌ SAO XẾP HÀNG — đọc lại từ kho một mình KHÔNG ĐỦ. Kho không có transaction đọc-rồi-ghi (`KhoPfm.doc` và
 * `.ghi` là hai lượt rời), nên hai phép sửa phát ra sát nhau sẽ CÙNG ĐỌC trước khi cái nào kịp ghi, và cái ghi sau
 * nuốt cái ghi trước — đúng cái lỗi đang sửa, chỉ hẹp cửa sổ hơn. Bài `lo_trinh_nut.test.tsx` §VI dựng được ca ấy
 * một cách tất định (hai cú chạm trong cùng một nhịp) và ĐỎ với bản chỉ-đọc-lại. Xếp hàng theo TỪNG KHO: lượt sau
 * chỉ bắt đầu ĐỌC khi lượt trước đã GHI xong.
 * ⚠ Hàng đợi sống trong MỘT tab. Hai tab cùng sửa vẫn đua được — đó là bài toán của két/K8, không phải của hàm này.
 *
 * ⚠ LƯỢT HỎNG KHÔNG ĐƯỢC KÉO SẬP HÀNG ĐỢI: lỗi trả về cho ĐÚNG người gọi của lượt ấy (họ phải biết cú ghi của
 * mình không thành), còn mắt xích nối sang lượt sau thì nuốt lỗi. Nuốt nhầm đầu là một cú ghi hỏng im lặng; không
 * nuốt đầu nào là một lần `LoiHoSo` khoá mọi phép sửa hồ sơ cho tới khi tải lại trang.
 *
 * @param f Nhận bản vừa đọc từ kho (object MỚI mỗi lượt — `locHoSo` dựng lại), trả bản sẽ ghi. Trả `null` ⇒
 *   KHÔNG có gì để sửa (vd. khối đã bỏ rồi): không ghi, `suaLuc` của bản ghi không nhích.
 * @returns Bản đã ghi, hoặc `null` nếu `f` nói không có gì để ghi.
 */
export function suaHoSo(
  kho: KhoPfm, f: (cu: HoSo) => HoSo | null, luc: string,
): Promise<HoSo | null> {
  const truoc = hangDoiSua.get(kho) ?? Promise.resolve();
  const luot = truoc.then(async () => {
    const cu = await docHoSo(kho);
    const moi = f(cu);
    /*
     * ⚠⚠ D385 — CHIP NHỊP ĐỔI ⇒ LỜI ĐOÁN ĐỔI ⇒ GỠ MỐC CŨ. Mốc `doanTu` nói "lời đoán HIỆN TẠI được đưa ra
     * từ ngày nào"; giữ mốc cũ sau khi chip đổi là cho lời đoán MỚI hưởng ngày của lời đoán CŨ — tức được
     * chấm trên những ngày đã trôi qua trước khi nó tồn tại. Đặt ở CỬA GHI chứ không ở từng màn, vì chip
     * nhịp đổi được ở ít nhất hai màn (phỏng vấn · "KHÔNG HẲN" ở ngày đầu) và mọi đường ghi đều qua đây.
     * Mốc mới được đặt lại khi lời đoán mới hiện trên màn chân dung.
     */
    if (moi !== null && moi.doanTu !== undefined && chipHieuLuc(cu) !== chipHieuLuc(moi)) {
      delete moi.doanTu;
    }
    if (moi !== null) await ghiHoSo(kho, moi, luc);
    return moi;
  });
  hangDoiSua.set(kho, luot.catch(() => undefined));
  return luot;
}

/* ═══ 3. RA ĐẶC TRƯNG ══════════════════════════════════════════════════════ */

/** Một dòng `ctx_*` cho mỗi câu ĐÃ trả lời. Câu chưa trả lời ⇒ KHÔNG có dòng. */
export interface DongCtx { ma: 'ctx_tu_lap' | 'ctx_nguon_thu' | 'ctx_khung'; giaTri: string }

/**
 * ⚠⚠ CÂU CHƯA TRẢ LỜI PHẢI **VẮNG MẶT**, KHÔNG ĐƯỢC HOÁ THÀNH MỘT NHÃN "khác".
 *
 * `ctx_nguon_thu` có sẵn giá trị `'khac'` trong miền, nên phản xạ là điền nó cho người
 * chưa khai. Đó là một cú nói dối có cấu trúc: `'khac'` nghĩa là *"tôi có nguồn thu, và
 * nó không thuộc ba loại kia"* — một phát biểu về hoàn cảnh; còn chưa khai nghĩa là
 * **không biết gì cả**. Gộp hai thứ ấy làm nhóm `'khac'` phình lên bằng mọi người lười
 * bấm, và mọi kết luận về nhóm đó thành rác. Đúng luật P7/D62 (`them()` đã bỏ
 * `undefined` vì cùng lý do: thiếu mẫu là `null`, không phải 0).
 */
export function ctxCuaHoSo(h: HoSo): DongCtx[] {
  const ra: DongCtx[] = [];
  if (h.tuLap !== undefined) ra.push({ ma: 'ctx_tu_lap', giaTri: h.tuLap });
  if (h.nguonThu !== undefined) ra.push({ ma: 'ctx_nguon_thu', giaTri: h.nguonThu });
  if (h.khung !== undefined) ra.push({ ma: 'ctx_khung', giaTri: h.khung });
  return ra;
}

/* ═══ 4. TIẾN ĐỘ — cho màn cửa vào biết còn hỏi gì ════════════════════════ */

export interface TienDoHoSo { daTraLoi: number; tong: number; xong: boolean }

/**
 * ⚠ `tong` đếm ba câu ĐI RA NGOÀI, không đếm `coNo`. `coNo` là câu phụ của màn tạo hũ,
 * không phải một phần của "hồ sơ đã đầy chưa" — trộn vào thì thanh tiến độ nói dối và
 * người dùng bị hỏi thêm một câu để làm đầy một thứ không đo gì.
 */
export function tienDoHoSo(h: HoSo): TienDoHoSo {
  const daTraLoi = CAU_RA.filter((k) => h[k] !== undefined).length;
  return { daTraLoi, tong: CAU_RA.length, xong: daTraLoi === CAU_RA.length };
}

/**
 * Số câu ĐÃ TRẢ LỜI trong SÁU câu phỏng vấn (0..6) — đếm từ chính hồ sơ, không giữ bộ đếm riêng: hồ sơ là thứ sống
 * sót qua mọi lần đóng app, còn bộ đếm của một màn thì không. Một câu "để sau" KHÔNG tính — nó cố ý trống.
 *
 * ⚠ KHÁC `tienDoHoSo` ở trên: hàm kia đếm BA câu ĐI RA NGOÀI để cửa vào biết còn hỏi gì; hàm này đếm cả SÁU để
 * nói với người dùng "tôi đang đứng trên bao nhiêu câu của bạn" (dòng "Ghép từ n/6 câu" của LỘ TRÌNH + phần CÂU
 * của thanh "mức độ hiểu bạn"). MỘT nguồn cho cả hai màn (A11.5 — D358 gỡ bản chép thứ hai).
 *
 * ⚠⚠ CÂU 1 ĐẾM THEO NHÃN THÔ, KHÔNG CHỈ THEO MÃ (D358). Chọn chip thuộc HAI mã ("gia đình cho" + "làm thêm" — đúng
 * nhóm sinh viên đông nhất của D353) thì `nguonThuTuNhan` CỐ Ý để `nguonThu` trống (A8.2: không chọn bừa cohort),
 * nhưng câu ấy ĐÃ được trả lời — `nguonThuNhan` giữ đủ chip. Luật cũ chỉ nhìn mã ⇒ người trả lời đủ sáu câu bị đọc
 * ra 5/6: dòng "Ghép từ 5/6 câu" của LỘ TRÌNH nói sai, và thanh hiểu mở màn 18 % thay vì 22 %. Hồ sơ cũ chỉ có mã
 * (chưa có nhãn thô) vẫn đếm nhờ vế đầu.
 */
export function soCauDaTraLoi(h: HoSo): number {
  const co: boolean[] = [
    h.nguonThu !== undefined || (h.nguonThuNhan ?? []).length > 0,
    h.deu !== undefined,
    h.coNo !== undefined,
    (h.mucTieu ?? []).length > 0,
    (h.nhip ?? []).length > 0,
    /* Ba câu ĐO thêm 21/09 — chúng LÀ câu phỏng vấn, nên phải vào cả tử lẫn mẫu. */
    h.lucTienVe !== undefined,
    h.sauKhiTieu !== undefined,
    h.dauThang !== undefined,
  ];
  /* ⚠ `khung` KHÔNG còn đếm: từ 21/09 phỏng vấn không hỏi nó nữa (`lo_trinh.ts` hỏi, lúc người
     ta đã có sổ). Đếm nó ở đây thì chọn một khung trên lộ trình lại cộng điểm cho "câu bạn đã
     trả lời" — cộng cho một câu chưa từng được hỏi. */
  if (coCauNoChiTiet(h)) co.push(h.noSo !== undefined);
  return co.filter(Boolean).length;
}

/** Câu nợ chi tiết chỉ tồn tại với người CÓ nợ — cùng điều kiện với `hienKhi` của `no_so`. */
function coCauNoChiTiet(h: HoSo): boolean {
  return h.coNo === true;
}

/**
 * MẪU SỐ của "n/N câu" — SỐ CÂU NGƯỜI NÀY THẬT SỰ ĐƯỢC HỎI, không phải một hằng số.
 *
 * ⚠⚠ VÌ SAO KHÔNG PHẢI HẰNG: câu `no_so` là câu ĐIỀU KIỆN (chỉ hỏi người có nợ). Lấy tổng số
 * câu làm mẫu thì người không nợ trả lời hết vẫn ra 8/9 — thanh "mức độ hiểu bạn" KHÔNG BAO GIỜ
 * đầy, và dòng "Ghép từ n/N câu" nói dối theo hướng chê người dùng. Mẫu phải co theo người.
 *
 * ⚠ MỘT NGUỒN cho `chan_dung.ts` (trần của `kep`) và `lo_trinh.ts` (mẫu của nhãn). Trước 21/09
 * cả hai chôn số **6** viết tay ở hai chỗ khác nhau — đổi bộ câu là hai chỗ ấy im lặng nói sai.
 */
export function soCauPhongVan(h: HoSo): number {
  return 8 + (coCauNoChiTiet(h) ? 1 : 0);
}

/** Bản ghi hồ sơ như nó nằm trong kho — cho test và cho đường khôi phục soi. */
export type BanHoSo = BanGhi<HoSo>;
