/**
 * TẤM HƯỚNG — mô hình DEMO BẢN 6 (founder 11/10, câu B; trước đó D453 28/09 *"Học trên quyết định của bạn"*). Hai dải trên MỘT tấm:
 *
 *   APP HỌC ĐƯỢC            — hai dòng nhận định NGẮN, mỗi dòng một phép đếm trên quyết định của chính bạn      ← "app đã thấy bạn làm gì"
 *   HƯỚNG TUẦN TỚI — BẠN CHỌN — ba nút một chạm sinh từ HŨ THẬT: ƯU TIÊN hũ thứ nhất · hũ thứ hai · GIỮ NHƯ CŨ  ← "tuần này bạn đi hướng nào"
 *   (dải TUẦN TRƯỚC           — hướng đã chọn "làm đúng k/n lần" · app đoán về bạn trúng mấy lần · con dấu tuần: GIỮ từ D453)
 *
 * ⚠ Lõi thuần ở `pfm/huong.ts` (HỌC) + `pfm/huong_hu.ts` (phương án · đếm k/n); màn chỉ VẼ và báo lên. Ghi hồ sơ ở `Guong.tsx`.
 * ⚠ Chọn là MỘT cú ghi, KHÔNG chuyển màn (khác D453: "CHỌN" từng mở màn dựng) — nút chọn có dấu ● ngay tại chỗ, như demo.
 * ⚠ A10 🔒 — tả + đếm. Ba nút là danh sách hũ CỦA BẠN theo thứ tự màn HŨ; không nút nào được đánh dấu "nên"; "làm đúng k/n lần" là
 *   phép đếm ngày chia tiền, không điểm, không màu đỏ-xanh (màu phán xét).
 * ⚠ KHÔNG nhãn nguồn dữ liệu trên tấm (SỔ · NÓI): luật "không nói thu dữ liệu từ đâu" áp cả HƯỚNG (founder 11/10) — bài quét ở
 *   `pfm_bento_guong.test.tsx`.
 * ⚠ Màu theo VAI (luật 5 `00-doc-truoc.md`): VÀNG = quyết định / mốc của CHÍNH người dùng · XANH = tiền đã TIÊU · chữ mờ = lời kể.
 * ⚠ Chuyển động (§2.3 `01-vfx-game-feel.md`): dòng vào màn = VẬT LÝ (back-ease-out, so le `--nhip-pfm-led`) · nút lún = NHỊP MÁY
 *   (`steps(2)`). Chỉ `transform`/`opacity`.
 */
import { useRef, type CSSProperties } from 'react';
import type React from 'react';
import { PFM } from '@config/pfm';
import {
  CHU_DIEU_KIEN, CHU_HUONG as H, CHU_KHUNG, CHU_MAN_GUONG as C, CHU_TU_CHAM, CHAN_DUNG_NOI_DUNG,
} from '@/lib/pfm_chu';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { phutHat, tamPhanTu } from '@/lib/hat_pixel';
import { NGAY_CUOI_THANG } from '@/pfm/bieu_do';
import type { Hu } from '@/pfm/hu';
import type { Luat } from '@/pfm/luat';
import { mauTheoDieuKien } from '@/pfm/mau_luat';
import type { HoTro } from '@/pfm/phong_cach';
import type { KyDaCham } from '@/pfm/so_doan';
import type { ThanhTichDoan } from '@/pfm/cham_doan';
import { cuoiTuan, dichCuaLuaChon, lamToi, type DongHoc, type KetQuaHuong, type LuaChonHuong, type MaHuong } from '@/pfm/huong';
import { MA_GIU_NHU_CU, MA_UU_TIEN, type LanLam, type PhuongAnHuong } from '@/pfm/huong_hu';
import { chuLanLam, nhanPhuongAn } from '@/components/pfm/cau_huong';
import { tieuVaLyBuoc } from './DinhHuong';
import g from './Guong.module.css';
import s from './TheHuong.module.css';

