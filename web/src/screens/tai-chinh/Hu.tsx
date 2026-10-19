/**
 * PFM — MÀN HŨ = DANH MỤC VỊ THẾ (tệp 15 lát 1, bản 2 — founder 25/09: *"PFM theo vị thế"*, chữ Alpha Draft).
 * Nền vẫn là DEMO ĐÃ CHỐT `#manHu` của `docs/ui-ux/demo/pfm-ban-tien.html` (A11.25). Bản 2 đổi ba chỗ:
 *   · khối "Đang gom" ⇒ DANH MỤC của tháng (thanh chia dòng tiền + một câu Oracle), "Đang gom" vẫn nằm trong đó;
 *   · thẻ hũ ⇒ LÁ VỊ THẾ (cỡ · quy ra tháng/ngày · còn mấy ngày · nhanh/chậm mấy kỳ · độ chắc);
 *   · form tạo hũ ⇒ bảng VÀO LỆNH (mức + kỳ hạn ⇒ cỡ hiện ngay khi gõ ⇒ độ chắc).
 *
 * ⚠ Bố cục: tiêu đề → DANH MỤC → lá vị thế (đang chạy trước, đã hoàn thành sau) → nút neo đáy. Mở bảng VÀO LỆNH hoặc
 *   hộp quyết toán thì cả khối bị THAY THẾ (demo xoá sạch `#dsHu` rồi vẽ lại) — không chồng lớp, không ẩn bằng CSS.
 * ⚠ A10 🔒: màn chỉ ĐẾM và TẢ; quyết toán hỏi NẤC (bucket), không tự tính phần trăm hoàn thành cho người dùng.
 * ⚠ P3 🔒: app không tự điền mức tiền, kỳ hạn hay độ chắc — bốn nút nhanh 1/3/5/12 tr là phím tắt của user, không phải
 *   gợi ý cho một hũ cụ thể; chip nào cũng tắt lúc mở bảng.
 *
 * ⭐⭐ D410 (founder 26/09): "VÀO LỆNH" ⇒ **"TẠO HŨ"** · bảng tạo có LÁ ĐANG DỰNG (chính lá vị thế, cập nhật theo từng ô
 *   vừa điền) + ô chọn BIỂU TƯỢNG (bộ `ICON_HU` có sẵn mà chưa màn nào vẽ) · và khay PHÂN BỔ TỐI ở đầu màn
 *   (`PhanBo.tsx`): SỔ ban ngày chỉ ghi THU/CHI, tối về chọn hũ rồi chạm tờ để nạp — cú "hấp thụ".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PFM } from '@config/pfm';
import { NutChinh } from '@/components/ui/OBento';
import { TamTruot } from '@/components/ui/TamTruot';
import { TamDau } from '@/screens/hub/TamDau';
import { BanPhim, HOAN_TAC_MS } from '@/components/pfm/BanTien';
import { phatTichHu } from '@/components/pfm/tich_hu';
import { tienGon } from '@/lib/hub_tai_chinh';
import { NHIP } from '@/lib/nhip';
import b from '@/components/pfm/PfmBento.module.css';
import hb from './HuBento.module.css';
import { MatHu, type HuMat } from './HuBento';
import { ThanhTienDo } from '@/components/pfm/ThanhTienDo';
import { BongOracle } from '@/components/pfm/BongOracle';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { KhoProvider, useGhiKho, useHoSo, useHu, useHuCon, useSoTatCa } from '@/pfm/dung_kho';
import { conCua, taoHuCon, tongHopCha, LoiHuCon, type HuCon } from '@/pfm/hu_con';
import { napVaoConKho, ghiHuConKho } from '@/pfm/sua_ban_ghi';
import { taoKhoanPhanBo } from '@/pfm/phan_bo';
import { daTieuTrongThang, tongGopVaoHu } from '@/pfm/so';
import {
  LOAI_HU, laHuCoSao, laTichLuy, laTieuDung, tienDo, tuMau, tuTao, doiTrangThai, quyetToan, moLoiDoan, sua,
  type Hu, type KieuTuDong, type MaKetQuaHu, type MaLoaiHu, type NhomHu, type TrangThaiHu,
} from '@/pfm/hu';
import { datTuDong, type DatTuDong } from '@/pfm/tu_dong';
import {
  CHAC, coTuDieuKhoan, danhMuc, hanHopLe, hanTuSoThang, lenhCua, loiDoanHuDangMo,
  trangThaiLoiDoanHu, type CoViThe, type DanhMuc, type DongTien, type LoiDoanHu, type MaChac, type MaLyDoViThe,
  type TrangThaiLoiDoan,
} from '@/pfm/vi_the';
import { ICON_HU, mauHopVoiHoSo, type IconHu, type MauHu } from '@/pfm/hu_mau';
import { bayGio, congNgay, homNay, ngayViet, sinhId, thangNay } from '@/pfm/thoi_gian';
import { suaBanGhi } from '@/pfm/sua_ban_ghi';
import { batDom } from '@/lib/dom_bao';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import {
  CHU_BENTO as CB, CHU_KET_QUA_HU, CHU_KIEU_VI_THE, CHU_LOAI_CHI, CHU_MAN_HU, CHU_MAN_SO, CHU_NUT_HU, CHU_PHAN_BO as CP, CHU_PILL_HU,
  CHU_VI_THE as CV, O_CHU_LOAI_CHI,
} from '@/lib/pfm_chu';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { KeHuPhanBo, KhayPhanBo, nhanTo, nhanTuDong, usePhanBo } from './PhanBo';
import { BieuDoViThe } from './BieuDoViThe';
import { duongGopHu, type DiemGop } from '@/pfm/bieu_do';
import { dinhDangDong, QuyetToanHop, type DichQuyetToan } from './QuyetToanHop';
import s from './Hu.module.css';


const phanTram = (x: number): string => `${Math.round(x * 100)}%`;

const MUC_NHANH = [1_000_000, 3_000_000, 5_000_000, 12_000_000] as const;
/* D420 — lối tắt cho quy tắc tự chia, cùng nếp `MUC_NHANH`: ô gõ mở đầu TRỐNG, mấy nút này chỉ là đường tắt (P3). */
const TU_DONG_NGAY_NHANH = [10_000, 20_000, 50_000, 100_000] as const;
const TU_DONG_PT_NHANH = [5, 10, 20] as const;

/**
 * Màu khúc thứ `i` trên thanh danh mục — tên công năng `--dm-1…5` khai ở `.danhMuc` (`Hu.module.css`), nấc lấy từ
 * hai họ của bảng PFM. Xoay vòng theo thứ tự cỡ; ở đây chỉ chọn TÊN, không một mã màu nào (quy tắc 1–2 `pfm_token.css`).
 */
const SO_MAU_DM = 5;
const mauKhuc = (i: number): string => `var(--dm-${(i % SO_MAU_DM) + 1})`;

/** Kiểu vị thế suy từ loại hũ (D369 §5.2) — chỉ để gọi tên. */
function kieuCua(loai: MaLoaiHu | null): keyof typeof CHU_KIEU_VI_THE {
  if (loai === 'du_phong') return 'giu';
  if (loai === 'tra_no') return 'tra_no';
  if (loai === 'du_lich' || loai === 'su_kien') return 'chi_ke_hoach';
  return 'tich';
}


export default function Hu(): React.ReactElement {
  return (
    <KhoProvider>
      <RuotHu />
    </KhoProvider>
  );
}

