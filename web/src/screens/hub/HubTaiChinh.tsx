/**
 * Ô TÀI CHÍNH CỦA HUB — chunk NẠP TRỄ (SPEC `ui-tang-khong-gian` 11/10): ruột ô + ruột lớp trượt.
 *
 * ─── LUẬT ────────────────────────────────────────────────────────────────────────────────────────────────────────────
 * · ĐỌC SỔ TRÊN MÁY, KHÔNG REQUEST: số lấy từ kho IndexedDB của chính máy này (`moKhoChung`), không `KhoProvider` (provider
 *   kéo theo hai driver đồng bộ mạng — Hub bị cấm thêm request, C1/C2). Gói PFM chỉ tải khi chunk này tải, không nằm trong gói chính.
 * · NGƯỜI CHƠI TỰ CHỌN nội dung ô (chi hôm nay · hũ ưu tiên · tiền tới ngày); mặc định = hũ ĐEO SAO (`laHuCoSao`), chưa có sao ⇒
 *   chi hôm nay. Chọn ở chính lớp trượt.
 * · CHẠM Ô = lớp trượt GHI THU/CHI — chính `BanTien` của màn SỔ (một đường ghi, D284), giữ luật bàn tiền CỐ ĐỊNH (D410): lớp
 *   không hỏi hũ lúc ghi, không khối nào mọc ra giữa hai cú chạm. Chưa phỏng vấn ⇒ không mời ghi tại đây (phỏng vấn đứng trước).
 * · ĐANG TẢI = chỗ giữ sẵn (gạch + 7 cột mờ) cùng khung với số thật; chưa có sổ ⇒ icon, KHÔNG in số 0 giả (D62).
 */
import { useQuery } from '@tanstack/react-query';
import { useMe } from '@/api/queries';
import { PixelIcon } from '@/components/ui';
import { BanTien } from '@/components/pfm/BanTien';
import { KhoProvider, moKhoChung } from '@/pfm/dung_kho';
import { locKhoanSo, type Khoan } from '@/pfm/so';
import { sapXep, type Hu } from '@/pfm/hu';
import { homNay } from '@/pfm/thoi_gian';
import { daPhongVan } from '@/pfm/da_phong_van';
import { CHE_DO_O_TAI_CHINH, type CheDoOTaiChinh } from '@/lib/hub_che_do';
import { chieuCaoCot, cheDoHienThi, tienGon, tomTatHub, type TomTatHub } from '@/lib/hub_tai_chinh';
import { CHU_CHE_DO_O_TAI_CHINH, CHU_HUB } from '@/lib/hub_chu';
import { DESC_FINANCE, NAME_FINANCE_UPPER, TAGLINE_FINANCE } from '@/lib/vocab';
import { Nac } from './Nac';
import { RuotCho } from './RuotCho';
import { TamDau } from './TamDau';
import o from './HubO.module.css';
import t from './HubTam.module.css';

/**
 * Khoá bắt đầu bằng `['pfm','khoan']` ⇒ một cú GHI khoản (BanTien → `useGhiKho(['khoan'])`) làm ô tươi lại ngay.
 * `staleTime/gcTime: 0` — mỗi lần Hub dựng lại là đọc lại kho (một lượt IndexedDB cục bộ, rẻ): hũ vừa đặt sao ở màn HŨ phải hiện ngay.
 */
export const KHOA_HUB_TOM_TAT = ['pfm', 'khoan', 'hub-tom-tat'] as const;

export function useTomTatHub() {
  // D603 — kho theo tài khoản: biết là ai mới mở được kho; khoá mang `chu` ở CUỐI (giữ tiền tố `['pfm','khoan']`).
  const chu = useMe().data?.user?.user_id ?? null;
  return useQuery<TomTatHub>({
    queryKey: [...KHOA_HUB_TOM_TAT, chu],
    enabled: chu !== null,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      const kho = await moKhoChung(chu!);
      const [k, h] = await Promise.all([kho.liet<Khoan>('khoan'), kho.liet<Hu>('hu')]);
      return tomTatHub(locKhoanSo(k.map((b) => b.d)), sapXep(h.map((b) => b.d)), homNay());
    },
  });
}

const NAC_HU = 8;

/** Chưa có sổ trên máy này (hoặc kho không mở được) ⇒ icon + lời mời ghi; KHÔNG số 0. */
function RuotMoiGhi(): React.ReactElement {
  return (
    <span className={o.iconGiua}>
      <PixelIcon name="vault" size={48} />
      {CHU_HUB.ghiChiTieu}
    </span>
  );
}