/* ═══ tiện ích thuần — XUẤT cho bài test ════════════════════════════════════════════════════════ */

const phay1 = (x: number): string => x.toFixed(1).replace('.', ',');
const ngayNgan = (d: string): string => `${Number(d.slice(8, 10))}/${Number(d.slice(5, 7))}`;
const TAB_KHUNG: Record<string, string> = { hu: 'HŨ', '50_30_20': '50/30/20', kakeibo: 'KAKEIBO' };

/**
 * MỘT dòng học = MỘT CÂU mô tả ngắn (demo: "Tuần nào bạn chia tiền tối, … ."). `so` là đoạn con số nằm TRONG câu (in đậm); `cau` là cả
 * câu. `ho` = họ màu: quyết định (vàng) · tiền tiêu (xanh) · lời kể (mờ).
 * ⚠ Mô tả, không nhân quả: "2/4 lần tiền về, bạn chia vào hũ" — không "nên", không "vì thế".
 */
export function veDongHoc(
  d: DongHoc, hu: readonly Hu[], luat: readonly Luat[],
): { so: string; cau: string; ho: 'quyet' | 'tieu' | 'noi' } {
  const tenHu = (id: string | undefined): string => (hu.find((h) => h.id === id)?.ten ?? '').toUpperCase();
  const kn = `${d.k ?? 0}/${d.n ?? 0}`;
  switch (d.ma) {
    case 'huong_giu': return { so: kn, cau: `${kn} ${H.huongGiu}`, ho: 'quyet' };
    case 'luat_giu': {
      const l = luat.find((x) => x.id === d.luatId);
      const ten = l === undefined ? '' : (mauTheoDieuKien(l.dieuKien)?.ten ?? CHU_DIEU_KIEN[l.dieuKien]);
      return { so: kn, cau: `${kn} ${H.luatGiuPre}"${ten}"`, ho: 'quyet' };
    }
    case 'giu_han': return { so: kn, cau: `${kn} ${H.giuHan}`, ho: 'quyet' };
    case 'vi_the': {
      const t = d.thangDu ?? '';
      const lech = d.lech ?? 0;
      const thang = `T${Number(t.slice(5, 7))}/${t.slice(2, 4)}`;
      return {
        so: thang,
        cau: `${tenHu(d.huId)}${H.viTheGiua}${thang}${H.viTheNeu}${lech > 0 ? H.viTheTrePre : H.viTheSomPre}${Math.abs(lech)}${H.viTheHau}`,
        ho: 'quyet',
      };
    }
    case 'tien_ve_cat': return { so: kn, cau: `${kn} ${H.tienVeCatPre}${PFM.GUONG_CUA_SO_TIEN_VE}${H.tienVeCatHau}`, ho: 'quyet' };
    case 'tien_ve_don': {
      const x = `×${phay1(d.tyLe ?? 1)}`;
      return { so: x, cau: `${PFM.GUONG_CUA_SO_TIEN_VE}${H.tienVeDonGiua}${x}${H.tienVeDonHau}`, ho: 'tieu' };
    }
    case 'cuoi_tuan': {
      const x = `×${phay1(d.tyLe ?? 1)}`;
      return { so: x, cau: `${H.cuoiTuanPre}${x}${H.cuoiTuanHau}`, ho: 'tieu' };
    }
    case 'cuoi_thang': {
      const x = `×${phay1(d.tyLe ?? 1)}`;
      return { so: x, cau: `${NGAY_CUOI_THANG}${H.cuoiThangGiua}${x}${H.cuoiThangHau}`, ho: 'tieu' };
    }
    case 'chua_chia': {
      const p = `${Math.round((d.p ?? 0) * 100)}%`;
      return { so: p, cau: `${p} ${H.chuaChia}`, ho: 'tieu' };
    }
    case 'noi_tien_ve': return { so: '', cau: `${H.noiTienVe}"${d.nhan ?? ''}"`, ho: 'noi' };
    case 'noi_nhip': return { so: '', cau: `${H.noiNhip}"${d.nhan ?? ''}"`, ho: 'noi' };
    case 'noi_dau_thang': return { so: '', cau: `${H.noiDauThang}"${d.nhan ?? ''}"`, ho: 'noi' };
  }
}