/** ⚠ Xuất ra cho bài test — bản mặc định tự mở IndexedDB thật; test bơm kho của mình. */
export function RuotHu(): React.ReactElement {
  const { data: hu, sanSang: huSanSang } = useHu();
  const { data: tatCa, sanSang: soSanSang } = useSoTatCa();
  const { data: hoSo } = useHoSo();
  const ghiKho = useGhiKho();
  /* ⚠ Đọc đồng hồ MỘT LẦN (nếp `Guong.tsx`): kỳ hạn, cỡ và trạng thái lệnh phải nói về cùng một ngày. */
  const [ngay] = useState(() => homNay());
  const thang = ngay.slice(0, 7);

  /* ── BẢNG VÀO LỆNH: `dangTao` = vị thế mới · `lenhHuId` = vào lệnh cho một hũ đang có ── */
  const [, datDangTao] = useState(false);
  const [lenhHuId, datLenhHuId] = useState<string | null>(null);
  const [ten, datTen] = useState('');
  const [loiTen, datLoiTen] = useState(false);
  /*
   * ⚠⚠ MẶC ĐỊNH `null`, KHÔNG PHẢI `'khac'` — và đây là chỗ LỆCH DEMO CÓ CHỦ Ý.
   *
   * Demo để sẵn `nhanChon='KHÁC'` và tô ô ấy ngay từ đầu. Nhưng `hu.ts` viết thành luật ở
   * `nhanNguNghia()`: *"NHÃN CHƯA ĐẶT THÌ KHÔNG PHÁT GÌ CẢ — tuyệt đối không thay bằng
   * 'khac'… 'Chưa phân loại' và 'phân loại là khác' là hai chuyện khác nhau; gộp chúng
   * làm bẩn đúng cái cohort mà nhãn sinh ra để phục vụ (D62/P7)."*
   * Mà form này là CỬA DUY NHẤT tạo hũ tự đặt — để `'khac'` ở đây là xoá sạch phân biệt
   * ấy cho **mọi** hũ của **mọi** người bỏ qua bước nhãn, im lặng, ở tầng dữ liệu.
   * ⇒ Luật thắng demo (A11.25 cho phép đúng ca này: demo sai thì sửa demo). Đã sửa demo.
   */
  const [loaiChon, datLoaiChon] = useState<MaLoaiHu | null>(null);
  const [mucChon, datMucChon] = useState<number | null>(null);
  const [uuTien, datUuTien] = useState(false);
  /* D410 — biểu tượng của hũ: CHƯA chọn thì hũ nhận biểu tượng mặc định của `tuTao` (không phải một câu trả lời). */
  const [icon, datIcon] = useState<IconHu | null>(null);
  const [kyHan, datKyHan] = useState<string | null>(null);
  const [chac, datChac] = useState<MaChac | 'bo_qua' | null>(null);
  const [viSao, datViSao] = useState('');
  const [loiChac, datLoiChac] = useState(false);
  /* D420 — quy tắc tự chia trong bảng: `'tat'` = không quy tắc. Số để TRỐNG tới khi người dùng gõ/chạm (P3). */
  const [tdKieu, datTdKieu] = useState<'tat' | KieuTuDong>('tat');
  const [tdGt, datTdGt] = useState<number | null>(null);
  const [loiTd, datLoiTd] = useState(false);
  /*
   * D421 — loại hũ: KHÔNG ô nào sáng sẵn (P3), và KHÔNG bắt buộc — luật 31/08 "tên là thứ DUY NHẤT bắt buộc" đứng trên.
   * Không chọn ⇒ không gửi `nhom` ⇒ hũ tích lũy: đúng nghĩa của `nhom` vắng (`hu.ts`), đúng hũ app vẫn tạo trước D421.
   */
  const [nhomChon, datNhomChon] = useState<NhomHu | null>(null);
  const nutDay = useRef<HTMLButtonElement>(null);

  const [moHuId, datMoHuId] = useState<string | null>(null);
  const [quyetToanFor, datQuyetToanFor] =
    useState<{ id: string; dich: DichQuyetToan } | null>(null);

  /* ⚠ Nhận cả HŨ, không chỉ id: `tongGopVaoHu` cần `mocGop` (RESET, phương án A), và một
     chữ ký chỉ nhận id là mời đúng cú quên mốc ở một trong ba chỗ gọi dưới đây. */
  const daGopCua = (h: Hu): number => tongGopVaoHu(tatCa, h.id, h.mocGop);

  /*
   * ⚠ Hai nhóm: ĐANG CHẠY (kể cả tạm dừng) trước, ĐÃ HOÀN THÀNH (xong/bỏ) sau. Nhóm chính xếp theo DANH MỤC
   * (vị thế có cỡ trước, lớn trước — `danhMuc`), nhóm xong giữ thứ tự `sapXep()`.
   */
  const roi = (h: Hu): boolean => h.trangThai === 'xong' || h.trangThai === 'bo_do';
  const nhomXong = useMemo(() => hu.filter((h) => laTichLuy(h) && roi(h)), [hu]);
  /* D421 — hũ TIÊU DÙNG có nhóm riêng dưới danh mục (kể cả hũ đã bỏ — nó không "hoàn thành" gì): chạy · dừng · bỏ. */
  const huTieu = useMemo(() => {
    const hang: Record<TrangThaiHu, number> = { dang_chay: 0, tam_dung: 1, bo_do: 2, xong: 3 };
    return hu.filter(laTieuDung).sort((a, b) => hang[a.trangThai] - hang[b.trangThai]);
  }, [hu]);
  const dm = useMemo(() => danhMuc(hu, tatCa, ngay, daGopCua), [hu, tatCa, ngay]);
  /* D426 — đường góp của từng hũ cho biểu đồ vị thế trên lá đang mở (cùng luật đếm với "đã góp" — `duongGopHu`). */
  const duongCua = useMemo(() => new Map(hu.map((h) => [h.id, duongGopHu(tatCa, h)])), [hu, tatCa]);

  /* D421 — "đang gom" chỉ cộng hũ TÍCH LŨY: mức của hũ tiêu dùng là trần tiêu một tháng, không phải tiền muốn gom. */
  const tongGop = useMemo(() => hu.filter(laTichLuy).reduce((a, h) => a + daGopCua(h), 0), [hu, tatCa]);
  const tongMuc = useMemo(() => hu.filter(laTichLuy).reduce((a, h) => a + (h.muc ?? 0), 0), [hu]);

  const mauGoiY = useMemo(() => mauHopVoiHoSo(hoSo), [hoSo]);
  /* D410 — khay phân bổ tối: một trạng thái cho hai mảnh (kệ hũ ở đầu màn · khay tiền ở thanh neo đáy). */
  const pb = usePhanBo(hu, tatCa, ngay, huSanSang && soSanSang);
  const quyetToanHu = quyetToanFor ? hu.find((h) => h.id === quyetToanFor.id) ?? null : null;
  const lenhHu = lenhHuId ? hu.find((h) => h.id === lenhHuId) ?? null : null;

  function datLaiLenh(muc: number | null, kh: string | null): void {
    datMucChon(muc); datKyHan(kh); datChac(null); datViSao(''); datLoiChac(false);
  }

  function moForm(): void {
    rung(NHIP_RUNG.cham);
    datTen(''); datLoiTen(false); datLoaiChon(null); datUuTien(false); datIcon(null);
    datTdKieu('tat'); datTdGt(null); datLoiTd(false);
    datNhomChon(null);
    datLaiLenh(null, null);
    datQuyetToanFor(null);
    datMoHuId(null);
    datLenhHuId(null);
    datDangTao(true);
  }

  /** VÀO LỆNH cho một hũ đang có — mở bảng với mức + kỳ hạn hiện tại của nó (chưa có thì trống). */
  function moLenh(h: Hu): void {
    rung(NHIP_RUNG.cham);
    datLaiLenh(h.muc, lenhCua(h)?.kyHan ?? null);
    datTdKieu(h.tuDong?.kieu ?? 'tat'); datTdGt(h.tuDong?.gt ?? null); datLoiTd(false);
    datMoHuId(null);
    datQuyetToanFor(null);
    datDangTao(false);
    datLenhHuId(h.id);
  }

  /* Đóng lớp (HUỶ / vuốt / Esc): GIỮ nguyên state đang xem — lớp còn trượt xuống thêm một nhịp, đổi state lúc ấy là đổi nội dung giữa chừng. */
  function dongForm(): void {
    rung(NHIP_RUNG.cham);
    datMoTam(false);
  }

  /*
   * ⭐ D429 — LỐI TẮT TỪ KHỐI ĐỊNH HƯỚNG (GƯƠNG · thẻ PHONG CÁCH, "bước dựng"):
   *   · `?tao=tieu_dung|tich_luy` ⇒ mở bảng tạo hũ với LOẠI chọn sẵn;
   *   · `?lenh=<id>&td=ngay|phan_tram` ⇒ mở bảng của hũ ấy với KIỂU quy tắc tự chia chọn sẵn.
   * ⚠ P3 🔒 — Ô SỐ VẪN TRỐNG: lối tắt chọn LOẠI/KIỂU (một cú menu), không bao giờ một con số; chip THEO CỠ LÁ vẫn ở đó như
   *   mọi lần mở bảng. Hũ đã có quy tắc thì giữ nguyên quy tắc của nó — lối tắt không đè thứ người dùng đã đặt.
   * ⚠ Mã lạ / hũ không có / hũ không nhận tiền ⇒ BỎ QUA, không ném (nếp `?dk=` của CAM KẾT: query là thứ ai cũng gõ được).
   * ⚠ Chạy MỖI query mới MỘT lần, sau khi hũ đã tải (`huSanSang` — trước đó `hu` là mảng rỗng và `?lenh=` luôn "không có"), rồi XOÁ
   *   query: tải lại trang không mở lại bảng, và bấm HUỶ không bị lối tắt mở lại ngay. Query mới tới khi màn HŨ ĐÃ dựng (bước dựng từ
   *   lớp CÀI ĐẶT lúc đang đứng ở HŨ) cũng được áp — khoá là chuỗi query, không phải một cờ "đã áp lần nào".
   */
  const [sp, datSp] = useSearchParams();
  /* Khoá query ĐÃ áp (chuỗi `sp`); rỗng ⇒ chưa áp gì. Mỗi query MỚI (khác khoá đang áp) đều được áp — không chỉ lần dựng đầu (RÀ 12/10 C1: bước
     `?tao=` từ khung ở CÀI ĐẶT bị bỏ lặng lẽ khi HŨ đã áp `?chia=1` trước đó). */
  const daApUrl = useRef<string | null>(null);
  /* Đích cuộn của lối tắt — một STATE, không phải `requestAnimationFrame` ngay trong effect dưới: rAF chạy trước khi React kịp
     vẽ bảng vừa mở (soi 27/09: bảng mở mà khung vẫn đứng đầu trang). Cập nhật cùng lượt với `moLenh` ⇒ effect cuộn chạy SAU
     lần commit có bảng. `'dau'` = đầu màn. */
  const [cuonToi, datCuonToi] = useState<string | null>(null);
  useEffect(() => {
    if (cuonToi === null) return;
    const e = cuonToi === 'dau' ? null : document.querySelector(cuonToi);
    if (e !== null) e.scrollIntoView?.({ block: 'center' });
    else window.scrollTo?.(0, 0);
    datCuonToi(null);
  }, [cuonToi]);
  useEffect(() => {
    if (!huSanSang) return;
    const tao = sp.get('tao');
    const lenhId = sp.get('lenh');
    const chia = sp.get('chia');
    if (tao === null && lenhId === null && chia === null) { daApUrl.current = null; return; }
    const khoa = sp.toString();
    if (daApUrl.current === khoa) return;
    daApUrl.current = khoa;
    /* ⚠ Đổi màn trong SPA GIỮ vị trí cuộn của màn trước (soi 26/09: bảng mở ra ở lưng chừng, ô tên khuất trên đỉnh) ⇒
       tạo mới về đầu màn; đặt quy tắc thì cuộn tới đúng khối TỰ CHIA — thứ người dùng vừa bấm để tới đây. */
    let neo: string | null = null;
    if (chia === '1') {
      /* D420 — lối từ ô TỐI NAY ở SỔ: mở thẳng lớp CHIA TIỀN. */
      mo({ k: 'chia' });
    } else if (tao === 'tieu_dung' || tao === 'tich_luy') {
      moTao(tao);
    } else if (lenhId !== null) {
      const h = hu.find((x) => x.id === lenhId);
      if (h !== undefined && laTichLuy(h) && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung')) {
        moSuaLenh(h);
        const td = sp.get('td');
        if (h.tuDong === undefined && (td === 'ngay' || td === 'phan_tram')) datTdKieu(td);
        neo = '[data-neo="tu-dong"]';
      }
    }
    datSp({}, { replace: true });
    datCuonToi(neo ?? 'dau');
  }, [huSanSang, hu, sp]);

  /*
   * ⭐ VÀO LỆNH — một cú cho cả vị thế mới lẫn vị thế đang có.
   * ⚠ Có mức + kỳ hạn thì PHẢI chọn một trong bốn chip độ chắc (50 · 70 · 90 · BỎ QUA): bỏ qua là một cú chạm cùng
   *   trọng lượng, không phải một khoảng trống (D369 §8 — founder: *"nhớ cho user 1 nút bỏ qua"*). Thiếu thì nói ra.
   * ⚠ Kỳ hạn chọn rồi mà sai (NGÀY KHÁC quá gần) ⇒ dừng, không lặng lẽ vào lệnh không kỳ hạn.
   * ⚠ Vị thế đang có đi qua `suaBanGhi` — đọc bản TRONG KHO (lỗi ghi đè đã bắt ở bản 1).
   */
  async function chotLenh(): Promise<void> {
    const moi = lenhHuId === null;
    const t = ten.trim();
    if (moi && !t) { datLoiTen(true); rung(NHIP_RUNG.nang); return; }
    /* D421 — hũ đang có giữ loại của nó (`sua` cấm đổi); tạo mới không chọn loại ⇒ tích lũy. */
    const tieuDung = moi ? nhomChon === 'tieu_dung' : lenhHu !== null && laTieuDung(lenhHu);
    if (!tieuDung && kyHan !== null && !hanHopLe(ngay, kyHan)) { rung(NHIP_RUNG.nang); return; }
    /* ⚠ Kỳ hạn đã chọn thì GIỮ, kể cả khi chưa có mức — bỏ nó đi im lặng là nuốt một điều người dùng vừa nói.
       Cỡ chỉ hiện khi có đủ cả hai; độ chắc chỉ hỏi khi có đủ cả hai ("đủ mức" cần một mức). */
    /* Hũ tiêu dùng đếm theo tháng: không kỳ hạn, không độ chắc, không quy tắc tự chia — ô nào lỡ chạm cũng bỏ qua. */
    const lenh = !tieuDung && kyHan !== null ? { tu: ngay, kyHan } : null;
    const coDieuKhoan = mucChon !== null && mucChon > 0 && lenh !== null;
    if (coDieuKhoan && chac === null) { datLoiChac(true); rung(NHIP_RUNG.nang); return; }
    /* D420 — quy tắc tự chia đã bật mà số trống / sai ⇒ nói ra, không lặng lẽ tắt nó. */
    const td: DatTuDong | null = tieuDung || tdKieu === 'tat' ? null : { kieu: tdKieu, gt: tdGt ?? 0 };
    if (td !== null && (td.gt <= 0 || (td.kieu === 'phan_tram' && td.gt > 100))) {
      datLoiTd(true); rung(NHIP_RUNG.nang); return;
    }
    rung(NHIP_RUNG.nang);
    phutHat(tamPhanTu(nutDay.current), 'var(--gold)', 12);
    const luc = bayGio();
    const doan = coDieuKhoan && chac !== null && chac !== 'bo_qua' ? { han: lenh.kyHan, chac, viSao } : null;
    if (moi) {
      const id = sinhId();
      let h = tuTao({
        ten: t,
        // ⚠ Bỏ qua bước nhãn ⇒ KHÔNG gửi khoá `loai` ⇒ hũ ở lại `null`. Xem `loaiChon`.
        ...(loaiChon !== null ? { loai: loaiChon } : {}),
        ...(mucChon !== null ? { muc: mucChon } : {}),
        ...(uuTien ? { uuTien: 'cao' as const } : {}),
        ...(icon !== null ? { icon } : {}),
        ...(lenh !== null ? { lenh } : {}),
        ...(nhomChon !== null ? { nhom: nhomChon } : {}),
      }, luc, id);
      if (doan !== null) h = moLoiDoan(h, doan, luc, ngay);
      h = datTuDong(h, td, ngay);
      await ghiKho(['hu'], (kho) => kho.ghi('hu', { id, thang: thangNay(), suaLuc: luc, d: h }));
      /*
       * ⚠ Bật đốm ở CẢ HAI đường tạo hũ (tự điền và theo mẫu). Gắn vào một đường thôi thì đốm
       *   vắng mặt im lặng với đúng nửa người dùng, và không gì đỏ.
       * ⚠ `batDom` giữ mốc cũ nếu đốm đang sáng ⇒ tạo hũ thứ hai KHÔNG đẩy đốm khác ra khỏi
       *   trần (xem `lib/dom_bao.ts`).
       */
      batDom('hu_dau_tien', Date.parse(luc));
      datDangTao(false);
      datMoTam(false);
      return;
    }
    const id = lenhHuId;
    const muc = mucChon;
    await ghiKho(['hu'], (kho) => suaBanGhi<Hu>(kho, 'hu', id, (cu) => {
      let h = sua(cu, { muc, ...(lenh !== null ? { lenh } : {}) }, luc);
      if (doan !== null) h = moLoiDoan(h, doan, luc, ngay);
      return datTuDong(h, td, ngay);
    }, luc, thangNay()));
    datMoTam(false);
  }

  async function taoTuMau(mau: MauHu): Promise<void> {
    rung(NHIP_RUNG.nang);
    const luc = bayGio();
    const id = sinhId();
    const moi = tuMau(mau, luc, id);
    await ghiKho(['hu'], (kho) => kho.ghi('hu', { id, thang: thangNay(), suaLuc: luc, d: moi }));
    batDom('hu_dau_tien', Date.parse(luc));
    datDangTao(false);
    datMoTam(false);
  }

  function toggleHu(id: string): void {
    rung(NHIP_RUNG.cham);
    datMoHuId((cur) => (cur === id ? null : id));
  }

  async function doiTT(h: Hu, den: TrangThaiHu): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    const moi = doiTrangThai(h, den, luc);
    await ghiKho(['hu'], (kho) => kho.ghi('hu', { id: h.id, thang: thangNay(), suaLuc: luc, d: moi }));
  }

  function moQuyetToan(h: Hu, dich: DichQuyetToan): void {
    rung(NHIP_RUNG.cham);
    datQuyetToanFor({ id: h.id, dich });
    mo({ k: 'qt' });
  }

  async function chonKetQua(ma: MaKetQuaHu, lyDo?: MaLyDoViThe): Promise<void> {
    if (!quyetToanFor || !quyetToanHu) { datQuyetToanFor(null); return; }
    rung(NHIP_RUNG.nang);
    const luc = bayGio();
    const dich = quyetToanFor.dich;
    await ghiKho(
      ['hu'],
      (kho) => suaBanGhi<Hu>(kho, 'hu', quyetToanHu.id, (cu) => quyetToan(cu, dich, ma, luc, lyDo), luc, thangNay()),
    );
    datMoTam(false);
    datMoHuId(null);
  }

  /* ⭐ SAO = ưu tiên của người dùng (`laHuCoSao`, một cửa với Hub): bật/tắt qua `sua` — ghi dấu `doi_uu_tien` như mọi cú đổi ưu tiên. */
  async function datSao(h: Hu, bat: boolean): Promise<void> {
    rung(NHIP_RUNG.cham);
    const luc = bayGio();
    await ghiKho(['hu'], (kho) => suaBanGhi<Hu>(kho, 'hu', h.id, (cu) => sua(cu, { uuTien: bat ? 'cao' : null }, luc), luc, thangNay()));
  }

  /** NẠP / CHIA một khoản vào hũ CON: đi đúng đường cũ của hũ cha rồi gán cho hũ con (`napVaoConKho`). Trả id khoản, hoặc `null` nếu không đủ. */
  async function napCon(cha: Hu, con: HuCon, soTien: number): Promise<string | null> {
    rung(NHIP_RUNG.nang);
    const luc = bayGio();
    const id = sinhId();
    const tich = laTichLuy(cha);
    const k = taoKhoanPhanBo({ ngay, soTien, huId: cha.id, phanBo: tich ? 'tay' : 'gan', chieu: 'chi' }, luc, id);
    const ok = await ghiKho(['khoan', 'hu_con'], (kho) => napVaoConKho(kho, con, k, tich, luc, thangNay()));
    if (!ok) return null;
    choTich.current.set(cha.id, dsMatRef.current.find((x) => x.h.id === cha.id)?.pct ?? null);
    return id;
  }
  async function hoanTacNap(khoanId: string): Promise<void> {
    rung(NHIP_RUNG.cham);
    await ghiKho(['khoan'], (kho) => kho.xoa('khoan', khoanId, bayGio()));
  }
  /** Tạo hũ con; trả lời nhắn LỖI (đã dịch) hoặc `null` nếu xong — lớp quay về hũ cha. */
  async function taoCon(cha: Hu, tenCon: string, mucCon: number): Promise<string | null> {
    rung(NHIP_RUNG.nang);
    try {
      const luc = bayGio();
      const con = taoHuCon({ ten: tenCon, muc: mucCon }, cha, cacCon, luc, sinhId());
      const ok = await ghiKho(['hu_con'], (kho) => ghiHuConKho(kho, con, luc, thangNay()));
      if (!ok) return CB.huConLoi;
      mo({ k: 'hu', id: cha.id });
      return null;
    } catch (e) {
      return e instanceof LoiHuCon ? e.message : CB.huConLoi;
    }
  }

  const theHu = (h: Hu, co: CoViThe | null, ld: LoiDoanHu | null, camKet = false, luonMo = false): React.ReactElement => (
    <TheHuHang
      key={h.id}
      h={h}
      daGop={daGopCua(h)}
      co={co}
      camKet={camKet}
      ld={ld}
      tt={ld !== null ? trangThaiLoiDoanHu(h, ld, thang) : null}
      moRa={luonMo || moHuId === h.id}
      onToggle={() => toggleHu(h.id)}
      onDoiTT={(den) => void doiTT(h, den)}
      onDanhDauXong={() => moQuyetToan(h, 'xong')}
      onBoHuNay={() => moQuyetToan(h, 'bo_do')}
      onVaoLenh={() => moSuaLenh(h)}
      duong={duongCua.get(h.id) ?? []}
      homNay={ngay}
    />
  );

  /* ══ MẶT BENTO (SPEC `pfm-tang-khong-gian` mục 4.2): bốn ô + danh mục; mọi thứ khác ở lớp trượt ══════════════════════════ */
  const { data: cacCon } = useHuCon();
  const [tam, datTam] = useState<TamHu>({ k: 'chia' });
  const [moTam, datMoTam] = useState(false);
  const [buocTao, datBuocTao] = useState(1);
  const mo = useCallback((t: TamHu): void => { datTam(t); datMoTam(true); }, []);
  const dongTam = useCallback((): void => datMoTam(false), []);

  /** Mọi hũ CÒN SỐNG (chạy · tạm dừng) với số đã tính — hũ đã đóng đi qua lớp DANH MỤC. */
  const dsMat = useMemo((): HuMat[] => hu
    .filter((h) => h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung')
    .map((h) => {
      const tieu = laTieuDung(h);
      const so = tieu ? daTieuTrongThang(tatCa, h.id, thang) : daGopCua(h);
      const p = tienDo(h, so);
      const kyCuoi = Object.keys(h.ketQuaKy ?? {}).sort().at(-1);
      const nacCuoi = kyCuoi === undefined ? undefined : h.ketQuaKy![kyCuoi];
      return {
        h, so, tieu, sao: laHuCoSao(h),
        pct: p === null ? null : Math.round(p * 100),
        ld: tieu ? null : loiDoanHuDangMo(h, thang),
        co: dm.dong.find((d) => d.hu.id === h.id)?.co ?? null,
        nCon: conCua(cacCon, h.id).length,
        kyTruoc: nacCuoi === undefined ? null : CHU_KET_QUA_HU[nacCuoi].toLowerCase(),
      };
    }), [hu, tatCa, thang, dm, cacCon]);
  const matTk = useMemo(() => dsMat.filter((x) => !x.tieu), [dsMat]);
  const matChi = useMemo(() => dsMat.filter((x) => x.tieu), [dsMat]);
  const matChinh = dsMat.find((x) => x.sao) ?? matTk[0] ?? matChi[0] ?? null;
  const dangTaiMat = !huSanSang || !soSanSang;

  /* Mở lớp TẠO HŨ ba bước ở bước 1, loại chọn sẵn (từ dấu + của ô nhóm) hoặc chưa chọn. */
  function moTao(nhom: NhomHu | null): void {
    moForm();
    datNhomChon(nhom);
    datBuocTao(1);
    mo({ k: 'tao' });
  }
  function moSuaLenh(h: Hu): void { moLenh(h); mo({ k: 'lenh' }); }
  function moChiaChoHu(id: string | null): void {
    if (id !== null && pb.chon !== id) pb.chonHu(id);
    mo({ k: 'chia' });
  }

  /* Lời hỏi của quy tắc tự chia (D420) KHÔNG được nằm im sau một ô đóng: thẻ HỎI hiện ⇒ bung lớp CHIA một lần mỗi lần mở màn. */
  const daMoHoi = useRef(false);
  useEffect(() => {
    if (pb.the?.loai === 'hoi' && !daMoHoi.current) { daMoHoi.current = true; mo({ k: 'chia' }); }
  }, [pb.the, mo]);

  /*
   * ⭐ TÍCH HŨ TRÊN MẶT (SPEC mục 5): hũ nhận tiền (NẠP / tự chia) ⇒ khi lớp trượt ĐÓNG, xu rơi vào miệng hũ trên màn · mực dâng từ mức
   * cũ có vượt · hũ nảy. `choTich` ghi mức TRƯỚC lúc `pb.vuaNap` đổi (sổ chưa đọc lại nên `dsMat` còn là số cũ); phát khi lớp đóng + một nhịp
   * trượt xuống. Số liệu KHÔNG phụ thuộc hiệu ứng (React đã vẽ số mới) — xem `tich_hu.ts`.
   */
  const choTich = useRef(new Map<string, number | null>());
  const keyDaThay = useRef(new Map<string, number>());
  const dsMatRef = useRef(dsMat);
  dsMatRef.current = dsMat;
  useEffect(() => {
    for (const [id, vn] of Object.entries(pb.vuaNap)) {
      if (keyDaThay.current.get(id) === vn.key) continue;
      keyDaThay.current.set(id, vn.key);
      if (pb.huong === 'nap' || vn.pctMoi !== null) choTich.current.set(id, dsMatRef.current.find((x) => x.h.id === id)?.pct ?? null);
    }
  }, [pb.vuaNap, pb.huong]);
  const henTich = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => { for (const t of henTich.current) clearTimeout(t); }, []);
  useEffect(() => {
    if (moTam || choTich.current.size === 0) return;
    const t = setTimeout(() => {
      for (const [id, truoc] of choTich.current) {
        const nay = dsMatRef.current.find((x) => x.h.id === id)?.pct ?? null;
        phatTichHu(document, { huId: id, truoc, nay }, { nay: hb.nay ?? '', xu: hb.xuRoi ?? '' });
      }
      choTich.current.clear();
    }, NHIP.HUB_TAM + 60);
    henTich.current.push(t);
  }, [moTam, dsMat]);

  /* ── RUỘT LỚP TRƯỢT ── */
  const hSua = tam.k === 'hu' || tam.k === 'con' || tam.k === 'themcon'
    ? hu.find((x) => x.id === (tam.k === 'con' ? conChaId(tam.id, cacCon) : tam.k === 'themcon' ? tam.chaId : tam.id)) ?? null
    : null;
  let ruot: React.ReactNode = null;
  let chan: React.ReactNode;
  let nhan: string = CB.huChiaTen;

  if (tam.k === 'chia') {
    nhan = CB.huChiaTen;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="coin" size={32} />} ten={CB.huChiaTen} tag={CB.huChiaTag} />
        <div className={hb.keTrongTam}><KeHuPhanBo pb={pb} /></div>
      </>
    );
    // Chưa có hũ nào ĐANG CHẠY ⇒ không có chỗ để chia ⇒ không khay (như màn cũ: khay chỉ đứng khi `pb.hien`).
    chan = pb.hien ? <div className={hb.khayTrongTam}><KhayPhanBo pb={pb} /></div> : undefined;
  } else if (tam.k === 'tao') {
    nhan = CB.huTaoHu;
    ruot = (
      <TamTaoHu
        buoc={buocTao} nhomChon={nhomChon} datNhomChon={datNhomChon} ten={ten} datTen={datTen} loiTen={loiTen}
        icon={icon} datIcon={datIcon} muc={mucChon} datMuc={datMucChon} kyHan={kyHan} datKyHan={datKyHan}
        loaiChon={loaiChon} datLoaiChon={datLoaiChon} uuTien={uuTien} datUuTien={datUuTien}
        chac={chac} datChac={(c) => { datChac(c); datLoiChac(false); }} loiChac={loiChac} viSao={viSao} datViSao={datViSao}
        ngay={ngay} dongTien={dm.dongTien} mau={mauGoiY} onMau={(m) => void taoTuMau(m)}
      />
    );
    const tong = nhomChon === 'tieu_dung' ? 2 : 3;
    const cuoi = buocTao >= tong;
    chan = (
      <div className={b.hai}>
        {buocTao > 1
          ? <button type="button" className={b.nutPhu} data-testid="tao-lai" onClick={() => datBuocTao((x) => Math.max(1, x - 1))}>{CB.huTaoLai}</button>
          : <span />}
        <NutChinh
          dau={cuoi ? 'tao-xong' : 'tao-tiep'}
          onChon={() => {
            if (cuoi) { void chotLenh(); return; }
            if (buocTao === 2) {
              if (ten.trim() === '') { datLoiTen(true); rung(NHIP_RUNG.nang); return; }
              const tieuDung = nhomChon === 'tieu_dung';
              if (!tieuDung && kyHan !== null && !hanHopLe(ngay, kyHan)) { rung(NHIP_RUNG.nang); return; }
            }
            datBuocTao((x) => Math.min(tong, x + 1));
          }}
        >
          {cuoi ? CB.huTaoXong : CB.huTaoTiep}
        </NutChinh>
      </div>
    );
  } else if (tam.k === 'lenh') {
    nhan = CB.huSuaTen;
    ruot = (
      <BangLenh
        hu={lenhHu} ngay={ngay} dongTien={dm.dongTien}
        ten={ten} datTen={datTen} loiTen={loiTen}
        loaiChon={loaiChon} datLoaiChon={datLoaiChon}
        muc={mucChon} datMuc={datMucChon}
        uuTien={uuTien} datUuTien={datUuTien}
        icon={icon} datIcon={datIcon}
        kyHan={kyHan} datKyHan={datKyHan}
        chac={chac} datChac={(c) => { datChac(c); datLoiChac(false); }}
        loiChac={loiChac}
        viSao={viSao} datViSao={datViSao}
        tdKieu={tdKieu} datTdKieu={(k) => { datTdKieu(k); datLoiTd(false); }}
        tdGt={tdGt} datTdGt={(v) => { datTdGt(v); datLoiTd(false); }} loiTd={loiTd}
        nhomChon={nhomChon} datNhomChon={datNhomChon}
        onHuy={dongForm}
      />
    );
    chan = <NutChinh dau="luu-lenh" onChon={() => void chotLenh()}>{CV.luuLenh}</NutChinh>;
  } else if (tam.k === 'qt') {
    nhan = CB.huQuyetToan;
    ruot = quyetToanFor && quyetToanHu ? (
      <QuyetToanHop
        hu={quyetToanHu} dich={quyetToanFor.dich}
        loiDoan={loiDoanHuDangMo(quyetToanHu, thang)}
        onChon={(ma, lyDo) => void chonKetQua(ma, lyDo)}
      />
    ) : null;
  } else if (tam.k === 'danhmuc') {
    nhan = `${CB.huDanhMucPre}${Number(thang.slice(5, 7))}`;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="vault" size={32} />} ten={`${CB.huDanhMucPre}${Number(thang.slice(5, 7))}`} tag={CB.huDanhMucTag} />
        <KhoiDanhMuc dm={dm} thang={thang} tongGop={tongGop} tongMuc={tongMuc} />
        {/* Lá vị thế theo thứ tự DANH MỤC (vị thế có cỡ trước, lớn trước) — đúng thứ tự màn HŨ cũ. */}
        {dm.dong.map((d) => theHu(d.hu, d.co, d.ld, d.camKet))}
        {/* ⭐ D421 — hũ TIÊU DÙNG: không phải vị thế (không cỡ, không kỳ hạn) nên đứng ngoài danh mục, nhóm riêng. */}
        {huTieu.length > 0 && (
          <>
            <p className={`${s.dauMuc} ${s.dauMucTieu}`}>{`${CP.keTieuDungPre}${Number(thang.slice(5, 7))}`}</p>
            {huTieu.map((h) => (
              <TheHuTieu
                key={h.id} h={h} thang={thang} daTieu={daTieuTrongThang(tatCa, h.id, thang)} moRa={moHuId === h.id}
                onToggle={() => toggleHu(h.id)} onDoiTT={(den) => void doiTT(h, den)} onDatMuc={() => moSuaLenh(h)}
              />
            ))}
          </>
        )}
        {nhomXong.length > 0 && (
          <>
            <p className={s.dauMuc}>{`${CHU_MAN_HU.daHoanThanh} · ${nhomXong.length}`}</p>
            {nhomXong.map((h) => theHu(h, null, null))}
          </>
        )}
      </>
    );
  } else if (tam.k === 'nhom') {
    const tk = tam.nhom === 'tich_luy';
    const ds = tk ? matTk : matChi;
    nhan = tk ? CB.huNhomTk : CB.huNhomChi;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="vault" size={32} />} ten={tk ? CB.huNhomTk : CB.huNhomChi} tag={tk ? CB.huNhomTkPhu : CB.huNhomChiPhu} />
        {ds.length === 0 && <p className={b.ghiChu}>{CB.huNhomRong}</p>}
        {ds.map((x) => {
          const t = tongHopCha(x.h, cacCon, tatCa, thang);
          return (
            <div key={x.h.id}>
              <button type="button" className={`${b.dongL} ${b.dongBam}`} onClick={() => mo({ k: 'hu', id: x.h.id })} data-testid="nhom-hang-hu">
                <span>{`${x.sao ? '★ ' : ''}${x.h.ten}`}</span>
                <b className={b.vang}>
                  {tk ? `${gonTien(x.so)} / ${x.h.muc === null ? '—' : gonTien(x.h.muc)}` : `${CB.huConLaiPre}${x.h.muc === null ? '—' : gonTien(Math.max(0, x.h.muc - x.so))}`}
                </b>
              </button>
              {t.hang.map((r) => (
                <button key={r.con.id} type="button" className={`${b.dongL} ${b.conHang} ${b.dongBam}`} onClick={() => mo({ k: 'con', id: r.con.id })}>
                  <span>{r.con.ten}</span><b>{`${gonTien(r.so)} / ${gonTien(r.con.muc)}`}</b>
                </button>
              ))}
            </div>
          );
        })}
      </>
    );
    chan = (
      <NutChinh dau="nhom-tao" onChon={() => moTao(tam.nhom)}>
        {tk ? CB.huTaoTkNut : CB.huTaoChiNut}
      </NutChinh>
    );
  } else if (tam.k === 'hu' && hSua !== null) {
    const x = dsMat.find((y) => y.h.id === hSua.id);
    const tieuH = laTieuDung(hSua);
    const d = dm.dong.find((y) => y.hu.id === hSua.id);
    const t = tongHopCha(hSua, cacCon, tatCa, thang);
    nhan = hSua.ten;
    ruot = (
      <>
        <TamDau
          icon={<PixelIcon name={hSua.icon} size={32} />}
          ten={`${x?.sao ? '★ ' : ''}${hSua.ten.toUpperCase()}`}
          tag={tieuH ? CB.huTagChi : `${CB.huTagTk}${hSua.lenh !== undefined ? ` · ${CV.toiPre}${ngayViet(hSua.lenh.kyHan, true)}` : ''}`}
        />
        {!tieuH && hSua.loai !== null && (
          <div className={b.dongL}><span>{CB.huMucTieu}</span><em>{CHU_LOAI_CHI[hSua.loai]}</em></div>
        )}
        {!tieuH && (x?.ld ?? null) !== null && (
          <div className={b.khoiDoan} data-testid="hu-loi-doan">
            <span className={b.nhanDoan}>{CB.huLoiDoanCuaBan}</span>
            <b>{`${CV.toiPre}${ngayViet(x!.ld!.han, true)}: ${CB.huDoanDu}`}</b>
            <span className={b.duoi}>{`${CB.huDoChac}${CHAC_CHU[x!.ld!.chac]} · ${CB.huTuCham}`}</span>
          </div>
        )}
        {!tieuH && x !== undefined && x.ld === null && (
          <p className={b.ghiChu}>{hSua.muc === null ? CB.huChuaMucPhu : CB.huChuaDoanPhu}</p>
        )}
        {!tieuH && x?.kyTruoc != null && (
          <div className={b.dongL}><span>{CB.huKyTruocTen}</span><em>{x.kyTruoc}</em></div>
        )}
        {tieuH ? (
          <TheHuTieu
            h={hSua} thang={thang} daTieu={daTieuTrongThang(tatCa, hSua.id, thang)} moRa
            onToggle={() => {}} onDoiTT={(den) => void doiTT(hSua, den)} onDatMuc={() => moSuaLenh(hSua)}
          />
        ) : (
          theHu(hSua, d?.co ?? null, x?.ld ?? null, d?.camKet ?? false, true)
        )}
        <p className={b.tieuNho}>{CB.huConTieuDe}</p>
        {t.hang.map((r) => (
          <button key={r.con.id} type="button" className={`${b.dongL} ${b.conHang} ${b.dongBam}`} onClick={() => mo({ k: 'con', id: r.con.id })} data-testid="hu-con-hang">
            <span>{r.con.ten}</span><b>{`${gonTien(r.so)} / ${gonTien(r.con.muc)}`}</b>
          </button>
        ))}
        {t.hang.length > 0 && t.chuaChia !== 0 && (
          <div className={`${b.dongL} ${b.conHang}`} data-testid="hu-chua-chia">
            <span>{CB.huChuaChiaCon}</span><b>{gonTien(t.chuaChia)}</b>
          </div>
        )}
        <button type="button" className={b.oNhap} onClick={() => mo({ k: 'themcon', chaId: hSua.id })} data-testid="hu-them-con">
          <span>{CB.huThemCon}</span><span>›</span>
        </button>
        {laHuCoSao({ tuMauId: hSua.tuMauId, uuTien: 'cao' }) && (
          <div className={b.tuyChon}>
            <button type="button" aria-pressed={laHuCoSao(hSua)} data-testid="hu-sao" onClick={() => void datSao(hSua, !laHuCoSao(hSua))}>
              <span className={b.mot}>{CB.huSaoNut}</span><span>{laHuCoSao(hSua) ? '●' : ''}</span>
            </button>
          </div>
        )}
      </>
    );
    chan = (
      <div className={b.hai}>
        {t.hang.length === 0 && hSua.trangThai === 'dang_chay' ? (
          <NutChinh dau="hu-nap" onChon={() => moChiaChoHu(hSua.id)}>{tieuH ? CB.huChiaVao : CB.huNap}</NutChinh>
        ) : <span />}
        {hSua.trangThai !== 'xong' && hSua.trangThai !== 'bo_do' && (
          <button type="button" className={b.nutPhu} data-testid="hu-sua" onClick={() => moSuaLenh(hSua)}>
            {tieuH ? CP.datMucThang : CB.huSuaLoiDoan}
          </button>
        )}
      </div>
    );
  } else if (tam.k === 'con' || tam.k === 'themcon') {
    const chaH = hSua;
    const con = tam.k === 'con' ? cacCon.find((c) => c.id === tam.id) ?? null : null;
    nhan = tam.k === 'con' ? (con?.ten ?? CB.huConTieuDe) : CB.huThemCon;
    ruot = chaH === null ? null : tam.k === 'con' ? (
      con === null ? null : (
        <TamHuCon
          cha={chaH} con={con} so={tongHopCha(chaH, cacCon, tatCa, thang).hang.find((r) => r.con.id === con.id)?.so ?? 0}
          troi={laTichLuy(chaH) ? pb.conLai : pb.chiCon}
          nap={(sotien) => napCon(chaH, con, sotien)} hoanTac={hoanTacNap}
        />
      )
    ) : (
      <TamThemCon
        cha={chaH} conNhan={tongHopCha(chaH, cacCon, tatCa, thang).conNhan}
        tao={(tenCon, mucCon) => taoCon(chaH, tenCon, mucCon)}
      />
    );
  }

  return (
    <div className={b.trang} data-testid="hu-bento-goc">
      <MatHu
        dangTai={dangTaiMat}
        chinh={matChinh} tk={matTk} chi={matChi} thang={thang}
        chia={{ vi: pb.conLai, chi: pb.chiCon, coHu: pb.hien, dangHoi: pb.the?.loai === 'hoi' }}
        danhMuc={{ gom: tongGop, muc: tongMuc }}
        onChia={() => moChiaChoHu(null)}
        onHu={(id) => mo({ k: 'hu', id })}
        onNhom={(n) => mo({ k: 'nhom', nhom: n })}
        onTao={(n) => moTao(n)}
        onDanhMuc={() => mo({ k: 'danhmuc' })}
      />
      <TamTruot mo={moTam} onDong={dongTam} nhan={nhan} dau="hu" cao="lon" chan={chan}>
        {ruot}
      </TamTruot>
    </div>
  );
}