export function RuotTaiChinh({ che }: { che: CheDoOTaiChinh | null }): React.ReactElement {
  const q = useTomTatHub();
  if (q.isPending) return <RuotCho />;
  if (q.isError) return <RuotMoiGhi />;
  const tt = q.data;
  if (!tt.coSo && tt.huSao === null) return <RuotMoiGhi />;

  const c = cheDoHienThi(che, tt);
  if (c === 'hu_sao' && tt.huSao !== null) {
    const h = tt.huSao;
    const pct = h.tienDo === null ? null : Math.round(h.tienDo * 100);
    const gop = tienGon(h.daGop);
    return (
      <>
        <span className={o.soTo}>
          {pct === null ? gop.so : pct}<small>{pct === null ? gop.don : '%'}</small>
        </span>
        <span className={o.duoi}>{h.ten}</span>
        <span style={{ marginTop: 'auto' }}>
          {h.tienDo !== null && <Nac day={h.tienDo * NAC_HU} so={NAC_HU} />}
          {h.muc !== null && (
            <span className={o.duoi}>{gop.so}{gop.don} / {tienGon(h.muc).so}{tienGon(h.muc).don}</span>
          )}
        </span>
      </>
    );
  }
  if (c === 'tien_toi_ngay') {
    const x = tt.tienToiNgay;
    if (x === null) {
      return (
        <>
          <span className={`${o.soTo} ${o.cho}`}>—</span>
          <span className={o.duoi}>{CHU_HUB.chuaDuSo}</span>
        </>
      );
    }
    return (
      <>
        <span className={o.soTo}>
          {x.ngayHet === null ? '—' : Number(x.ngayHet.slice(8, 10))}
          {x.ngayHet !== null && <small>/{Number(x.ngayHet.slice(5, 7))}</small>}
        </span>
        <span className={o.duoi}>{CHU_HUB.tienToiNgay}</span>
        <span style={{ marginTop: 'auto' }}><Nac day={x.tyLeDaTieu * NAC_HU} so={NAC_HU} /></span>
      </>
    );
  }
  const g = tienGon(tt.chiHomNay);
  const max = Math.max(...tt.chi7.map((n) => n.chi), 1);
  return (
    <>
      <span className={`${o.soTo} ${o.tien}`}>{g.so}<small>{g.don}</small></span>
      <span className={o.duoi}>{CHU_HUB.chiHomNay}</span>
      <span className={o.cot} aria-hidden="true">
        {tt.chi7.map((n, i) => (
          <span key={n.ngay}><i style={{ height: `${chieuCaoCot(n.chi, max)}%` }} />{i === 6 ? CHU_HUB.nay : n.thu}</span>
        ))}
      </span>
    </>
  );
}

export interface NoiDungTaiChinhProps {
  che: CheDoOTaiChinh | null;
  onChe: (c: CheDoOTaiChinh) => void;
}

/** Ruột lớp trượt: mô tả → chọn nội dung ô → GHI THU/CHI (bàn tiền). Khung + nút MỞ TÀI CHÍNH do Hub dựng. */
export function NoiDungTaiChinh({ che, onChe }: NoiDungTaiChinhProps): React.ReactElement {
  const q = useTomTatHub();
  const chu = useMe().data?.user?.user_id ?? null;
  const tt = q.data;
  const hien = tt === undefined ? null : cheDoHienThi(che, tt);
  const khongCo = (c: CheDoOTaiChinh): boolean => tt === undefined
    || (c === 'hu_sao' && tt.huSao === null) || (c === 'tien_toi_ngay' && tt.tienToiNgay === null);
  return (
    <>
      <TamDau icon={<PixelIcon name="vault" size={32} />} ten={NAME_FINANCE_UPPER} tag={TAGLINE_FINANCE.toUpperCase()} />
      <p className={t.tamMo}>{DESC_FINANCE}</p>
      <div className={t.chiTiet}>
        <p className={t.chonDau}>{CHU_HUB.chonONoiDung}</p>
        <div className={t.chonHang} role="group" aria-label={CHU_HUB.chonONoiDung}>
          {CHE_DO_O_TAI_CHINH.map((c) => (
            <button
              key={c}
              type="button"
              className={t.chon}
              aria-pressed={hien === c}
              disabled={khongCo(c)}
              onClick={() => onChe(c)}
            >
              {CHU_CHE_DO_O_TAI_CHINH[c]}
            </button>
          ))}
        </div>
        <p className={t.chonDau}>{CHU_HUB.ghiNhanh}</p>
        {daPhongVan(chu)
          ? <div className={t.banTien}><KhoProvider><BanTien /></KhoProvider></div>
          : <p className={t.ghiChu}>{CHU_HUB.chuaPhongVan}</p>}
      </div>
    </>
  );
}
