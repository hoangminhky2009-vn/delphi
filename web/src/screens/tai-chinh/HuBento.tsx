/**
 * HŨ TẦNG KHÔNG GIAN — MẶT BENTO của tab HŨ (SPEC `pfm-tang-khong-gian` mục 4.2; demo CHỐT `hu()`): chia tiền tối nay · hũ ưu tiên ·
 * nhóm TIẾT KIỆM · nhóm CHI · danh mục. THUẦN TRÌNH BÀY: số liệu và hành vi do `RuotHu` (Hu.tsx) đưa vào; ở đây không đọc kho, không ghi.
 *
 * ─── HAI LOẠI HŨ, HAI HÌNH (founder 11/10) ──────────────────────────────────────────────────────────────────────────
 * TIẾT KIỆM = BÌNH đứng, mực đầy dần, vạch lời đoán · CHI = PHONG BÌ nằm, mực cạn dần. Cùng một hàm vẽ cho ô ★ (cỡ lớn) và ô nhóm (cỡ nhỏ)
 * — hình của một hũ không bao giờ có hai bản (A11.5). `data-hinh` để bài canh đo; `data-vo-hu`/`data-muc-hu` để `tich_hu.ts` phát hiệu ứng.
 *
 * ⚠ Thiếu mẫu ⇒ "chưa đặt mức" / "—", KHÔNG 0 (D62): hũ chưa mức không vẽ mực, và không có vạch.
 * ⚠ Cạnh `hu_con` chỉ nằm ở máy (`pfm/hu_con.ts`): số "N hũ con" chỉ ĐẾM, không rời máy.
 */
import { OBento, useLunVung } from '@/components/ui/OBento';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { nacCua } from '@/components/pfm/ThanhTienDo';
import { tienGon } from '@/lib/hub_tai_chinh';
import { CHU_BENTO as CB, CHU_LOAI_CHI, CHU_VI_THE as CV } from '@/lib/pfm_chu';
import { PFM } from '@config/pfm';
import type { Hu } from '@/pfm/hu';
import type { CoViThe, LoiDoanHu } from '@/pfm/vi_the';
import { ngayViet } from '@/pfm/thoi_gian';
import b from '@/components/pfm/PfmBento.module.css';
import hb from './HuBento.module.css';

const gon = (n: number): string => { const g = tienGon(n); return g.don === 'đ' ? `${g.so}đ` : `${g.so}${g.don}`; };

/** Một hũ đã được `RuotHu` tính xong số để vẽ lên mặt. */
export interface HuMat {
  h: Hu;
  /** Tiết kiệm: đã góp · chi: đã tiêu tháng này (đồng). */
  so: number;
  /** Phần trăm 0–100 so với mức người dùng tự đặt; `null` = chưa đặt mức (không bịa 0). */
  pct: number | null;
  tieu: boolean;
  /** Dấu sao = ưu tiên của người dùng (`laHuCoSao`). */
  sao: boolean;
  /** Lời đoán còn MỞ (có vạch trên bình). */
  ld: LoiDoanHu | null;
  co: CoViThe | null;
  nCon: number;
  /** Nấc kết quả của kỳ gần nhất (`hu.ketQuaKy`), nếu có. */
  kyTruoc: string | null;
}

/* ═══ HÌNH HŨ ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */

/** BÌNH của hũ tiết kiệm. `nho` = cỡ ô nhóm. Mực dâng theo nấc tiến độ; hũ chưa mức ⇒ bình rỗng, không vạch. */
export function BinhTk({ pct, vach, nho = false }: { pct: number | null; vach: boolean; nho?: boolean }): React.ReactElement {
  const p = pct === null ? 0 : Math.max(0, Math.min(100, pct));
  const tru = nho ? 4 : 6;
  return (
    <span
      className={nho ? hb.binhNho : hb.binh}
      data-hinh="binh" data-vo-hu=""
      style={{ '--fill': `var(${nacCua(Math.round(p)).tok})` } as React.CSSProperties}
    >
      {pct !== null && p >= 100 && <span className={hb.quang} aria-hidden="true" />}
      {pct !== null && (
        <i
          data-muc-hu="" className={b.mocDoc}
          style={{ height: `calc(${p}% - ${tru}px)`, '--j': nho ? 1 : 0 } as React.CSSProperties}
        />
      )}
      {vach && pct !== null && <s className={`${hb.vach} ${b.bat}`} style={{ bottom: `calc(100% - ${nho ? 2 : 3}px)` }} data-vach="" />}
      {!nho && <b>{pct === null ? '—' : `${Math.round(p)}%`}</b>}
    </span>
  );
}