/** Mã chữ ba nấc độ chắc — một nguồn cho lớp hũ và bước 3 của TẠO HŨ. */
const CHAC_CHU: Record<MaChac, string> = { cao: CB.huChacCao, vua: CB.huChacVua, thap: CB.huChacThap };

const gonTien = (n: number): string => { const g = tienGon(n); return g.don === 'đ' ? `${g.so}đ` : `${g.so}${g.don}`; };

/** Lớp trượt đang mở của màn HŨ. */
export type TamHu =
  | { k: 'chia' } | { k: 'tao' } | { k: 'lenh' } | { k: 'qt' } | { k: 'danhmuc' }
  | { k: 'nhom'; nhom: 'tich_luy' | 'tieu_dung' }
  | { k: 'hu'; id: string }
  | { k: 'con'; id: string }
  | { k: 'themcon'; chaId: string };

/** Hũ cha của một hũ con (cho `hSua`). Không thấy ⇒ chuỗi rỗng (không hũ nào có id rỗng). */
function conChaId(conId: string, cacCon: readonly HuCon[]): string {
  return cacCon.find((c) => c.id === conId)?.chaId ?? '';
}

/* ═══ LỚP TRƯỢT: TẠO HŨ ba bước · HŨ CON ═════════════════════════════════════════════════════════════════════════════ */