/** Tên một hướng CŨ (D453) — câu của bước dựng; CHỌN KHUNG có câu riêng. Chỉ để gọi tên bản ghi đã lưu ở dải TUẦN TRƯỚC. */
export function tenHuongCu(
  ma: MaHuong, dich: NonNullable<ReturnType<typeof dichCuaLuaChon>>, ho: HoTro | null, hu: readonly Hu[],
): { tieu: string; ly: string } {
  if (dich.kieu === 'chon_khung') return { tieu: `${H.chonKhungPre}${TAB_KHUNG[dich.khung] ?? ''}`, ly: CHU_KHUNG[dich.khung] };
  const x: HoTro = ho ?? { ma, dich, ...(dich.kieu === 'lenh_hu' ? { huId: dich.huId } : {}) } as HoTro;
  const { tieu, ly } = tieuVaLyBuoc(x, hu);
  return { tieu, ly };
}

/** Tên một lựa chọn ĐÃ LƯU (mô hình mới hoặc cũ) cho dải TUẦN TRƯỚC. */
export function tenLuaChon(lc: LuaChonHuong, hu: readonly Hu[]): string {
  if (lc.ma === MA_UU_TIEN || lc.ma === MA_GIU_NHU_CU) return nhanPhuongAn({ ma: lc.ma, huId: lc.huId }, hu);
  const dich = dichCuaLuaChon(lc);
  return dich === null ? '' : tenHuongCu(lc.ma, dich, null, hu).tieu;
}

/* ═══ tấm ═════════════════════════════════════════════════════════════════════════════════════ */

export interface ChamTuan {
  /** Trạng thái tuần niêm phong từ máy chủ (`useTrangThaiTuan`). */
  tuanTT: { daNiemPhong: boolean; soNgayCoMat: number; tokenThuong: number } | null;
  dongCham: KyDaCham | null;
  khongCham: boolean;
  thanhTichDoan: ThanhTichDoan;
  anMung: boolean;
}