/** PHONG BÌ của hũ chi: mực = phần CÒN LẠI của mức tháng, cạn dần từ phải sang trái. `conLai` null = chưa đặt mức. */
export function PhongBi({ conLai, lon = false }: { conLai: number | null; lon?: boolean }): React.ReactElement {
  const p = conLai === null ? 0 : Math.max(0, Math.min(100, conLai));
  return (
    <span className={`${hb.phongBi} ${lon ? hb.phongBiLon : ''}`} data-hinh="phong-bi" data-truc="x" data-vo-hu="">
      {conLai !== null && (
        <i data-muc-hu="" className={b.mocNgang} style={{ width: `calc(${p}% - 4px)`, '--j': 0 } as React.CSSProperties} />
      )}
    </span>
  );
}

/* ═══ NÚT NHỎ TRONG Ô (tự lo cú lún, không lún ô cha — `useLunVung`) ═══════════════════════════════════════════════════ */

function NutMini({ className, onChon, nhan, children, dau }: {
  className: string; onChon: () => void; nhan: string; children: React.ReactNode; dau?: string;
}): React.ReactElement {
  const { lun, bind } = useLunVung();
  return (
    <button
      type="button" className={className} aria-label={nhan} data-o={dau}
      style={lun ? { transform: 'translate(3px, 3px)', boxShadow: 'none' } : undefined}
      onClick={onChon} {...bind}
    >
      {children}
    </button>
  );
}

/* ═══ MẶT HŨ ════════════════════════════════════════════════════════════════════════════════════════════════════════ */

export interface MatHuProps {
  dangTai: boolean;
  /** Ô ★: hũ ưu tiên (chưa sao ⇒ hũ tiết kiệm đầu tiên). `null` = chưa có hũ nào chạy. */
  chinh: HuMat | null;
  tk: readonly HuMat[];
  chi: readonly HuMat[];
  thang: string;
  /** Ô CHIA TIỀN TỐI NAY. */
  chia: { vi: number; chi: number; coHu: boolean; dangHoi: boolean };
  /** DANH MỤC: đang gom / mức (hũ tiết kiệm). */
  danhMuc: { gom: number; muc: number };
  onChia: () => void;
  onHu: (id: string) => void;
  onNhom: (nhom: 'tich_luy' | 'tieu_dung') => void;
  onTao: (nhom: 'tich_luy' | 'tieu_dung') => void;
  onDanhMuc: () => void;
}

/** Số hũ nhỏ tối đa trên ô nhóm: 3 hũ + nút `+` (bốn cột); hũ thứ 4 trở đi vào lớp NHÓM. */
export const TOI_DA_HU_NHOM = 3;