/**
 * ⭐ TẠO HŨ BA BƯỚC (SPEC `pfm-tang-khong-gian` mục 4.2; demo `taoHu`): ① LOẠI (tiết kiệm / chi) → ② TÊN + MỤC TIÊU + MỨC + HẠN → ③ LỜI ĐOÁN +
 * ĐỘ CHẮC ("app tự chấm khi tới hạn") — điểm khác của Delphi nằm ở bước 3. Hũ CHI không có kỳ hạn/lời đoán (D421) nên chỉ hai bước.
 *
 * ⚠ KHÔNG viết lại luật tạo hũ: mọi ô ghi vào ĐÚNG state của `RuotHu` (cùng state với bảng VÀO LỆNH cũ) và nút TẠO HŨ gọi `chotLenh()` — một đường
 *   ghi (A11.5). P3 🔒: không ô nào sáng sẵn, số tiền để TRỐNG; BỎ QUA độ chắc là một lựa chọn cùng cỡ (D369 §8).
 * ⚠ Câu 2 = A (founder 11/10): lời đoán là "tới hạn ĐỦ MỨC" + ba nấc chắc (`CHAC`) như `LoiDoanHu` — KHÔNG bốn nấc ĐỦ/GẦN ĐỦ/NỬA/ÍT của demo.
 */