export function TheHuong(props: {
  /** Tối đa `SO_HOC_TREN_THE` dòng. */
  hoc: readonly DongHoc[];
  /** Hai hũ + GIỮ NHƯ CŨ (`phuongAnTuan`). */
  phuongAn: readonly PhuongAnHuong[];
  dangTheo: LuaChonHuong | null;
  /** "làm đúng k/n lần" của hướng đang theo (chỉ `uu_tien_hu`). */
  lanLam: LanLam | null;
  vuaKhep: { lc: LuaChonHuong; kq: KetQuaHuong; lan: LanLam | null } | null;
  hu: readonly Hu[];
  luat: readonly Luat[];
  cham: ChamTuan;
  onChon: (p: PhuongAnHuong) => void;
}): React.ReactElement {
  const { hoc, phuongAn, dangTheo, lanLam, vuaKhep, hu, luat, cham } = props;
  const coHu = phuongAn.some((p) => p.ma === MA_UU_TIEN);

  function chon(p: PhuongAnHuong, nut: HTMLElement | null): void {
    rung(NHIP_RUNG.nang);
    phutHat(tamPhanTu(nut), 'var(--gold)', 8);
    props.onChon(p);
  }

  return (
    <section className={`${s.the} ${g.khac}`} data-testid="the-huong" aria-label={H.tieu}>
      {/* ── DẢI 1 · APP HỌC ĐƯỢC — hai câu mô tả ngắn ── */}
      <p className={s.muc} style={{ marginTop: 2 }}>{H.hoc}</p>
      {hoc.length === 0
        ? <p className={s.rong} data-testid="hoc-rong">{H.hocRong}</p>
        : hoc.map((d, i) => <DongHocVe key={d.khoa} d={d} i={i} hu={hu} luat={luat} />)}

      {/* ── DẢI 2 · HƯỚNG TUẦN TỚI — BẠN CHỌN: ba nút một chạm ── */}
      <p className={s.muc}>{H.tagChon}</p>
      <div className={s.tuyChon} role="group" aria-label={H.tagChon} data-testid="huong-lua-chon">
        {phuongAn.map((p, i) => (
          <PhimChon
            key={p.khoa} p={p} i={hoc.length + i} dang={dangTheo?.khoa === p.khoa} nhan={nhanPhuongAn(p, hu)} onChon={chon}
          />
        ))}
      </div>
      {dangTheo !== null && chuLanLam(dangTheo, lanLam) !== null && (
        <p className={s.trangThai} data-testid="huong-trang-thai">{chuLanLam(dangTheo, lanLam)}</p>
      )}
      {!coHu && <p className={s.rong} data-testid="huong-chua-co-hu">{H.chuaCoHuTietKiem}</p>}

      {/* ── DẢI 3 · TUẦN TRƯỚC — hướng đã chọn đếm được gì + app tự chấm lời đoán của chính nó ── */}
      <DaiCham vuaKhep={vuaKhep} hu={hu} cham={cham} />
    </section>
  );
}

function DongHocVe({ d, i, hu, luat }: {
  d: DongHoc; i: number; hu: readonly Hu[]; luat: readonly Luat[];
}): React.ReactElement {
  const v = veDongHoc(d, hu, luat);
  /* Con số nằm TRONG câu: tách quanh lần xuất hiện đầu để in đậm mà câu vẫn đọc liền một mạch. */
  const vi = v.so === '' ? -1 : v.cau.indexOf(v.so);
  return (
    <div
      className={`${s.dong} ${v.ho === 'quyet' ? s.hoQuyet : v.ho === 'tieu' ? s.hoTieu : s.hoNoi}`}
      style={{ '--i': i } as CSSProperties} data-testid={`hoc-${d.ma}`}
    >
      <span className={s.cau}>
        {vi < 0 ? v.cau : <>{v.cau.slice(0, vi)}<b className={s.so}>{v.so}</b>{v.cau.slice(vi + v.so.length)}</>}
        {/* Lời kể phỏng vấn về đúng việc con số đếm — dòng phụ, KHÔNG nhãn nguồn. */}
        {d.noiKem !== undefined && <span className={s.noiKem} data-testid="hoc-noi-kem">{`${H.noiKemPre}"${d.noiKem}"`}</span>}
      </span>
    </div>
  );
}

function PhimChon({ p, i, dang, nhan, onChon }: {
  p: PhuongAnHuong; i: number; dang: boolean; nhan: string; onChon: (p: PhuongAnHuong, nut: HTMLElement | null) => void;
}): React.ReactElement {
  const nut = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={nut} type="button" className={`${s.phim} ${g.khac}`} aria-pressed={dang} style={{ '--i': i } as CSSProperties}
      data-testid={`huong-${p.ma === MA_UU_TIEN ? `hu-${p.huId ?? ''}` : p.ma}`} onClick={() => onChon(p, nut.current)}
    >
      <span className={s.nhanPhim}>{nhan}</span>
      <span className={s.chamTron} aria-hidden="true">{dang ? '●' : ''}</span>
    </button>
  );
}

