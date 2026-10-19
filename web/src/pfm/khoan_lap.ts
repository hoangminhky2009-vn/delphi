/**
 * PFM — ORACLE GIÚP 2/5: **thấy một khoản lặp thì ĐỀ NGHỊ lưu thành mẫu một chạm** (D365).
 * Làm theo DEMO ĐÃ CHỐT (A11.25): `docs/ui-ux/demo/pfm-ngay-dau.html`, màn `n3`
 * (*"Ba sáng liền bạn ghi 25.000… Lưu thành mẫu một chạm không?"*).
 *
 * §1–2 THUẦN: không đọc đồng hồ (`homNay` do người gọi đưa vào), không chuỗi hiển thị
 * (D26 — chữ ở `lib/pfm_chu.ts`), không đọc kho. §3 là đường KHO, tách hẳn ở cuối tệp.
 *
 * ⚠⚠ HAI KHOÁ, HAI THANH CHẮN — vì tiền Việt tròn 5k (số đo D363):
 *   · khoản CÓ ghi chú  → khoá `số tiền + ghi chú`, ngưỡng `ORACLE_LAP_CO_CHU_*` (3 lần/14 ngày)
 *   · khoản KHÔNG ghi chú → khoá `số tiền`,          ngưỡng `ORACLE_LAP_KHONG_CHU_*` (4 lần/7 ngày)
 * Một khoản thuộc ĐÚNG MỘT khoá (phân hoạch), nên hai luật không cộng dồn lên nhau: người
 * ghi "cà phê 25k" ba lần KHÔNG đồng thời đẩy khoá-25k-không-ghi-chú lên ba.
 *
 * ⚠ ĐỀ NGHỊ LÀ MỘT CÂU HỎI, KHÔNG PHẢI LỜI KHẲNG ĐỊNH về người dùng — nên nó KHÔNG đi qua
 * cổng độ chắc của D354 (thứ dành cho thẻ nói "một mẫu hình xuất hiện trong sổ của bạn").
 * Sai thì tốn một chạm "không"; và A10: câu chữ chỉ được TẢ + HỎI, không kê đơn.
 *
 * ⚠ P3 🔒 — hàm này KHÔNG tạo khoản, KHÔNG tự lưu mẫu. Nó trả về một ĐỀ NGHỊ; `MauLap` chỉ
 * ra đời khi người dùng bấm (xem chú thích "mẫu lặp KHÔNG tự sinh khoản" ở `so.ts`).
 */
import { useQuery } from '@tanstack/react-query';
import { PFM } from '@config/pfm';
import { KHOA_PFM, useKhoNgu } from './dung_kho.js';
import { trungVi } from './guong.js';
import type { KhoPfm } from './kho.js';
import { laChiTieu, type Khoan, type MauLap } from './so.js';

/** Một khoá gộp khoản: `<số tiền>` hoặc `<số tiền>|<ghi chú đã chuẩn hoá>`. */
export type KhoaLap = string;

/** Nhịp của mẫu: lặp DÀY trong một cửa sổ ngắn, hay CỐ ĐỊNH mỗi tháng. */
export type NhipLap = 'day' | 'thang';

export interface DeNghiMauLap {
  khoa: KhoaLap;
  nhip: NhipLap;
  soTien: number;
  /** `null` = khoá chỉ theo số tiền (khoản không ghi chú). */
  ghiChu: string | null;
  /** Số lần đếm được — để câu chữ nói đúng con số, không phải để xếp hạng. */
  lan: number;
  /** Bề rộng cửa sổ đã dùng (ngày); `null` với nhịp THÁNG (cửa sổ là cả sổ). */
  cuaSo: number | null;
}

/**
 * Chuẩn hoá ghi chú trước khi làm khoá: bỏ khoảng trắng thừa, thường hoá.
 * ⚠ GIỮ NGUYÊN DẤU tiếng Việt — "ăn trưa" và "an trua" là hai thứ người dùng gõ khác nhau,
 * gộp chúng là đoán hộ. Chuỗi rỗng sau khi trim ⇒ coi như KHÔNG có ghi chú.
 */