function DongPhu({ x }: { x: HuMat }): React.ReactElement {
  const { h, ld, co, pct, tieu, kyTruoc } = x;
  if (tieu) {
    return (
      <>
        <span className={`${b.duoi} ${b.mot}`}>
          {h.muc === null ? CB.huChuaMuc : `${CB.huConLaiPre}${gon(Math.max(0, h.muc - x.so))} · ${CB.huThangNay}`}
        </span>
        <span className={`${b.duoi} ${b.mot}`}>{h.muc === null ? CB.huChiChuaMucPhu : `${CB.huDaTieuPre}${gon(x.so)}`}</span>
      </>
    );
  }
  return (
    <>
      <span className={`${b.duoi} ${b.mot}`}>
        {h.loai !== null ? `${CB.huMucTieuPre}${CHU_LOAI_CHI[h.loai].toLowerCase()} · ` : ''}
        {h.lenh !== undefined ? `${CV.toiPre}${ngayViet(h.lenh.kyHan, h.lenh.kyHan.slice(0, 4) !== h.lenh.tu.slice(0, 4))}` : CB.huChuaHan}
      </span>
      <>
        {ld !== null ? (
          <span className={hb.doanDong}>
            <span className={hb.nhanDoan}>{CB.huBanDoan}</span>
            <b>{CB.huDoanDu}</b>
            <span className={b.duoi}>{`· ${CV.chacPre}${PFM.VI_THE_CHAC[ld.chac]}%`}</span>
          </span>
        ) : (
          <span className={`${b.duoi} ${b.mot}`}>{pct === null ? CB.huChuaMuc : CB.huChuaDoan}</span>
        )}
      </>
      <span className={`${b.duoi} ${b.mot} ${hb.duoiBot}`}>
        {co !== null ? `${CB.huQuyRaPre}${gon(co.moiThang)}${CB.huQuyRaHau}` : ' '}
      </span>
      <span className={`${b.duoi} ${b.mot} ${hb.duoiBot}`}>
        {kyTruoc !== null ? `${CB.huKyTruocPre}${kyTruoc}` : ' '}
      </span>
    </>
  );
}