function TamTaoHu(p: {
  buoc: number;
  nhomChon: NhomHu | null; datNhomChon: (v: NhomHu | null) => void;
  ten: string; datTen: (v: string) => void; loiTen: boolean;
  icon: IconHu | null; datIcon: (v: IconHu | null) => void;
  muc: number | null; datMuc: (v: number | null) => void;
  kyHan: string | null; datKyHan: (v: string | null) => void;
  loaiChon: MaLoaiHu | null; datLoaiChon: (v: MaLoaiHu | null) => void;
  uuTien: boolean; datUuTien: (v: boolean) => void;
  chac: MaChac | 'bo_qua' | null; datChac: (v: MaChac | 'bo_qua' | null) => void; loiChac: boolean;
  viSao: string; datViSao: (v: string) => void;
  ngay: string; dongTien: DongTien | null;
  mau: readonly MauHu[]; onMau: (m: MauHu) => void;
}): React.ReactElement {
  const [ngayKhac, datNgayKhac] = useState(false);
  const tieu = p.nhomChon === 'tieu_dung';
  const tong = tieu ? 2 : 3;
  const hanSai = p.kyHan !== null && !hanHopLe(p.ngay, p.kyHan);
  const du = !tieu && p.muc !== null && p.muc > 0 && p.kyHan !== null && !hanSai;
  const co = du ? coTuDieuKhoan(p.muc!, { tu: p.ngay, kyHan: p.kyHan! }, 0, p.ngay, p.dongTien) : null;
  const chonNhom = (n: NhomHu): void => { rung(NHIP_RUNG.cham); p.datNhomChon(p.nhomChon === n ? null : n); };
  return (
    <>
      <TamDau
        icon={<PixelIcon name="vault" size={32} />} ten={CB.huTaoHu}
        tag={p.nhomChon === null ? CB.huTaoTag : tieu ? CB.huTagChi : CB.huTagTk}
      />
      <div className={b.buoc} data-testid="tao-buoc">
        {Array.from({ length: tong }, (_, i) => <i key={i} className={i < p.buoc ? b.xong : ''} />)}
        <span>{`${CB.huBuoc} ${p.buoc} / ${tong}`}</span>
      </div>

      {p.buoc === 1 && (
        <>
          <p className={hb.tieuLop}>{CB.huLoaiHoi}</p>
          <div className={hb.chonLoai} role="group" aria-label={CB.huLoaiHoi}>
            <button type="button" aria-pressed={p.nhomChon === 'tich_luy'} data-nhom="tich_luy" onClick={() => chonNhom('tich_luy')}>
              <span className={hb.binhNho} style={{ '--fill': 'var(--c-2)' } as React.CSSProperties}><i style={{ height: '60%' }} /></span>
              <b>{CB.huNhomTk}</b><span>{CB.huNhomTkPhu}</span>
            </button>
            <button type="button" aria-pressed={p.nhomChon === 'tieu_dung'} data-nhom="tieu_dung" onClick={() => chonNhom('tieu_dung')}>
              <span className={hb.phongBi}><i style={{ width: '55%' }} /></span>
              <b>{CB.huNhomChi}</b><span>{CB.huNhomChiPhu}</span>
            </button>
          </div>
          <p className={hb.ghiPhu}>{CB.huLoaiGiai}</p>
          {!tieu && p.mau.length > 0 && <MauList maus={p.mau} onChon={p.onMau} />}
        </>
      )}

      {p.buoc === 2 && (
        <>
          <p className={hb.tieuLop}>{tieu ? CP.tenHuTieuHoi : CHU_MAN_HU.tenHuHoi}</p>
          <input
            className={`${hb.oGo} ${p.loiTen && p.ten.trim() === '' ? hb.loi : ''}`} maxLength={40} data-testid="tao-ten"
            placeholder={p.loiTen && p.ten.trim() === '' ? CHU_MAN_HU.loiThieuTen : tieu ? CP.tenHuTieuGiuCho : CHU_MAN_HU.tenHuGiuCho}
            value={p.ten} onChange={(e) => p.datTen(e.target.value)}
          />
          {!tieu && (
            <>
              <p className={hb.tieuLop}>{CB.huMucTieuHoi}</p>
              <div className={b.hangChon} data-testid="tao-muc-tieu">
                {LOAI_HU.map((l) => (
                  <button
                    key={l} type="button" aria-pressed={p.loaiChon === l}
                    onClick={() => { rung(NHIP_RUNG.cham); p.datLoaiChon(p.loaiChon === l ? null : l); }}
                  >
                    {O_CHU_LOAI_CHI[l]}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className={hb.tieuLop}>
            {tieu ? CP.mucThangHoi : CHU_MAN_HU.mucMuonGom} <span className={hb.ghiPhu}>{CHU_MAN_HU.deTrongNeuChuaBiet}</span>
          </p>
          <OMuc muc={p.muc} datMuc={p.datMuc} />
          {!tieu && (
            <>
              <p className={hb.tieuLop}>{CV.kyHanHoi}</p>
              <div className={b.hangChon} data-testid="tao-han">
                {PFM.VI_THE_HAN_THANG.map((n) => {
                  const d = hanTuSoThang(p.ngay, n);
                  const dang = !ngayKhac && p.kyHan === d;
                  return (
                    <button
                      key={n} type="button" aria-pressed={dang}
                      onClick={() => { rung(NHIP_RUNG.cham); datNgayKhac(false); p.datKyHan(dang ? null : d); }}
                    >
                      {`${n}${CV.thangSau}`}
                    </button>
                  );
                })}
                <button type="button" aria-pressed={ngayKhac} onClick={() => { rung(NHIP_RUNG.cham); datNgayKhac(!ngayKhac); p.datKyHan(null); }}>
                  {CV.ngayKhac}
                </button>
              </div>
              {ngayKhac && (
                <input
                  type="date" className={hb.oGo} min={congNgay(p.ngay, PFM.VI_THE_HAN_TOI_THIEU_NGAY)} aria-label={CV.ngayKhac}
                  value={p.kyHan ?? ''} onChange={(e) => p.datKyHan(e.target.value === '' ? null : e.target.value)}
                />
              )}
              {p.kyHan !== null && !hanSai && <p className={hb.ghiPhu}>{`${CV.toiPre}${ngayViet(p.kyHan, true)}`}</p>}
              {hanSai && <p className={hb.ghiPhu} role="alert">{`${CV.hanGanQua}${PFM.VI_THE_HAN_TOI_THIEU_NGAY}${CV.hanGanQuaHau}`}</p>}
              {co !== null && (
                <div className={hb.tomCo} data-testid="tao-co">
                  <span>{CV.coTieu}</span>
                  <span><b>{dinhDangDong(co.moiThang)}</b>{CV.moiThangChu} · <b>{dinhDangDong(co.moiNgay)}</b>{CV.moiNgayChu}</span>
                </div>
              )}
            </>
          )}
          <p className={hb.tieuLop}>{CV.bieuTuongHoi}</p>
          <div className={hb.luoiIcon}>
            {ICON_HU.map((ic) => (
              <button
                key={ic} type="button" aria-pressed={p.icon === ic} aria-label={`${CV.bieuTuongHoi} ${ic}`}
                onClick={() => { rung(NHIP_RUNG.cham); p.datIcon(p.icon === ic ? null : ic); }}
              >
                <PixelIcon name={ic} size={24} />
              </button>
            ))}
          </div>
          <div className={b.tuyChon}>
            <button type="button" aria-pressed={p.uuTien} data-testid="tao-sao" onClick={() => { rung(NHIP_RUNG.cham); p.datUuTien(!p.uuTien); }}>
              <span className={b.mot}>{CB.huSaoNut}</span><span>{p.uuTien ? '●' : ''}</span>
            </button>
          </div>
        </>
      )}

      {p.buoc === 3 && !tieu && (
        <>
          <div className={`${b.khoiDoan} ${b.noiBat}`}><span className={b.nhanDoan}>{`✓ ${CB.huTuChamKhiToiHan}`}</span></div>
          {!du ? (
            <p className={hb.ghiPhu} data-testid="tao-chua-du">{CB.huChuaDuDeDoan}</p>
          ) : (
            <>
              <p className={hb.tieuLop}>{CB.huDoanHoi}</p>
              <p className={hb.ghiPhu}>{`${CV.toiPre}${ngayViet(p.kyHan!, true)} · ${dinhDangDong(p.muc!)}${CHU_MAN_SO.hauDong}`}</p>
              <p className={hb.tieuLop}>{CB.huChacHoi}</p>
              <div className={hb.hangChac} data-testid="tao-chac">
                {(['cao', 'vua', 'thap'] as const).map((c) => (
                  <button
                    key={c} type="button" aria-pressed={p.chac === c}
                    onClick={() => { rung(NHIP_RUNG.cham); p.datChac(p.chac === c ? null : c); }}
                  >
                    <span>{CHAC_CHU[c]}</span><small>{`${PFM.VI_THE_CHAC[c]}%`}</small>
                  </button>
                ))}
                <button type="button" aria-pressed={p.chac === 'bo_qua'} onClick={() => { rung(NHIP_RUNG.cham); p.datChac(p.chac === 'bo_qua' ? null : 'bo_qua'); }}>
                  <span>{CV.boQua}</span>
                </button>
              </div>
              <p className={hb.ghiPhu} role={p.loiChac ? 'alert' : undefined}>{p.loiChac ? CV.thieuChac : CV.chacGiai}</p>
              {p.chac !== null && p.chac !== 'bo_qua' && (
                <>
                  <p className={hb.tieuLop}>{CV.viSaoHoi}</p>
                  <input
                    className={hb.oGo} maxLength={PFM.VI_THE_VI_SAO_CAT} placeholder={CV.viSaoGiuCho}
                    value={p.viSao} onChange={(e) => p.datViSao(e.target.value)}
                  />
                </>
              )}
            </>
          )}
          <p className={b.chuGiai}><span className={hb.oMay}><PixelIcon name="lock" size={12} />{CB.huOLaiMay}</span></p>
        </>
      )}
    </>
  );
}

/**
 * LỚP MỘT HŨ CON (CHỈ Ở MÁY, một tầng). NẠP / CHIA đi qua ĐÚNG đường ghi của hũ cha (`napVaoConKho`): khoản vẫn nối vào hũ cha nên ví,
 * danh mục, Hub, lời đoán của cha đọc đúng số cũ; hũ con chỉ ghi nhớ khoản nào của cha thuộc về nó (`pfm/hu_con.ts`).
 * ⚠ Số gõ vượt tiền còn (ví / phần chi chưa chia) ⇒ nói ra, không ghi. HOÀN TÁC 4 giây như mọi cú ghi (cùng `HOAN_TAC_MS`).
 */
function TamHuCon(p: {
  cha: Hu; con: HuCon; so: number; troi: number;
  nap: (soTien: number) => Promise<string | null>;
  hoanTac: (khoanId: string) => Promise<void>;
}): React.ReactElement {
  const tich = laTichLuy(p.cha);
  const [go, datGo] = useState('');
  const [bao, datBao] = useState<string | null>(null);
  const [lui, datLui] = useState<{ id: string; so: number } | null>(null);
  const dangGhi = useRef(false);
  const henLui = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (henLui.current !== null) clearTimeout(henLui.current); }, []);
  const soGo = go === '' ? 0 : Number(go);
  const vuot = soGo > p.troi;
  const pct = p.con.muc > 0 ? Math.round(Math.max(0, Math.min(1, p.so / p.con.muc)) * 100) : null;
  async function xacNhan(): Promise<void> {
    if (soGo <= 0 || vuot || dangGhi.current) return;
    dangGhi.current = true;
    try {
      const id = await p.nap(soGo);
      if (id === null) { datBao(CB.huConKhongDu); return; }
      datBao(null);
      datLui({ id, so: soGo });
      datGo('');
      if (henLui.current !== null) clearTimeout(henLui.current);
      henLui.current = setTimeout(() => datLui(null), HOAN_TAC_MS);
    } finally { dangGhi.current = false; }
  }
  return (
    <>
      <TamDau icon={<PixelIcon name="target" size={32} />} ten={p.con.ten.toUpperCase()} tag={`${CB.huConCuaPre}${p.cha.ten.toUpperCase()}`} />
      <div className={b.dongL}><span>{tich ? CB.huConDaGop : CB.huConDaTieu}</span><b className={b.vang} data-testid="con-so">{`${dinhDangDong(p.so)}${CHU_MAN_SO.hauDong}`}</b></div>
      <div className={b.dongL}><span>{CB.huConMuc}</span><b>{`${dinhDangDong(p.con.muc)}${CHU_MAN_SO.hauDong}`}</b></div>
      <span className={b.thanh} aria-hidden="true"><i className={b.mocNgang} style={{ width: `${pct ?? 0}%` }} /></span>
      <p className={hb.tieuLop}>{tich ? CB.huConNapHoi : CB.huConChiaHoi}</p>
      <div className={hb.nhapSo}>
        <b className={b.vang} data-testid="con-go">{`${dinhDangDong(soGo)}${CHU_MAN_SO.hauDong}`}</b>
        <span className={b.duoi}>{`${tich ? CB.huConViConPre : CB.huConChiConPre}${dinhDangDong(p.troi)}${CHU_MAN_SO.hauDong}`}</span>
      </div>
      {vuot && <p className={hb.ghiPhu} role="alert">{`${CB.huConVuotPre}${dinhDangDong(p.troi)}${CHU_MAN_SO.hauDong}`}</p>}
      {bao !== null && <p className={hb.ghiPhu} role="alert">{bao}</p>}
      {lui !== null && (
        <div className={b.dongL} role="status" data-testid="con-lui">
          <span>{`${CB.huConDaNapPre}${dinhDangDong(lui.so)}${CHU_MAN_SO.hauDong}`}</span>
          <button type="button" className={b.nutPhu} style={{ width: 'auto', height: 30 }} onClick={() => { void p.hoanTac(lui.id); datLui(null); }}>
            {CHU_MAN_SO.nutHoanTac}
          </button>
        </div>
      )}
      <BanPhim
        luonHien
        onSo={(d) => { rung(NHIP_RUNG.cham); datGo((g) => { const v = `${g}${d}`.replace(/^0+/, ''); return v.length > 12 ? g : v; }); }}
        onXoa={() => { rung(NHIP_RUNG.cham); datGo((g) => g.slice(0, -1)); }}
      />
      <NutChinh dau="con-nap" disabled={soGo <= 0 || vuot} onChon={() => void xacNhan()}>
        {`${tich ? CB.huConNapNut : CB.huConChiaNut} ${dinhDangDong(soGo)}`}
      </NutChinh>
    </>
  );
}

/** LỚP THÊM HŨ CON: tên + mức (người dùng tự gõ — P3). Mức không vượt phần cha còn nhận (`conNhan`); lỗi `LoiHuCon` được NÓI RA. */
function TamThemCon(p: {
  cha: Hu; conNhan: number | null; tao: (ten: string, muc: number) => Promise<string | null>;
}): React.ReactElement {
  const [ten, datTen] = useState('');
  const [muc, datMuc] = useState<number | null>(null);
  const [loi, datLoi] = useState<string | null>(null);
  const dangGhi = useRef(false);
  async function tao(): Promise<void> {
    if (dangGhi.current) return;
    if (ten.trim() === '') { datLoi(CHU_MAN_HU.loiThieuTen); return; }
    if (muc === null || muc <= 0) { datLoi(CB.huConThieuMuc); return; }
    dangGhi.current = true;
    try { datLoi(await p.tao(ten, muc)); } finally { dangGhi.current = false; }
  }
  return (
    <>
      <TamDau icon={<PixelIcon name="target" size={32} />} ten={CB.huThemCon.toUpperCase()} tag={`${CB.huConCuaPre}${p.cha.ten.toUpperCase()}`} />
      <p className={hb.tieuLop}>{CB.huConTenHoi}</p>
      <input
        className={hb.oGo} maxLength={40} data-testid="con-ten" placeholder={CB.huConTenGiuCho}
        value={ten} onChange={(e) => { datTen(e.target.value); datLoi(null); }}
      />
      <p className={hb.tieuLop}>{CB.huConMucHoi}</p>
      <OMuc muc={muc} datMuc={(v) => { datMuc(v); datLoi(null); }} />
      {p.conNhan !== null && <p className={hb.ghiPhu}>{`${CB.huConNhanPre}${dinhDangDong(Math.max(0, p.conNhan))}${CHU_MAN_SO.hauDong}`}</p>}
      {loi !== null && <p className={hb.ghiPhu} role="alert">{loi}</p>}
      <NutChinh dau="con-tao" onChon={() => void tao()}>{CB.huConTaoNut}</NutChinh>
    </>
  );
}

/* ═══ DANH MỤC — tháng này là MỘT danh mục; tổng "đang gom" vẫn suy từ chính các hũ ════════════════ */

function KhoiDanhMuc({ dm, thang, tongGop, tongMuc }: {
  dm: DanhMuc; thang: string; tongGop: number; tongMuc: number;
}): React.ReactElement {
  /*
   * 13/09 — hai câu giải thích của màn (số này cộng từ đâu · góp tiền ở đâu) lên nút (?) cạnh con
   * số — founder: *"chữ thì chỉ dành cho bách khoa toàn thư"*. Bản 2 thêm câu "cỡ tính ra sao" vào cùng nút ấy.
   */
  const [moGiai, datMoGiai] = useState(false);
  /* ⚠ Thanh chia đọc CỜ `camKet` của lõi (một chỗ quyết) — không tự lọc lại theo `co !== null`. */
  const coCo = dm.dong.filter((d) => d.camKet);
  /*
   * ⚠ THANH CHIA DÒNG TIỀN: mỗi vị thế có cỡ một khúc (màu xoay vòng theo thứ tự cỡ), phần còn lại là "chưa cam
   *   kết". Cam kết vượt dòng tiền ⇒ thanh co về tổng cam kết (khúc cuối đánh dấu vượt) — TẢ, không tô đỏ (A10).
   */
  const tongPhan = dm.daCamKet ?? 0;
  const thuoc = Math.max(1, tongPhan);
  const cau = dm.cau;
  /*
   * ⭐ D453 — CHƯA VỊ THẾ NÀO CÓ CỠ ⇒ khối co về MỘT HÀNG "đang gom X / Y" (+ nút ?). Đo 0.0.51: khối cao 174px chỉ để nói
   *   "chưa vị thế nào có kỳ hạn" — một câu mà mỗi lá hũ nay tự nói bằng nút ĐẶT HẠN ngay trên nó.
   */
  if (coCo.length === 0 && !cau) {
    return (
      <div className={`${s.khoi2} ${s.danhMuc} ${s.danhMucGon}`} data-testid="danh-muc">
        <div className={`${s.hang2} ${s.hangGom}`}>
          <span className={s.phu2s}>{`${CHU_MAN_HU.dangGom} · ${CV.dmTieuPre}${Number(thang.slice(5, 7))}`}</span>
          <span className={s.so2}>{dinhDangDong(tongGop)}</span>
          <span className={s.phu2s}>{`/ ${dinhDangDong(tongMuc)} đ`}</span>
          <button
            type="button" className={s.hoi} aria-expanded={moGiai} aria-label={CHU_MAN_HU.dangGom}
            onClick={() => datMoGiai((v) => !v)}
          >
            {moGiai ? '✕' : '?'}
          </button>
        </div>
        {moGiai && (
          <p className={s.giai}>
            {`${dm.dong.some((d) => d.co !== null) ? CV.dmChiQuaHan : CV.dmChuaViThe} ${CHU_MAN_HU.chuThichDangGom} `
              + `${CHU_MAN_HU.chuThichManHu} ${CV.dmGiai}`}
          </p>
        )}
      </div>
    );
  }
  return (
    <>
    <div className={`${s.khoi2} ${s.danhMuc}`} data-testid="danh-muc">
      <div className={s.hang2}>
        <span className={s.ten2}>{`${CV.dmTieuPre}${Number(thang.slice(5, 7))}`}</span>
      </div>
      {dm.dongTien ? (
        <div className={s.hang2}>
          <span className={s.phu2s}>{`${CV.dmDongTienPre}${Number(dm.dongTien.thang.slice(5, 7))}`}</span>
          <span className={s.soDongTien}>{dinhDangDong(dm.dongTien.so)}</span>
          <span className={s.phu2s}>đ</span>
        </div>
      ) : (
        <p className={s.chuThich}>{CV.dmChuaDongTien}</p>
      )}

      {coCo.length === 0 ? (
        <p className={s.chuThich}>{dm.dong.some((d) => d.co !== null) ? CV.dmChiQuaHan : CV.dmChuaViThe}</p>
      ) : dm.daCamKet !== null ? (
        <>
          <div className={s.thanhDm} role="img" aria-label={CV.dmTieuPre.trim()}>
            {coCo.map((d, i) => (
              <i
                key={d.hu.id}
                style={{
                  width: `${((d.co!.phan ?? 0) / thuoc) * 100}%`, background: mauKhuc(i),
                  '--i': i,
                } as React.CSSProperties}
              />
            ))}
            {tongPhan < 1 && <i className={s.khucTrong} style={{ width: `${(1 - tongPhan) * 100}%` }} />}
          </div>
          <div className={s.chuGiaiDm}>
            {coCo.map((d, i) => (
              <span key={d.hu.id} className={s.oChuGiai}>
                <b style={{ background: mauKhuc(i) }} />
                {`${d.hu.ten.toUpperCase()} ${phanTram(d.co!.phan ?? 0)}`}
              </span>
            ))}
            <span className={s.oChuGiai}>
              <b className={s.oTrong} />
              {tongPhan <= 1 ? `${CV.dmChuaCamKet} ${phanTram(1 - tongPhan)}` : `${CV.dmVuot} ${phanTram(tongPhan - 1)}`}
            </span>
          </div>
        </>
      ) : null}


      <div className={`${s.hang2} ${s.hangGom}`}>
        <span className={s.phu2s}>{CHU_MAN_HU.dangGom}</span>
        <span className={s.so2}>{dinhDangDong(tongGop)}</span>
        <span className={s.phu2s}>{`/ ${dinhDangDong(tongMuc)} đ`}</span>
        <button
          type="button" className={s.hoi} aria-expanded={moGiai} aria-label={CHU_MAN_HU.dangGom}
          onClick={() => datMoGiai((v) => !v)}
        >
          {moGiai ? '✕' : '?'}
        </button>
      </div>
      {moGiai && (
        <p className={s.giai}>{`${CHU_MAN_HU.chuThichDangGom} ${CHU_MAN_HU.chuThichManHu} ${CV.dmGiai}`}</p>
      )}
    </div>
    {/*
      ⭐ ORACLE nói MỘT câu về hình dạng danh mục — đếm được, không khuyên (A10). Vỏ dùng chung `BongOracle`
      (D365: một nguồn cho mọi chỗ Oracle lên tiếng); chọn câu ở hàm thuần `danhMuc()`, không ở đây.
    */}
    {cau && (
      <div className={s.oracleDm} data-testid="cau-danh-muc">
        <BongOracle
          nhan={CV.oracleTen}
          loi={cau.ma === 'tap_trung'
            ? <><b>{(cau.ten ?? '').toUpperCase()}</b>{`${CV.cauChiemHau}${phanTram(cau.phan ?? 0)}${CV.cauPhanCamKet}`}</>
            : cau.ma === 'vuot_dong_tien'
              ? `${CV.cauVuotPre}${phanTram(cau.phan ?? 0)}${CV.cauVuotHau}`
              : `${CV.cauChuaGiuPre}${cau.soTich ?? 0}${CV.cauChuaGiuHau}`}
        />
      </div>
    )}
    </>
  );
}

/*
 * ⚠ TÊN HŨ: LƯU NGUYÊN CASE NGƯỜI DÙNG GÕ, VIẾT HOA CHỈ LÚC HIỂN THỊ. Demo
 * (`chotTaoHu`) viết hoa NGAY LÚC TẠO (`t.toUpperCase()`) rồi cất luôn bản đã viết
 * hoa — ở đây đổi theo nếp `So.tsx` đã có (`TheHu`: `h.ten.toUpperCase()` chỉ ở JSX,
 * `hu.ts` lưu nguyên văn): một nguồn hiển thị, không phải hai bản case khác nhau của
 * cùng một tên.
 */
function TheHuHang(props: {
  h: Hu; daGop: number; moRa: boolean;
  /** Cỡ vị thế (`null` = chưa đủ điều khoản) · lời đoán còn sống + trạng thái của nó. */
  co: CoViThe | null; ld: LoiDoanHu | null; tt: TrangThaiLoiDoan | null;
  /** Đang cam kết dòng tiền tháng này (cờ của lõi `danhMuc`) — quá kỳ hạn thì cỡ không kèm % dòng tiền. */
  camKet: boolean;
  onToggle: () => void;
  onDoiTT: (den: TrangThaiHu) => void;
  onDanhDauXong: () => void;
  onBoHuNay: () => void;
  onVaoLenh: () => void;
  /** D410 — bản XEM TRƯỚC trong bảng tạo hũ: không nút, không `data-testid` (một lá "thật" duy nhất trên màn). */
  xemTruoc?: boolean;
  /** D426 — đường góp (`duongGopHu`) cho biểu đồ vị thế khi lá mở. Vắng (bản xem trước) ⇒ không biểu đồ. */
  duong?: readonly DiemGop[];
  homNay?: string;
}): React.ReactElement {
  const { h, daGop, moRa, co, ld, tt, camKet, onToggle, onDoiTT, onDanhDauXong, onBoHuNay, onVaoLenh } = props;
  const lenhVe = co !== null ? lenhCua(h) : null;
  const xem = props.xemTruoc === true;
  /* Chiều cao thanh đặt ở `.khoi2` — xem `Hu.module.css` §`--tt-cao`. */

  const p = tienDo(h, daGop);
  const pct = p === null ? 0 : Math.round(p * 100);
  /*
   * ⚠⚠ HŨ ĐẦY = phần trăm hiện tại đạt 100%, KHÔNG PHỤ THUỘC trạng thái quyết toán. Hũ
   * đã `xong` mà đạt đúng mức vẫn mang màu `--win` của `.xong`; riêng quầng+nảy+nhãn
   * "HŨ ĐÃ ĐẦY" (`dangDay`) chỉ dành cho hũ CÒN `dang_chay` — đó là khoảnh khắc đáng ăn
   * mừng (vừa chạm mức, chưa quyết toán); hũ đã đóng thì đã được ăn mừng một lần rồi,
   * nay chỉ còn nằm im ở mục ĐÃ HOÀN THÀNH.
   */
  const hetMuc = p !== null && p >= 1;
  const dangDay = hetMuc && h.trangThai === 'dang_chay';
  const daDong = h.trangThai === 'xong' || h.trangThai === 'bo_do';

  /*
   * ⚠ Nảy CHỈ bắn ở khoảnh khắc VỪA đầy (A11.18) — theo dõi cạnh lên của `dangDay` bằng
   * ref, gỡ lớp `.nay` ở `onAnimationEnd` (không cần hằng thời lượng riêng: reduced-motion
   * tắt animation thì sự kiện không bắn, nhưng khi đó `.nay` cũng không có tác dụng gì).
   */
  const truoc = useRef(dangDay);
  const [vuaDay, datVuaDay] = useState(false);
  useEffect(() => {
    if (dangDay && !truoc.current) datVuaDay(true);
    truoc.current = dangDay;
  }, [dangDay]);

  /*
   * ⚠⚠ SAO = DẤU CỦA NGƯỜI DÙNG, không phải nhãn ưu tiên preset của MẪU. `MAU_HU` đặt
   * sẵn `uuTien` cho một số mẫu (vd "Quỹ dự phòng" → cao) như một phân loại NGỮ NGHĨA —
   * "Không mẫu nào đeo sao" (demo, `moTamHu`) nên sao chỉ hiện khi hũ KHÔNG sinh từ mẫu
   * (`tuMauId===null`) và người dùng tự bật công tắc ưu tiên lúc tạo.
   *
   * ⚠ `=== 'cao'`, KHÔNG PHẢI `!== null`. `MaUuTien` có ba nấc; `'thap'` cũng là "đã đặt
   * ưu tiên" nhưng nó là ưu tiên THẤP — đeo sao cho nó là đọc ngược đúng thứ người dùng
   * vừa nói. Hôm nay form chỉ đặt được `'cao'` nên hai cách viết cho cùng kết quả; ngày
   * form có đủ ba nấc thì `!== null` sẽ sai **im lặng**, và không ai nối được lỗi ấy về
   * đây. Viết đúng ngay từ giờ rẻ hơn.
   */
  // Điều kiện nằm ở `laHuCoSao` (`pfm/hu.ts`) — một cửa với ô Tài chính của Hub; chú thích trên là LÝ DO của nó.
  const daySao = laHuCoSao(h);

  const lop = [
    s.khoi2,
    s.laViThe,
    hetMuc ? s.xong : '',
    daDong ? s.roi : '',
    dangDay ? s.huDay : '',
    vuaDay ? s.nay : '',
  ].filter(Boolean).join(' ');

  /* Nhịp: |lệch| < nửa kỳ ⇒ "đúng nhịp"; còn lại làm tròn ra số kỳ (ít nhất 1). */
  const nhip = co?.nhipKy ?? null;
  const chuNhip = nhip === null ? null
    : Math.abs(nhip) < 0.5 ? CV.nhipDung
      : `${nhip < 0 ? CV.nhipChamPre : CV.nhipNhanhPre}${Math.max(1, Math.round(Math.abs(nhip)))}${CV.kyHau}`;
  const coLenhSong = ld !== null;

  return (
    <div
      className={lop} onAnimationEnd={() => datVuaDay(false)}
      data-testid={xem ? undefined : 'la-vi-the'} data-hu={xem ? undefined : h.id}
    >
      {dangDay && <span className={s.quang} aria-hidden="true" />}
      <div className={s.ruot}>
        {!daDong && (
          <span className={s.nhanViThe}>{`${CV.viThePre}${CHU_KIEU_VI_THE[kieuCua(h.loai)]}`}</span>
        )}
        <button
          type="button"
          className={`${s.hang2} ${s.nutReset}`}
          aria-expanded={moRa}
          onClick={onToggle}
          tabIndex={xem ? -1 : undefined}
        >
          <span className={s.ten2}>
            {daySao && <span className={s.sao} role="img" aria-label="ưu tiên" />}
            {/* D410 — biểu tượng của hũ (bộ `ICON_HU`, trước đó không màn nào vẽ). */}
            <PixelIcon name={h.icon} size={16} className={s.iconLa} />
            {h.ten.toUpperCase()}
          </span>
          <span className={s.pill} data-tt={h.trangThai}>{CHU_PILL_HU[h.trangThai]}</span>
        </button>

        <ThanhTienDo
          pct={pct}
          nhan={`${h.ten}: ${p === null ? CHU_MAN_HU.chuaDatMuc : `${pct}%`}`}
        />

        <div className={s.hang2}>
          <span className={s.phu2s}>{CHU_MAN_HU.daGop}</span>
          <span className={s.pctHu}>{p === null ? '—' : `${pct}%`}</span>
          <span className={s.so2}>{dinhDangDong(daGop)}</span>
          <span className={s.phu2s}>
            {`/ ${h.muc !== null ? dinhDangDong(h.muc) : CHU_MAN_HU.chuaDatMuc}`}
          </span>
        </div>

        {!daDong && (co !== null ? (
          <div className={s.dongCo} data-testid={xem ? undefined : 'dong-co'}>
            <span className={s.dauDoan} aria-hidden="true" />
            <span>
              {`${CV.coPre}${camKet && co.phan !== null ? `${phanTram(co.phan)} · ` : ''}`}
              <b className={s.soCo}>{dinhDangDong(co.moiThang)}</b>{`${CV.moiThangHau} · ${dinhDangDong(co.moiNgay)}${CV.moiNgayHau}`}
            </span>
          </div>
        ) : (
          <div className={s.dongCo}>
            <span className={`${s.dauDoan} ${s.dauTat}`} aria-hidden="true" />
            <span className={s.phu2s}>{h.muc === null ? CV.chuaMuc : CV.chuaVaoLenh}</span>
            {/*
              ⭐ D453 — TRẠNG THÁI IN LÊN CHÍNH VẬT, VIỆC NẰM NGAY CẠNH: hũ chưa mức / chưa hạn thì nút ĐẶT nằm trên lá, một
              chạm mở đúng bảng đặt (số để trống — P3). Trước đó dòng chữ "chưa có kỳ hạn" đứng một mình, còn khối DANH MỤC
              phía trên nói lại cùng điều ấy bằng một đoạn văn.
            */}
            {!xem && (h.trangThai === 'dang_chay' || h.trangThai === 'tam_dung') && (
              <button
                type="button" className={s.nutDat} data-testid="dat-han"
                onClick={(e) => { e.stopPropagation(); onVaoLenh(); }}
              >
                {h.muc === null ? CV.datMucNut : CV.datHanNut}
              </button>
            )}
          </div>
        ))}
        {!daDong && co !== null && (
          <div className={s.dongDoan} data-testid={xem ? undefined : 'dong-loi-doan'}>
            <span>
              {co.conNgay >= 0 ? `${CV.conPre}${co.conNgay}${CV.ngayHau}` : `${CV.quaHanPre}${-co.conNgay}${CV.ngayHau}`}
              {chuNhip !== null ? ` · ${chuNhip}` : ''}
              {ld !== null && tt === 'cho_hoi' ? ` · ${CV.choKetToanPre}${Number(ld.han.slice(5, 7))}` : ''}
            </span>
            {ld !== null && <span className={s.chipChac}>{`${CV.chacPre}${PFM.VI_THE_CHAC[ld.chac]}%`}</span>}
          </div>
        )}

        {/* D420 — quy tắc tự chia của hũ: người dùng tự đặt, lá nói ra đúng số ấy. */}
        {!daDong && h.tuDong !== undefined && (
          <div className={`${s.dongCo} ${s.dongTuDong}`} data-testid={xem ? undefined : 'dong-tu-dong'}>
            <span className={`${s.dauDoan} ${s.dauTuDong}`} aria-hidden="true" />
            <span>{`${CP.laTuDongPre}${nhanTuDong(h.tuDong)}`}</span>
          </div>
        )}

        {dangDay && <span className={s.nhanDay}>{`✓ ${CHU_MAN_HU.huDaDay}`}</span>}

        {moRa && !xem && (
          <>
            {/*
              ⭐ D426 — BIỂU ĐỒ VỊ THẾ (founder: *"ko chỉ gương mà còn là theo hướng dữ liệu mới ta có"*): đường KẾ HOẠCH
              (0 lúc vào lệnh → mức lúc tới hạn) và đường THỰC GÓP. Chỉ hũ đang có cỡ (mức + kỳ hạn); chữ "đúng nhịp /
              chậm N kỳ" ở trên giờ nhìn thấy được.
            */}
            {!daDong && lenhVe !== null && h.muc !== null && props.duong !== undefined && props.homNay !== undefined && (
              <BieuDoViThe muc={h.muc} lenh={lenhVe} duong={props.duong} homNay={props.homNay} />
            )}
            {h.trangThai === 'dang_chay' && (
              <div className={s.nutHang}>
                <button type="button" className={s.nut2} onClick={() => onDoiTT('tam_dung')}>
                  {CHU_NUT_HU.tamDung}
                </button>
                <button type="button" className={`${s.nut2} ${s.chinh}`} onClick={onDanhDauXong}>
                  {CHU_NUT_HU.danhDauXong}
                </button>
              </div>
            )}
            {/*
              ⭐ VÀO LỆNH cho hũ đang chạy chưa có lệnh sống (chưa mức · chưa kỳ hạn · chưa độ chắc) — kể cả hũ mẫu và
              hũ vừa GIA HẠN ở màn SỔ (`So.tsx` §`giaHan` hứa *"mức mới do user đặt ở màn HŨ"*; trước bản 1 không có chỗ ấy).
            */}
            {h.trangThai === 'dang_chay' && !coLenhSong && (
              <div className={s.nutHang}>
                <button type="button" className={`${s.nut2} ${s.vang} ${s.rong100}`} onClick={onVaoLenh}>
                  {CV.vaoLenh}
                </button>
              </div>
            )}
            {h.trangThai === 'tam_dung' && (
              <div className={s.nutHang}>
                <button
                  type="button" className={`${s.nut2} ${s.chinh}`}
                  onClick={() => onDoiTT('dang_chay')}
                >
                  {CHU_NUT_HU.tiepTuc}
                </button>
                <button type="button" className={`${s.nut2} ${s.canh}`} onClick={onBoHuNay}>
                  {CHU_NUT_HU.boHuNay}
                </button>
              </div>
            )}
            {h.trangThai === 'bo_do' && (
              <div className={s.nutHang}>
                <button
                  type="button" className={`${s.nut2} ${s.chinh}`}
                  onClick={() => onDoiTT('dang_chay')}
                >
                  {CHU_NUT_HU.moLai}
                </button>
              </div>
            )}
            {h.trangThai === 'xong' && (
              <p className={s.chuThich}>{CHU_MAN_HU.giaiHuXong}</p>
            )}
            {h.trangThai === 'dang_chay' && hetMuc && (
              <p className={s.chuThich}>{CHU_MAN_HU.giaiDuMuc}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * ⭐ LÁ HŨ TIÊU DÙNG (D421) — không phải vị thế: tên · ĐÃ TIÊU tháng này / mức tháng (D424: tổng đã chia). Hành động theo trạng
 * thái: chạy ⇒ TẠM DỪNG · ĐẶT MỨC THÁNG; dừng ⇒ TIẾP TỤC · BỎ HŨ NÀY; bỏ ⇒ MỞ LẠI. Không "đánh dấu xong", không hộp
 * quyết toán — nấc "gom tới đâu" là outcome của hũ gom tới mức (`hu.ts` §`quyetToan` chặn hũ tiêu dùng).
 * ⚠ Thanh đo tả tiền đã tiêu so với mức người dùng tự đặt; không đổi màu khi vượt (A10 — không phán xét).
 */
function TheHuTieu(props: {
  h: Hu; thang: string; daTieu: number; moRa: boolean;
  onToggle: () => void; onDoiTT: (den: TrangThaiHu) => void; onDatMuc: () => void;
  /** Bản XEM TRƯỚC trong bảng tạo hũ: không nút, không `data-testid`. */
  xemTruoc?: boolean;
}): React.ReactElement {
  const { h, thang, daTieu, moRa, onToggle, onDoiTT, onDatMuc } = props;
  const xem = props.xemTruoc === true;
  const p = tienDo(h, daTieu);
  const pct = p === null ? 0 : Math.round(p * 100);
  const lop = [s.khoi2, s.laViThe, s.laTieu, h.trangThai === 'bo_do' ? s.roi : ''].filter(Boolean).join(' ');
  return (
    <div className={lop} data-testid={xem ? undefined : 'la-tieu-dung'} data-hu={xem ? undefined : h.id}>
      <div className={s.ruot}>
        <span className={`${s.nhanViThe} ${s.nhanTieu}`}>{`${CP.keTieuDungPre}${Number(thang.slice(5, 7))}`}</span>
        <button
          type="button" className={`${s.hang2} ${s.nutReset}`} aria-expanded={moRa} onClick={onToggle}
          tabIndex={xem ? -1 : undefined}
        >
          <span className={s.ten2}>
            <PixelIcon name={h.icon} size={16} className={s.iconLa} />
            {h.ten.toUpperCase()}
          </span>
          <span className={s.pill} data-tt={h.trangThai}>{CHU_PILL_HU[h.trangThai]}</span>
        </button>
        <ThanhTienDo pct={pct} nhan={`${h.ten}: ${p === null ? CHU_MAN_HU.chuaDatMuc : `${pct}%`}`} />
        <div className={s.hang2}>
          <span className={s.phu2s}>{CP.daTieu}</span>
          <span className={s.pctHu}>{p === null ? '—' : `${pct}%`}</span>
          <span className={s.so2} data-testid={xem ? undefined : 'da-tieu'}>{dinhDangDong(daTieu)}</span>
          <span className={s.phu2s}>{`/ ${h.muc !== null ? dinhDangDong(h.muc) : CHU_MAN_HU.chuaDatMuc}`}</span>
        </div>
        {moRa && !xem && (
          <div className={s.nutHang}>
            {h.trangThai === 'dang_chay' && (
              <>
                <button type="button" className={s.nut2} onClick={() => onDoiTT('tam_dung')}>{CHU_NUT_HU.tamDung}</button>
                <button type="button" className={`${s.nut2} ${s.chinh}`} onClick={onDatMuc}>{CP.datMucThang}</button>
              </>
            )}
            {h.trangThai === 'tam_dung' && (
              <>
                <button type="button" className={`${s.nut2} ${s.chinh}`} onClick={() => onDoiTT('dang_chay')}>
                  {CHU_NUT_HU.tiepTuc}
                </button>
                <button type="button" className={`${s.nut2} ${s.canh}`} onClick={() => onDoiTT('bo_do')}>
                  {CHU_NUT_HU.boHuNay}
                </button>
              </>
            )}
            {h.trangThai === 'bo_do' && (
              <button type="button" className={`${s.nut2} ${s.chinh}`} onClick={() => onDoiTT('dang_chay')}>
                {CHU_NUT_HU.moLai}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══ BẢNG VÀO LỆNH — tên là thứ duy nhất bắt buộc; mức + kỳ hạn ⇒ cỡ hiện ngay ═════════════════════ */

/**
 * ⭐ VÀO LỆNH (bản 2) — thay form tạo hũ. Cùng một bảng cho vị thế MỚI (`hu === null`: tên · mức · kỳ hạn · độ chắc ·
 * vì sao · loại · ưu tiên) và vị thế ĐANG CÓ (`hu`: mức · kỳ hạn · độ chắc · vì sao).
 * ⚠ CỠ hiện ngay khi đủ mức + kỳ hạn — cùng MỘT công thức với lá vị thế (`coTuDieuKhoan`): người ta thấy quyết định của
 *   mình bằng đơn vị của chính mình (mỗi tháng · % dòng tiền · mỗi ngày) TRƯỚC khi bấm, đó là cả ý "tư duy đầu tư".
 * ⚠ P3 🔒 — không chip nào sáng sẵn. Chạm lại chip đang chọn là bỏ chọn (cùng nếp lưới nhãn).
 * ⚠ Độ chắc có ô thứ tư BỎ QUA cùng cỡ (D369 §8): bỏ qua là một lựa chọn, không phải một chỗ trống.
 */
function BangLenh(props: {
  hu: Hu | null; ngay: string; dongTien: DongTien | null;
  ten: string; datTen: (v: string) => void; loiTen: boolean;
  loaiChon: MaLoaiHu | null; datLoaiChon: (v: MaLoaiHu | null) => void;
  /* ⚠ Nhận cả `null`: xoá trắng ô gõ phải đưa mức về "chưa đặt", không kẹt ở số cũ. */
  muc: number | null; datMuc: (v: number | null) => void;
  uuTien: boolean; datUuTien: (v: boolean) => void;
  icon: IconHu | null; datIcon: (v: IconHu | null) => void;
  kyHan: string | null; datKyHan: (v: string | null) => void;
  chac: MaChac | 'bo_qua' | null; datChac: (v: MaChac | 'bo_qua' | null) => void; loiChac: boolean;
  viSao: string; datViSao: (v: string) => void;
  tdKieu: 'tat' | KieuTuDong; datTdKieu: (v: 'tat' | KieuTuDong) => void;
  tdGt: number | null; datTdGt: (v: number | null) => void; loiTd: boolean;
  /* D421 — loại hũ (chỉ chọn lúc TẠO; hũ đang có đọc loại từ chính nó). */
  nhomChon: NhomHu | null; datNhomChon: (v: NhomHu | null) => void;
  onHuy: () => void;
}): React.ReactElement {
  const {
    hu, ngay, dongTien, ten, datTen, loiTen, loaiChon, datLoaiChon, muc, datMuc, uuTien, datUuTien,
    icon, datIcon, kyHan, datKyHan, chac, datChac, loiChac, viSao, datViSao, tdKieu, datTdKieu, tdGt, datTdGt, loiTd,
    nhomChon, datNhomChon, onHuy,
  } = props;
  const [moGiaiKhoa, datMoGiaiKhoa] = useState(false);
  const [moGiaiTen, datMoGiaiTen] = useState(false);
  const [ngayKhac, datNgayKhac] = useState(false);
  const dangLoi = loiTen && ten.trim() === '';
  const hanSai = kyHan !== null && !hanHopLe(ngay, kyHan);
  /* D421 — hũ tiêu dùng: chỉ tên · biểu tượng · MỨC THÁNG (để trống được); phần vị thế của bảng không hiện. */
  const tieu = hu !== null ? laTieuDung(hu) : nhomChon === 'tieu_dung';
  const du = !tieu && muc !== null && muc > 0 && kyHan !== null && !hanSai;
  const co = du ? coTuDieuKhoan(muc, { tu: ngay, kyHan }, 0, ngay, dongTien) : null;
  const moi = hu === null;

  /*
   * ⭐ D410 — LÁ ĐANG DỰNG (founder: *"phần tạo hũ … hơi bị basic quá"*). Chính `TheHuHang` — cùng một lá sẽ nằm trong
   * danh sách, không một bản vẽ thứ hai (A11.5) — dựng lại theo từng ô vừa điền: tên, biểu tượng, mức, kỳ hạn ⇒ cỡ,
   * độ chắc ⇒ chip. Điền tới đâu lá thành hình tới đó, như ghép một lá bài.
   * ⚠ Chỉ là HÌNH: dựng bằng `tuTao` trong bộ nhớ, không ghi kho; `tuTao` ném (kỳ hạn sai…) thì không vẽ, không vỡ bảng.
   */
  const xem = useMemo((): Hu | null => {
    if (!moi) return null;
    const tdHopLe = tdKieu !== 'tat' && tdGt !== null && tdGt > 0 && (tdKieu === 'ngay' || tdGt <= 100);
    try {
      const h = tuTao({
        ten: ten.trim() || CV.tenXemTruoc,
        ...(loaiChon !== null ? { loai: loaiChon } : {}),
        ...(muc !== null && muc > 0 ? { muc } : {}),
        ...(uuTien ? { uuTien: 'cao' as const } : {}),
        ...(icon !== null ? { icon } : {}),
        ...(du ? { lenh: { tu: ngay, kyHan: kyHan! } } : {}),
        ...(nhomChon !== null ? { nhom: nhomChon } : {}),
      }, `${ngay}T00:00:00.000Z`, 'xem-truoc');
      return tdHopLe && !tieu ? datTuDong(h, { kieu: tdKieu as KieuTuDong, gt: tdGt as number }, ngay) : h;
    } catch {
      return null;
    }
  }, [moi, ten, loaiChon, muc, uuTien, icon, du, ngay, kyHan, tdKieu, tdGt, nhomChon, tieu]);
  const ldXem: LoiDoanHu | null = xem !== null && du && chac !== null && chac !== 'bo_qua'
    ? { muc: muc!, han: kyHan!, chac, datLuc: `${ngay}T00:00:00.000Z` }
    : null;

  return (
    <div className={`${s.khoi2} ${s.bangLenh} ${s.vaoLoiDoan}`} data-testid="bang-lenh">
      <div className={s.hang2}>
        <span className={`${s.ten2} ${s.tenLenh}`}>
          {moi ? CV.lenhViTheMoi : `${tieu ? CP.lenhTieuPre : CV.lenhTieuPre}${hu.ten.toUpperCase()}`}
        </span>
      </div>

      {/*
        ⭐ D421 — LOẠI HŨ, ô đầu tiên của bảng tạo (founder 26/09: *"hũ chia thành 2 loại là hũ tích lũy và hũ tiêu dùng"*).
        Hai ô to, không ô nào sáng sẵn (P3); chạm lại ô đang sáng là bỏ chọn; không chọn ⇒ tích lũy (không bắt buộc —
        tên vẫn là ô duy nhất bắt buộc). Loại quyết phần còn lại của bảng.
      */}
      {moi && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{CP.nhomHoi}</div>
          <div className={s.luoiNhom} role="group" aria-label={CP.nhomHoi}>
            {(['tich_luy', 'tieu_dung'] as const).map((n) => (
              <button
                key={n} type="button" className={`${s.oNhom} ${nhomChon === n ? s.dangChon : ''}`}
                data-nhom={n} aria-pressed={nhomChon === n}
                onClick={() => { rung(NHIP_RUNG.cham); datNhomChon(nhomChon === n ? null : n); }}
              >
                <b>{n === 'tich_luy' ? CP.nhomTichLuy : CP.nhomTieuDung}</b>
                <span>{n === 'tich_luy' ? CP.nhomTichLuyPhu : CP.nhomTieuDungPhu}</span>
              </button>
            ))}
          </div>
          <p className={s.chuThich}>{CP.nhomGiai}</p>
        </>
      )}

      {moi && xem !== null && (
        /* `inert` + `aria-hidden`: lá xem trước không nhận chạm, không vào thứ tự Tab, trình đọc màn hình bỏ qua. */
        <div className={s.xemTruoc} aria-hidden="true" inert data-testid="la-xem-truoc">
          <span className={s.nhanXemTruoc}>{CV.xemTruoc}</span>
          {tieu ? (
            <TheHuTieu
              xemTruoc h={xem} thang={ngay.slice(0, 7)} daTieu={0} moRa={false}
              onToggle={() => {}} onDoiTT={() => {}} onDatMuc={() => {}}
            />
          ) : (
            <TheHuHang
              xemTruoc h={xem} daGop={0} moRa={false} co={co} camKet ld={ldXem} tt={ldXem !== null ? 'mo' : null}
              onToggle={() => {}} onDoiTT={() => {}} onDanhDauXong={() => {}} onBoHuNay={() => {}} onVaoLenh={() => {}}
            />
          )}
        </div>
      )}

      {moi && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{tieu ? CP.tenHuTieuHoi : CHU_MAN_HU.tenHuHoi}</div>
          <input
            className={`${s.oNhap} ${dangLoi ? s.loi : ''}`}
            maxLength={40}
            placeholder={dangLoi ? CHU_MAN_HU.loiThieuTen : tieu ? CP.tenHuTieuGiuCho : CHU_MAN_HU.tenHuGiuCho}
            value={ten}
            onChange={(e) => datTen(e.target.value)}
          />

          {/* D410 — BIỂU TƯỢNG: bộ `ICON_HU` có sẵn. Chạm lại ô đang chọn là bỏ chọn (cùng nếp lưới nhãn). */}
          <div className={`${s.tieu} ${s.tieuForm}`}>{CV.bieuTuongHoi}</div>
          <div className={s.luoiIcon}>
            {ICON_HU.map((ic) => (
              <button
                key={ic} type="button" className={`${s.oIcon} ${icon === ic ? s.dangChon : ''}`}
                aria-pressed={icon === ic} aria-label={`${CV.bieuTuongHoi} ${ic}`}
                onClick={() => { rung(NHIP_RUNG.cham); datIcon(icon === ic ? null : ic); }}
              >
                <PixelIcon name={ic} size={24} />
              </button>
            ))}
          </div>
        </>
      )}

      <div className={`${s.tieu} ${s.tieuForm}`}>
        {tieu ? CP.mucThangHoi : CHU_MAN_HU.mucMuonGom} <span className={s.phu2s}>{CHU_MAN_HU.deTrongNeuChuaBiet}</span>
      </div>
      {/* Ô gõ số + phím tắt — một bản dùng chung (`OMuc`, lý do ở đó). */}
      <OMuc muc={muc} datMuc={datMuc} />

      {/* D421 — phần VỊ THẾ chỉ cho hũ tích lũy: hũ tiêu dùng đếm theo tháng, không kỳ hạn/độ chắc/quy tắc tự chia. */}
      {!tieu && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>{CV.kyHanHoi}</div>
          <div className={s.luoiHan}>
            {PFM.VI_THE_HAN_THANG.map((n) => {
              const d = hanTuSoThang(ngay, n);
              const dang = !ngayKhac && kyHan === d;
              return (
                <button
                  key={n} type="button" className={`${s.o2} ${dang ? s.dangChon : ''}`} aria-pressed={dang}
                  onClick={() => { rung(NHIP_RUNG.cham); datNgayKhac(false); datKyHan(dang ? null : d); }}
                >
                  {`${n}${CV.thangSau}`}
                </button>
              );
            })}
            <button
              type="button" className={`${s.o2} ${ngayKhac ? s.dangChon : ''}`} aria-pressed={ngayKhac}
              onClick={() => { rung(NHIP_RUNG.cham); datNgayKhac(!ngayKhac); datKyHan(null); }}
            >
              {CV.ngayKhac}
            </button>
          </div>
          {ngayKhac && (
            <input
              type="date" className={s.oNgay} min={congNgay(ngay, PFM.VI_THE_HAN_TOI_THIEU_NGAY)} aria-label={CV.ngayKhac}
              value={kyHan ?? ''} onChange={(e) => datKyHan(e.target.value === '' ? null : e.target.value)}
            />
          )}
          {kyHan !== null && !hanSai && (
            <div className={s.hang2}><span className={s.phu2s}>{`${CV.toiPre}${ngayViet(kyHan, true)}`}</span></div>
          )}
          {hanSai && (
            <p className={s.chuThich} role="alert">
              {`${CV.hanGanQua}${PFM.VI_THE_HAN_TOI_THIEU_NGAY}${CV.hanGanQuaHau}`}
            </p>
          )}

          {co !== null && (
            <div className={s.hopCo} data-testid="hop-co">
              <span className={s.nhanViThe}>{CV.coTieu}</span>
              <div className={s.hangCo}>
                <b className={s.soCoTo}>{dinhDangDong(co.moiThang)}</b><span className={s.phu2s}>{CV.moiThangChu}</span>
              </div>
              <div className={s.hangCo}>
                {co.phan !== null && dongTien !== null ? (
                  <>
                    <b className={s.soCoTo}>{phanTram(co.phan)}</b>
                    <span className={s.phu2s}>{`${CV.phanDongTienGiua}${Number(dongTien.thang.slice(5, 7))}`}</span>
                  </>
                ) : (
                  <span className={s.phu2s}>{CV.coChuaDongTien}</span>
                )}
              </div>
              <div className={s.hangCo}>
                <b className={s.soCoTo}>{dinhDangDong(co.moiNgay)}</b><span className={s.phu2s}>{CV.moiNgayChu}</span>
              </div>
            </div>
          )}

          {du && (
            <>
              <div className={`${s.tieu} ${s.tieuForm} ${s.hangTieu}`}>
                <span>{CV.chacHoi}</span>
                {/* ⚠ Có aria-label riêng: nút neo đáy đã tên "VÀO LỆNH" — hai nút trùng tên là bài test/đọc màn hình lẫn. */}
                <button
                  type="button" className={s.hoi} aria-expanded={moGiaiKhoa} aria-label={CV.chacHoi}
                  onClick={() => datMoGiaiKhoa((v) => !v)}
                >
                  {moGiaiKhoa ? '✕' : '?'}
                </button>
              </div>
              {moGiaiKhoa && <p className={s.giai}>{CV.giaiKhoa}</p>}
              <div className={s.luoiChac}>
                {CHAC.map((c) => (
                  <button
                    key={c} type="button" className={`${s.o2} ${s.chacSo} ${chac === c ? s.dangChon : ''}`}
                    aria-pressed={chac === c}
                    onClick={() => { rung(NHIP_RUNG.cham); datChac(chac === c ? null : c); }}
                  >
                    {`${PFM.VI_THE_CHAC[c]}%`}
                  </button>
                ))}
                <button
                  type="button" className={`${s.o2} ${s.chacSo} ${s.chacBoQua} ${chac === 'bo_qua' ? s.dangChon : ''}`}
                  aria-pressed={chac === 'bo_qua'}
                  onClick={() => { rung(NHIP_RUNG.cham); datChac(chac === 'bo_qua' ? null : 'bo_qua'); }}
                >
                  {CV.boQua}
                </button>
              </div>
              <p className={s.chuThich} role={loiChac ? 'alert' : undefined}>{loiChac ? CV.thieuChac : CV.chacGiai}</p>
              {chac !== null && chac !== 'bo_qua' && (
                <>
                  <div className={`${s.tieu} ${s.tieuForm}`}>{CV.viSaoHoi}</div>
                  <input
                    className={s.oNhap} maxLength={PFM.VI_THE_VI_SAO_CAT} placeholder={CV.viSaoGiuCho}
                    value={viSao} onChange={(e) => datViSao(e.target.value)}
                  />
                </>
              )}
            </>
          )}

          {/*
            ⭐ D420 — TỰ CHIA VÀO HŨ NÀY (founder: *"tự thiết lập số tiền sẽ được chia vào quỹ nào / ngày … chia theo % hoặc
            tiền cố định"*). Người dùng TỰ ĐẶT; app chỉ chạy đúng số ấy (P3). Chip THEO CỠ LÁ chép cỡ/ngày của CHÍNH lá này
            (mức ÷ kỳ hạn), không phải một mức app nghĩ ra. Khớp ⇒ tự chia; thiếu/thừa ⇒ hỏi (`pfm/tu_dong.ts`).
          */}
          <div className={`${s.tieu} ${s.tieuForm}`} data-neo="tu-dong">{CP.tuDongHoi}</div>
          {/* ⚠ P3 🔒 — không chip nào sáng sẵn (kể cả một ô "TẮT"): quy tắc TẮT = không ô nào sáng; chạm lại ô đang sáng là
              tắt (cùng nếp chip kỳ hạn / độ chắc). */}
          <div className={s.luoiTuDong}>
            {(['ngay', 'phan_tram'] as const).map((k) => (
              <button
                key={k} type="button" className={`${s.o2} ${tdKieu === k ? s.dangChon : ''}`} aria-pressed={tdKieu === k}
                onClick={() => { rung(NHIP_RUNG.cham); datTdGt(null); datTdKieu(tdKieu === k ? 'tat' : k); }}
              >
                {k === 'ngay' ? CP.tuDongNgay : CP.tuDongPhanTram}
              </button>
            ))}
          </div>
          {tdKieu !== 'tat' && (
            <>
              <div className={s.hang2}>
                <input
                  className={s.oMuc} inputMode="numeric" maxLength={tdKieu === 'ngay' ? 10 : 3} placeholder="0"
                  aria-label={tdKieu === 'ngay' ? CP.tuDongNgayO : CP.tuDongPhanTramO}
                  value={tdGt === null ? '' : String(tdGt)}
                  onChange={(e) => {
                    const so = e.target.value.replace(/\D/g, '');
                    datTdGt(so === '' ? null : Number(so));
                  }}
                />
                <span className={s.phu2s}>{tdKieu === 'ngay' ? `đ${CP.moiNgayHau}` : CP.phanTramHau}</span>
              </div>
              {tdKieu === 'ngay' && tdGt !== null && tdGt > 0 && (
                <div className={s.hang2}><span className={s.so2}>{dinhDangDong(tdGt)}</span></div>
              )}
              <div className={s.nutHang}>
                {(tdKieu === 'ngay' ? TU_DONG_NGAY_NHANH : TU_DONG_PT_NHANH).map((v) => (
                  <button key={v} type="button" className={s.nut2} onClick={() => { rung(NHIP_RUNG.cham); datTdGt(v); }}>
                    {tdKieu === 'ngay' ? nhanTo(v) : `${v}%`}
                  </button>
                ))}
                {tdKieu === 'ngay' && co !== null && co.moiNgay > 0 && (
                  <button type="button" className={s.nut2} onClick={() => { rung(NHIP_RUNG.cham); datTdGt(co.moiNgay); }}>
                    {`${CP.theoCoPre}${nhanTo(co.moiNgay)}`}
                  </button>
                )}
              </div>
            </>
          )}
          <p className={s.chuThich} role={loiTd ? 'alert' : undefined}>
            {loiTd ? (tdKieu === 'ngay' ? CP.tuDongLoiNgay : CP.tuDongLoiPhanTram) : CP.tuDongGiai}
          </p>
        </>
      )}

      {moi && (
        <>
          <div className={`${s.tieu} ${s.tieuForm}`}>
            {CHU_MAN_HU.chonNhan} <span className={s.phu2s}>{CHU_MAN_HU.boQuaDuoc}</span>
          </div>
          <div className={s.luoiNhan}>
            {LOAI_HU.map((l) => (
              <button
                key={l} type="button"
                className={`${s.o2} ${loaiChon === l ? s.dangChon : ''}`}
                aria-pressed={loaiChon === l}
                /* ⚠ Chạm lại ô đang chọn là BỎ CHỌN. Không có lối ra thì "bỏ qua cũng được"
                   chỉ đúng cho tới cú chạm đầu tiên — sau đó nhãn thành bắt buộc, im lặng. */
                onClick={() => datLoaiChon(loaiChon === l ? null : l)}
              >
                {O_CHU_LOAI_CHI[l]}
              </button>
            ))}
          </div>

          <div className={`${s.tieu} ${s.tieuForm}`}>{CHU_MAN_HU.uuTienHoi}</div>
          <button
            type="button"
            className={`${s.nut2} ${s.rong100} ${uuTien ? s.vang : ''}`}
            onClick={() => datUuTien(!uuTien)}
          >
            {uuTien ? CHU_MAN_HU.uuTienBat : CHU_MAN_HU.uuTienTat}
          </button>
          <p className={s.chuThich}>{CHU_MAN_HU.giaiUuTien}</p>
        </>
      )}

      <div className={s.nutHang}>
        <button type="button" className={`${s.nut2} ${s.rong100}`} onClick={onHuy}>
          {CHU_MAN_HU.huy}
        </button>
      </div>
      {moi && (
        <>
          <div className={`${s.hang2} ${s.hangHoi}`}>
            <span className={s.phu2s}>{CHU_MAN_HU.hoiChiTenBatBuoc}</span>
            <button
              type="button" className={s.hoi} aria-expanded={moGiaiTen}
              onClick={() => datMoGiaiTen((v) => !v)}
            >
              {moGiaiTen ? '✕' : '?'}
            </button>
          </div>
          {moGiaiTen && <p className={s.giai}>{CHU_MAN_HU.giaiChiTenBatBuoc}</p>}
        </>
      )}
    </div>
  );
}

/**
 * Ô GÕ MỨC + phím tắt — MỘT bản cho bảng VÀO LỆNH (tách ra từ form tạo hũ cũ, tệp 15 lát 1).
 * ⚠⚠ Ô GÕ SỐ, KHÔNG CHỈ NÚT CHỌN SẴN. Founder 21/09: *"Mức hũ muốn gom sao lại ko cho t tự nhập tiền à?
 * nhỡ ko có lựa chọn phù hợp thì sao?"* — đúng, và bản cũ còn ngược đúng tinh thần P3: app không được
 * điền số tiền hộ người dùng, mà chỉ đưa vài mức của mình rồi bắt chọn một trong số đó thì cũng là app
 * quyết số. Ô mở đầu TRỐNG; mấy nút tròn hạ xuống làm LỐI TẮT, không phải đường duy nhất.
 * ⚠ Khuôn chép từ `CamKet.tsx` §MỨC (cùng app một kiểu ô tiền), không tự chế.
 */
function OMuc({ muc, datMuc }: { muc: number | null; datMuc: (v: number | null) => void }): React.ReactElement {
  return (
    <>
      <div className={s.hang2}>
        <input
          className={s.oMuc}
          inputMode="numeric"
          maxLength={12}
          placeholder={CHU_MAN_HU.mucOGoi}
          aria-label={CHU_MAN_HU.mucOTen}
          value={muc === null ? '' : String(muc)}
          onChange={(e) => {
            const so = e.target.value.replace(/\D/g, '');
            datMuc(so === '' ? null : Number(so));
          }}
        />
        <span className={s.phu2s}>đ</span>
      </div>
      {/* Đọc lại số vừa gõ có dấu phân nhóm — số tiền không có dấu thì đọc nhầm hàng rất dễ. */}
      {muc !== null && muc > 0 ? (
        <div className={s.hang2}><span className={s.so2}>{dinhDangDong(muc)}</span></div>
      ) : null}
      <div className={s.nutHang}>
        <span className={s.phu2s}>{CHU_MAN_HU.mucNutNhanh}</span>
        {MUC_NHANH.map((v) => (
          <button key={v} type="button" className={s.nut2} onClick={() => datMuc(v)}>
            {`${v / 1_000_000} tr`}
          </button>
        ))}
      </div>
    </>
  );
}

/* ═══ Mẫu có sẵn — một chạm là tạo hũ; KHÔNG mẫu nào đeo sao ═════════════════════════ */

function MauList(
  { maus, onChon }: { maus: readonly MauHu[]; onChon: (m: MauHu) => void },
): React.ReactElement {
  return (
    <div className={s.khoi2}>
      <div className={`${s.tieu} ${s.tieuForm}`}>{CHU_MAN_HU.tuMauTieu}</div>
      {maus.map((m) => (
        <button
          key={m.id} type="button"
          className={`${s.nut2} ${s.rong100} ${s.mauNut}`}
          onClick={() => onChon(m)}
        >
          <span className={s.mauTen}>{m.tenGoiY}</span>
          <span className={`${s.phu2s} ${s.mauViSao}`}>{m.viSao}</span>
        </button>
      ))}
    </div>
  );
}

/* D431 — hộp quyết toán sống ở `QuyetToanHop.tsx`; xuất lại cho mọi chỗ còn nhập nó từ đây. */
export { QuyetToanHop, type DichQuyetToan };