export function chuanHoaGhiChu(s: string | undefined): string | null {
  const t = (s ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
  return t === '' ? null : t;
}

/** Khoá của một khoản — `null` nếu khoản không phải CHI (thu không lưu mẫu ở lượt này). */
export function khoaCuaKhoan(k: Khoan): KhoaLap | null {
  if (!laChiTieu(k)) return null;   // D420 — quy tắc tự chia lặp mỗi ngày nhưng không phải khoản lặp để lưu mẫu
  const chu = chuanHoaGhiChu(k.ghiChu);
  return chu === null ? String(k.soTien) : `${k.soTien}|${chu}`;
}

/** Số ngày lịch giữa hai mốc `YYYY-MM-DD` (b − a), âm nếu b trước a. */
function cachNgay(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Chuỗi DÀI NHẤT các lần cách nhau đúng một nhịp tháng (28–31 ngày ± dung sai).
 * ⚠ Đếm theo NGÀY LỊCH chứ không theo "cùng ngày trong tháng": tháng 2 có 28 ngày, và người ta trả
 *   trọ sớm/muộn một hai hôm. Dung sai ở `config/pfm.ts`.
 */
export function chuoiThangDaiNhat(ngay: readonly string[]): number {
  const moc = [...new Set(ngay)].sort();
  const d = PFM.ORACLE_CO_DINH_LECH_NGAY;
  let tot = moc.length === 0 ? 0 : 1;
  for (let i = 0; i < moc.length; i++) {
    let dai = 1;
    let cuoi = moc[i]!;
    for (let j = i + 1; j < moc.length; j++) {
      const b = cachNgay(cuoi, moc[j]!);
      if (b >= 28 - d && b <= 31 + d) { dai += 1; cuoi = moc[j]!; }
    }
    tot = Math.max(tot, dai);
  }
  return tot;
}

export interface DauVaoDeNghiLap {
  so: readonly Khoan[];
  homNay: string;
  /** Khoá đã có mẫu rồi — không hỏi lại thứ người dùng đã lưu. */
  daCoMau: ReadonlySet<KhoaLap>;
  /** Khoá đã từng hỏi (dù người dùng trả lời gì) — hỏi một lần, nhớ câu trả lời. */
  daHoi: ReadonlySet<KhoaLap>;
}

/**
 * MỘT đề nghị, hoặc `null` — im lặng là kết quả hợp lệ (cùng tinh thần `chonNoiDung`).
 *
 * ⚠ Mỗi ngày nhiều nhất MỘT đề nghị: người gọi chỉ hỏi hàm này một lần cho mỗi lượt mở màn,
 * và khoá đã hỏi thì vào `daHoi`. Nhiều khoá cùng đủ điều kiện ⇒ lấy khoá **nhiều lần nhất**,
 * hoà thì lấy khoá có lần gần nhất SỚM hơn (mẫu đã sống lâu hơn trong sổ), rồi tới khoá nhỏ
 * hơn theo thứ tự chuỗi — tất định, không phụ thuộc thứ tự mảng đầu vào.
 */
export function deNghiMauLap(v: DauVaoDeNghiLap): DeNghiMauLap | null {
  const theoKhoa = new Map<KhoaLap, Khoan[]>();
  for (const k of v.so) {
    const khoa = khoaCuaKhoan(k);
    if (khoa === null || v.daCoMau.has(khoa) || v.daHoi.has(khoa)) continue;
    if (cachNgay(k.ngay, v.homNay) < 0) continue;            // khoản ở tương lai: không tính
    const ds = theoKhoa.get(khoa) ?? [];
    ds.push(k);
    theoKhoa.set(khoa, ds);
  }

  const ungVien: DeNghiMauLap[] = [];
  for (const [khoa, ds] of theoKhoa) {
    const coChu = khoa.includes('|');
    const cuaSo = coChu ? PFM.ORACLE_LAP_CO_CHU_NGAY : PFM.ORACLE_LAP_KHONG_CHU_NGAY;
    const can = coChu ? PFM.ORACLE_LAP_CO_CHU_LAN : PFM.ORACLE_LAP_KHONG_CHU_LAN;
    // Cửa sổ ĐẾM NGÀY LỊCH lùi từ hôm nay — không đếm "ba lần gần nhất" bất kể xa bao lâu.
    const trong = ds.filter((k) => cachNgay(k.ngay, v.homNay) < cuaSo);
    if (trong.length < can) continue;
    const dau = ds[0]!;
    ungVien.push({
      khoa, nhip: 'day', soTien: dau.soTien, ghiChu: coChu ? chuanHoaGhiChu(dau.ghiChu) : null,
      lan: trong.length, cuaSo,
    });
  }
  /*
   * ── NHÁNH THỨ HAI: KHOẢN CỐ ĐỊNH THEO THÁNG (founder 21/09) ──────────────────────────────
   * Luật cửa-sổ-lăn ở trên KHÔNG BAO GIỜ bắt được tiền trọ mùng 5: hai lần cách nhau một tháng
   * thì chẳng bao giờ cùng nằm trong 14 ngày. Ở đây đếm theo CHUỖI THÁNG: mỗi bước cách nhau
   * 28–31 ngày (cộng dung sai `ORACLE_CO_DINH_LECH_NGAY`).
   * ⚠⚠ CHỈ XÉT KHOẢN ĐỦ LỚN (`≥ ORACLE_CO_DINH_HE_SO_KHOAN × trung vị KHOẢN`) — đo được: bỏ
   *   điều kiện này thì luật bắn 18–23 khoá trùng hợp mỗi 4 tháng (D365/§B1-bis).
   */
  const tienChi = v.so.filter(laChiTieu).map((k) => k.soTien);
  const nenKhoan = trungVi(tienChi) ?? 0;
  const sanCoDinh = PFM.ORACLE_CO_DINH_HE_SO_KHOAN * nenKhoan;
  if (sanCoDinh > 0) {
    for (const [khoa, ds] of theoKhoa) {
      const dau = ds[0]!;
      if (dau.soTien < sanCoDinh) continue;
      const lan = chuoiThangDaiNhat(ds.map((k) => k.ngay));
      if (lan < PFM.ORACLE_CO_DINH_SO_THANG) continue;
      ungVien.push({
        khoa, nhip: 'thang', soTien: dau.soTien,
        ghiChu: khoa.includes('|') ? chuanHoaGhiChu(dau.ghiChu) : null,
        lan, cuaSo: null,
      });
    }
  }

  if (ungVien.length === 0) return null;

  const ganNhat = (d: DeNghiMauLap): string => {
    const ds = theoKhoa.get(d.khoa)!;
    return ds.reduce((a, k) => (k.ngay > a ? k.ngay : a), ds[0]!.ngay);
  };
  /*
   * ⚠ NHỊP THÁNG ĐỨNG TRƯỚC: một khoản cố định (trọ, học phí) đáng lưu thành mẫu hơn một thói quen
   *   lặt vặt, và nó chỉ đến mỗi tháng một lần nên bỏ lỡ là chờ cả tháng. Trong cùng nhịp mới so số lần.
   */
  const hang = (d: DeNghiMauLap): number => (d.nhip === 'thang' ? 0 : 1);
  ungVien.sort((a, b) => (hang(a) - hang(b))
    || (b.lan - a.lan)
    || ganNhat(a).localeCompare(ganNhat(b))
    || a.khoa.localeCompare(b.khoa));
  return ungVien[0]!;
}

/* ══ 3. ĐƯỜNG KHO — "đã hỏi khoá nào" và "lưu mẫu" ═══════════════════════════ */

/**
 * ⚠ Cất ở ngăn `nhip`, cùng khuôn `docDaHienKy`/`ghiDaHienKy` của `oracle.ts` — ngăn ấy đã có
 * sẵn và đang giữ đúng loại dữ liệu này ("Oracle đã nói gì rồi"). KHÔNG cất vào ngăn `mau_lap`:
 * ở đó nó thành một bản ghi giả, và `liet('mau_lap')` — thứ bàn tiền đọc để bày mẫu — sẽ trả
 * về nó như một mẫu có thật.
 * ⚠ P2 🔒 — chỉ ở lại máy, không có đường nào đẩy nó ra ngoài.
 */
const ID_DA_HOI = 'mau_lap_da_hoi';

interface BanDaHoi { khoa: string[] }

/** Tập khoá ĐÃ TỪNG hỏi (dù người dùng trả lời gì). Không mở ghi. */
export async function docKhoaDaHoi(kho: KhoPfm): Promise<ReadonlySet<KhoaLap>> {
  const b = await kho.doc<BanDaHoi>('nhip', ID_DA_HOI);
  return new Set(b?.d.khoa ?? []);
}

/** Ghi nhận MỘT khoá vừa hỏi — idempotent (gọi hai lần không nhân đôi). */
export async function ghiKhoaDaHoi(kho: KhoPfm, khoa: KhoaLap, luc: string): Promise<void> {
  const co = await docKhoaDaHoi(kho);
  if (co.has(khoa)) return;
  await kho.ghi<BanDaHoi>('nhip', {
    // `thang` của một bản ghi KHÔNG thuộc tháng nào: lấy tháng của lượt ghi, đúng nếp `ghiHoSo`.
    id: ID_DA_HOI, thang: luc.slice(0, 7), suaLuc: luc, d: { khoa: [...co, khoa] },
  });
}

/**
 * Gỡ MỘT khoá khỏi danh sách đã hỏi — đường `ĐỔI` của thẻ đề nghị (không ngõ cụt).
 * ⚠ Gỡ chứ không đánh dấu "đã gỡ": danh sách này chỉ có nghĩa "đừng hỏi lại", nên một khoá
 *   vắng mặt là trạng thái ĐÚNG sau khi người dùng đổi ý — họ sẽ được hỏi lại, và đó là điều họ vừa xin.
 */
export async function goKhoaDaHoi(kho: KhoPfm, khoa: KhoaLap, luc: string): Promise<void> {
  const co = await docKhoaDaHoi(kho);
  if (!co.has(khoa)) return;
  await kho.ghi<BanDaHoi>('nhip', {
    id: ID_DA_HOI, thang: luc.slice(0, 7), suaLuc: luc,
    d: { khoa: [...co].filter((k) => k !== khoa) },
  });
}

/**
 * Hook đọc danh sách đã hỏi. ⚠ Khoá truy vấn bắt đầu bằng `['pfm','nhip']` để lượt ghi qua
 * `useGhiKho(['nhip'], …)` vô hiệu hoá được nó — `invalidateQueries` khớp theo TIỀN TỐ.
 */
export function useKhoaDaHoiLap(): { data: ReadonlySet<KhoaLap>; dangTai: boolean } {
  const { kho } = useKhoNgu();
  const r = useQuery({
    queryKey: [...KHOA_PFM.ngan('nhip'), ID_DA_HOI],
    enabled: kho !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => docKhoaDaHoi(kho!),
  });
  return { data: r.data ?? TRONG, dangTai: r.isPending && kho !== null };
}

const TRONG: ReadonlySet<KhoaLap> = new Set();

/**
 * Khoá của một mẫu đã lưu — để `deNghiMauLap` thôi hỏi lại thứ người dùng đã có.
 * ⚠ Mẫu KHÔNG có `ghiChu` riêng; `ten` của mẫu chính là thứ đi vào `ghiChu` của khoản
 * (`tuMauLap`), nên khoá dựng từ `ten` — đúng cái khoá mà khoản sinh ra từ mẫu ấy sẽ mang.
 */
export function khoaCuaMau(m: Pick<MauLap, 'soTien' | 'ten'>): KhoaLap | null {
  if (m.soTien === null) return null;
  const chu = chuanHoaGhiChu(m.ten);
  return chu === null ? String(m.soTien) : `${m.soTien}|${chu}`;
}