export function MatHu(p: MatHuProps): React.ReactElement {
  const { chinh } = p;
  const them = (n: 'tich_luy' | 'tieu_dung'): React.ReactElement => (
    <NutMini
      className={`${hb.conHu} ${hb.them}`} onChon={() => p.onTao(n)}
      nhan={n === 'tich_luy' ? CB.huTaoTk : CB.huTaoChi} dau={n === 'tich_luy' ? 'hu-tao-tk' : 'hu-tao-chi'}
    >
      +
    </NutMini>
  );
  const nhom = (n: 'tich_luy' | 'tieu_dung', ds: readonly HuMat[], i: number): React.ReactElement => {
    const tk = n === 'tich_luy';
    return (
      <OBento as="div" className={`${b.vao} ${hb.oNhom}`} style={{ '--i': i } as React.CSSProperties} dau={tk ? 'hu-nhom-tk' : 'hu-nhom-chi'}>
        <button
          type="button" className={`${hb.nhomDau} ${b.nhan}`} data-tu-lun="" onClick={() => p.onNhom(n)}
          aria-label={`${CB.huNhomPre}${tk ? CB.huNhomTk : CB.huNhomChi}`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className={b.ten}>{tk ? `${CB.huNhomTk} · ${CB.huNhomTkPhu}` : `${CB.huNhomChi} · ${CB.huNhomChiPhu}`}</span>
          <span className={b.mui} aria-hidden="true">›</span>
        </button>
        <span className={hb.con}>
          {ds.slice(0, TOI_DA_HU_NHOM).map((x) => (
            <NutMini
              key={x.h.id} className={hb.conHu ?? ''} onChon={() => p.onHu(x.h.id)} nhan={`Hũ ${x.h.ten}`} dau="hu-con-hu"
            >
              <span data-hu={x.h.id} style={{ display: 'contents' }}>
                {tk ? <BinhTk pct={x.pct} vach={x.ld !== null} nho /> : <PhongBi conLai={x.pct === null ? null : 100 - x.pct} />}
              </span>
              <span>{x.sao ? '★ ' : ''}{x.h.ten}</span>
              <span className={hb.soCon}>{tk ? gon(x.so) : x.h.muc === null ? '—' : `${CB.huConLaiPre}${gon(Math.max(0, x.h.muc - x.so))}`}</span>
              <span className={hb.dauCon}>{x.nCon > 0 ? `${x.nCon}${CB.huConHau}` : ' '}</span>
            </NutMini>
          ))}
          {them(n)}
        </span>
      </OBento>
    );
  };

  return (
    <div className={b.trang} data-testid="hu-bento">
      <OBento
        className={`${b.vao} ${hb.oChia}`} style={{ '--i': 0 } as React.CSSProperties} dau="hu-chia"
        nhan={CB.huChiaTen} onChon={p.onChia}
      >
        <PixelIcon name="coin" size={24} />
        <span className={hb.giua}>
          <span className={b.nhan}>
            <span className={b.ten}>{CB.huChiaTen}</span>
            {p.chia.dangHoi && <span className={hb.chipHoi} data-testid="hu-chia-hoi">{CB.huChiaHoi}</span>}
          </span>
          <span className={`${b.duoi} ${b.mot}`} data-testid="hu-chia-tong">
            {p.dangTai ? CB.dangTai : !p.chia.coHu ? CB.huChiaChuaCo
              : p.chia.vi > 0 ? <><b className={b.vang}>{gon(p.chia.vi)}</b>{CB.huChiaChua}</>
                : p.chia.chi > 0 ? <><b className={b.vang}>{gon(p.chia.chi)}</b>{CB.huChiaChiChua}</>
                  : CB.huChiaHet}
          </span>
        </span>
        <span className={b.mui} aria-hidden="true" style={{ color: 'var(--accent-bright)' }}>›</span>
      </OBento>

      {chinh === null ? (
        <OBento
          className={`${b.vao} ${hb.oSao}`} style={{ '--i': 1 } as React.CSSProperties} dau="hu-rong"
          nhan={CB.huTaoHu} onChon={() => p.onTao('tich_luy')}
        >
          <span className={hb.ben} style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <PixelIcon name="vault" size={48} />
            <span className={hb.tenLon}>{p.dangTai ? CB.dangTai : CB.huChuaCoHuTen}</span>
            <span className={b.duoi}>{CB.huChuaCoHuMoTa}</span>
          </span>
        </OBento>
      ) : (
        <OBento
          className={`${b.vao} ${hb.oSao}`} style={{ '--i': 1 } as React.CSSProperties} dau="hu-uu-tien"
          nhan={`${chinh.sao ? CB.huUuTien : CB.huHuChinh}: ${chinh.h.ten}`} onChon={() => p.onHu(chinh.h.id)}
        >
          <span data-hu={chinh.h.id} style={{ display: 'contents' }}>
            {chinh.tieu
              ? <PhongBi conLai={chinh.pct === null ? null : 100 - chinh.pct} lon />
              : <BinhTk pct={chinh.pct} vach={chinh.ld !== null} />}
          </span>
          <span className={hb.ben}>
            <span className={b.nhan}>
              <span className={b.ten}>{chinh.sao ? CB.huUuTien : CB.huHuChinh}</span>
              <span className={b.mui} aria-hidden="true">›</span>
            </span>
            <span className={hb.tenLon}>{chinh.h.ten}</span>
            <DongPhu x={chinh} />
            <span className={hb.soHu}>
              {chinh.tieu ? gon(chinh.so) : gon(chinh.so)}
              <small>{chinh.h.muc !== null ? ` / ${gon(chinh.h.muc)}` : ` ${CB.huChuaMuc}`}</small>
            </span>
          </span>
        </OBento>
      )}

      {nhom('tich_luy', p.tk, 2)}
      {nhom('tieu_dung', p.chi, 3)}

      <OBento
        className={`${b.vao} ${hb.oDanhMuc}`} style={{ '--i': 4 } as React.CSSProperties} dau="hu-danh-muc"
        nhan={`${CB.huDanhMucPre}${Number(p.thang.slice(5, 7))}`} onChon={p.onDanhMuc}
      >
        <span className={b.nhan}>
          <span className={b.ten}>
            {`${CB.huDanhMucPre}${Number(p.thang.slice(5, 7))} · ${CB.huDangGom} ${gon(p.danhMuc.gom)} / ${gon(p.danhMuc.muc)}`}
          </span>
          <span className={b.mui} aria-hidden="true">›</span>
        </span>
        <span className={`${b.chuGiai}`}>
          <span><s className={hb.vachMau} />{CB.huGiaiVach}</span>
          <span className={b.mot}>{CB.huGiaiHai}</span>
        </span>
      </OBento>
    </div>
  );
}