function DaiCham({ vuaKhep, hu, cham }: {
  vuaKhep: { lc: LuaChonHuong; kq: KetQuaHuong; lan: LanLam | null } | null; hu: readonly Hu[]; cham: ChamTuan;
}): React.ReactElement {
  const { tuanTT, dongCham, khongCham, thanhTichDoan, anMung } = cham;
  const coApp = dongCham !== null || thanhTichDoan.trung + thanhTichDoan.trat > 0;
  const trong = vuaKhep === null && !coApp && tuanTT?.daNiemPhong !== true;
  return (
    <div className={s.cham} data-testid="huong-cham">
      <p className={s.muc}>{H.cham}</p>
      {trong && <p className={s.rong}>{H.chamRong}</p>}
      {vuaKhep !== null && (() => {
        const lc = vuaKhep.lc;
        const moi = lc.ma === MA_UU_TIEN || lc.ma === MA_GIU_NHU_CU;
        const toi = lamToi(vuaKhep.kq);
        const lan = chuLanLam(lc, vuaKhep.lan);
        return (
          <div className={s.hangCham} data-testid="cham-huong">
            <span className={s.tenCham}>
              {`${ngayNgan(lc.tuan)}–${ngayNgan(cuoiTuan(lc.tuan))} · ${tenLuaChon(lc, hu)}${lan === null ? '' : ` · ${lan}`}`}
            </span>
            {/* GIỮ NHƯ CŨ không có việc để chấm — không chip. Hướng ưu tiên: chip theo "có ít nhất một ngày hũ ấy nhận tiền". */}
            {lc.ma !== MA_GIU_NHU_CU && (
              <span className={`${s.chip} ${toi ? s.chipToi : ''}`}>
                {!vuaKhep.kq.dung ? (moi ? H.huKhongCon : H.chuaDungChip) : toi ? H.lamToi : H.chuaToi}
              </span>
            )}
          </div>
        );
      })()}
      {coApp && (
        <div className={s.hangCham} data-testid="cham-app">
          <span className={s.tenCham}>{H.appDoan}</span>
          {dongCham !== null && (
            <span className={`${s.chip} ${dongCham.kq === 'trung' ? s.chipToi : ''}`} data-testid="tu-cham">
              {CHU_TU_CHAM[dongCham.kq]}
            </span>
          )}
          {thanhTichDoan.trung + thanhTichDoan.trat > 0 && (
            <span className={s.soApp} data-testid="thanh-tich-doan">
              {`${H.appDungPre}${thanhTichDoan.trung}/${thanhTichDoan.trung + thanhTichDoan.trat}${H.appDungHau}`}
            </span>
          )}
        </div>
      )}
      {dongCham !== null && (
        <p className={s.phuCham}>
          {/* ⚠ `?.` bắt buộc — dòng ĐÃ LƯU chỉ được kiểm HÌNH (`locSoDoan`), mã lạ từ hồ sơ cũ không được sập tấm. */}
          {CHU_TU_CHAM.daDoanPre}{CHAN_DUNG_NOI_DUNG[dongCham.ma]?.doan ?? ''}
          {dongCham.kq === 'chua_du' ? ` ${CHU_TU_CHAM.chuaDuGiai}` : ''}
        </p>
      )}
      {khongCham && <p className={s.phuCham}>{CHU_TU_CHAM.khongChamGiai}</p>}
      {tuanTT?.daNiemPhong === true && (
        <div className={s.hangCham} data-testid="cham-niem-phong">
          <span className={`${g.dau} ${g.khac} ${s.dauNho}`}>{C.dauDaChot}</span>
          <span className={s.soApp}>
            {`${tuanTT.soNgayCoMat}${H.ngayCoGhiHau} · +${tuanTT.tokenThuong}${H.tokenHau}`}
          </span>
          {/* Ô ăn mừng là một VẬT như con dấu bên cạnh — cùng khuôn `.vothay` + khấc của GƯƠNG (§VI), thu cỡ theo hàng. */}
          {anMung && <span className={`${g.vothay} ${g.khac} ${s.voTay}`} aria-hidden="true">{C.anMung}</span>}
        </div>
      )}
    </div>
  );
}
