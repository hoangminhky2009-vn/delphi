/**
 * KỲ NGỘ — MÀN CHỌN + CHIP TIẾN ĐỘ (D85/D86 §1, doc 06 §1.4).
 *
 * Hai component, một file, vì chúng là hai KHOẢNH KHẮC của cùng một cơ chế và
 * luôn phải đổi cùng nhau: `KyNgoChon` là lời mời (chỉ ở vòng kỳ ngộ, chỉ khi
 * chưa chốt), `KyNgoChip` là thứ đứng lại suốt phần còn lại của trận.
 *
 * ⚠ MỎNG CÓ CHỦ Ý — mọi câu chữ và tên icon lấy TỪ CATALOG (server), không gõ
 * lại ở đây: bản sao thứ hai của bảng nhiệm vụ sẽ trôi (D61), và cú trôi ở đây
 * là màn chào một nhiệm vụ mà server chấm theo luật khác.
 *
 * ⚠ Không emoji (D47 — màn trận cấm icon do hệ điều hành vẽ). Icon là lưới
 * `PixelIcon` sẵn có: target · chart · bolt · candle (doc 06 §1.5 — dùng lại bộ
 * có sẵn để không đẻ nợ art).
 */
import { useEffect, useState } from 'react';
import type { NhiemVuKyNgoDTO, TienDoKyNgoDTO } from '@/api/holdem';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import { NHIP_RUNG, rung } from '@/lib/rung';
import px from '@/styles/pixel.module.css';
import s from './KyNgo.module.css';

/** Tên icon từ server → lưới pixel. Không khớp thì KHÔNG vẽ icon rỗng. */
const laIcon = (x: string): x is PixelIconName =>
  ['target', 'chart', 'bolt', 'candle'].includes(x);

export function KyNgoChon({
  moi, bang, dangChon, onChon,
}: {
  /** Bộ ĐƯỢC MỜI của vòng này — server rút 3 trong 4, client không tự chọn. */
  moi: string[];
  /** Bảng bốn nhiệm vụ từ catalog. */
  bang: readonly NhiemVuKyNgoDTO[];
  dangChon: string | null;
  onChon: (id: string) => void;
}) {
  const cac = moi
    .map((id) => bang.find((x) => x.id === id))
    .filter((x): x is NhiemVuKyNgoDTO => !!x);
  if (cac.length === 0) return null;

  return (
    <div className={s.khoi} data-tap="ky-ngo">
      <div className={s.dau}>
        <span className={s.nhan}>KỲ NGỘ</span>
        <span className={s.dauPhu}>chọn một con đường cho phần còn lại của trận</span>
      </div>
      <div className={s.dan}>
        {cac.map((nv) => (
          <button
            key={nv.id}
            type="button"
            className={`${s.the} ${dangChon === nv.id ? s.theChon : ''}`}
            aria-pressed={dangChon === nv.id}
            onClick={() => onChon(nv.id)}
          >
            <span className={s.theDau}>
              {laIcon(nv.icon) && <PixelIcon name={nv.icon} size={16} />}
              <b className={s.theTen}>{nv.ten}</b>
            </span>
            <span className={s.theMoTa}>{nv.mo_ta}</span>
            {/*
              Đặc quyền hiện NGAY trên lá, không giấu sau một cú bấm nữa: cú
              chọn này là quyết định của cả nửa trận còn lại, mà chọn mù thì
              không phải là chọn (D25/R1 — thứ quyết định phải hiện lúc quyết).
            */}
            <span className={s.theQua}>
              <span className={s.theQuaTen}>{nv.ten_dac_quyen}</span>
              <span className={s.theQuaMoTa}>{nv.mo_ta_dac_quyen}</span>
            </span>
          </button>
        ))}
      </div>
      {/*
        Nói thẳng luật "không phạt": người chơi phải biết bỏ qua là an toàn,
        nếu không thì cú chọn thành né rủi ro và sập đúng cái đa dạng cần đo
        (doc 06 §1.4).
      */}
      <p className={s.chu}>
        Không hoàn thành thì không mất gì — bỏ qua cũng được.
      </p>
    </div>
  );
}

/**
 * CHIP TIẾN ĐỘ — đứng suốt phần còn lại của trận sau khi đã chọn.
 *
 * Vẽ CẢ HAI vế của điều kiện: tử/mẫu của nhiệm vụ, và vế chống lách (số vòng
 * CÓ vị thế). Giấu vế thứ hai là người chơi đạt đủ "4/4 đúng hướng" mà vẫn
 * không xong, không hiểu vì sao — đúng lớp lỗi "nút sáng mà bấm không ăn".
 */
export function KyNgoChip({
  nv, tienDo, xong, tenDacQuyen,
}: {
  nv: NhiemVuKyNgoDTO | undefined;
  tienDo: TienDoKyNgoDTO | null;
  xong: boolean;
  tenDacQuyen: string | null;
}) {
  if (!nv) return null;
  return (
    <div className={`${s.chip} ${xong ? s.chipXong : ''}`} role="status">
      {laIcon(nv.icon) && <PixelIcon name={nv.icon} size={8} />}
      <span className={s.chipTen}>{nv.ten}</span>
      {xong ? (
        <span className={s.chipQua}>{tenDacQuyen ?? 'ĐẶC QUYỀN'} · ĐANG CÓ</span>
      ) : tienDo ? (
        <>
          <span className={s.chipSo}>{tienDo.dat}/{tienDo.can}</span>
          {/* Vế chống lách chỉ hiện khi CÒN THIẾU — hiện mãi là tiếng ồn nền. */}
          {tienDo.vongCoViThe < tienDo.canCoViThe && (
            <span className={s.chipPhu}>
              cần có vị thế {tienDo.vongCoViThe}/{tienDo.canCoViThe} vòng
            </span>
          )}
        </>
      ) : null}
    </div>
  );
}

/*
 * ═══ 16/08 — KỲ NGỘ LÀ MỘT KHOẢNH KHẮC, KHÔNG PHẢI MỘT PANEL (doc 06 §12) ═══
 * Founder lật v32 rồi hỏi "đã tạo cảm giác CON ĐƯỜNG KHÁC BIỆT chưa" — đo trên
 * stack thật: `KyNgoChon` là panel chữ 410px nằm giữa dòng chảy bàn, ba nút
 * bốn dòng chữ, không dừng gì, không tối gì; chọn xong nhận về một chip 18px.
 * Cơ chế đúng, cảm giác là "một lựa chọn nữa trong shop".
 *
 * Khuôn augment TFT: trận TỐI lại, tên HỒI đang chơi (hồi quyết định bộ mời —
 * §11.7 món 4, người chơi PHẢI thấy nó), ba lá TO, chạm lần một = LẬT ra đặc
 * quyền (`pxLat` sẵn có), chạm lần hai = chọn; BỎ QUA là nút thật. Đồng hồ vòng
 * KHÔNG được nới (D90) — lớp phủ chỉ hiện lại con số của nó.
 * ⚠ Không đổi luật nào: bộ mời/đặc quyền/tiến độ vẫn từ server; đây là trình bày.
 */
export function KyNgoPhu({
  moi, bang, dangChon, onChon, tenHoi, phuHoi, dongHo, onDong,
}: {
  moi: string[];
  bang: readonly NhiemVuKyNgoDTO[];
  dangChon: string | null;
  onChon: (id: string) => void;
  /** Tên hồi đang chơi (client suy từ thông tin công khai — `lib/chuong_hoi`). */
  tenHoi: string;
  phuHoi?: string;
  /** Chữ đồng hồ đang chạy dưới lớp phủ ("CÒN 32s" / "TẠM DỪNG") — chỉ hiện lại. */
  dongHo?: string;
  /** Đóng lớp phủ (đã chọn hoặc BỎ QUA). Lựa chọn nằm ở cha tới lúc CHỐT. */
  onDong: () => void;
}) {
  const cac = moi
    .map((id) => bang.find((x) => x.id === id))
    .filter((x): x is NhiemVuKyNgoDTO => !!x);
  /** Lá đã LẬT (mặt đặc quyền) — chạm lần hai mới chọn. */
  const [lat, setLat] = useState<Set<string>>(() => new Set(dangChon ? [dangChon] : []));
  const [dangLat, setDangLat] = useState<string | null>(null);
  useEffect(() => {
    if (!dangLat) return undefined;
    const t = window.setTimeout(() => setDangLat(null), 320);
    return () => window.clearTimeout(t);
  }, [dangLat]);
  if (cac.length === 0) return null;

  const cham = (id: string) => {
    rung(NHIP_RUNG.cham);
    if (!lat.has(id)) {
      setLat((c) => new Set([...c, id]));
      setDangLat(id);
      return;
    }
    onChon(id);
  };

  return (
    <div className={s.phu} role="dialog" aria-modal="true" aria-label="Kỳ ngộ" data-tap="ky-ngo">
      <div className={s.phuDau}>
        <span className={s.phuNhan}>KỲ NGỘ</span>
        <span className={s.phuHoi}>HỒI · {tenHoi.toUpperCase()}</span>
        {dongHo && <span className={s.phuDongHo}>{dongHo}</span>}
      </div>
      <p className={s.phuChu}>
        {phuHoi ? `${phuHoi} ` : ''}Chọn MỘT con đường cho phần còn lại của trận — chạm lá để lật, chạm lần nữa để đi.
      </p>
      <div className={s.phuDan}>
        {cac.map((nv) => {
          const daLat = lat.has(nv.id);
          const chon = dangChon === nv.id;
          return (
            <button
              key={nv.id}
              type="button"
              className={[
                s.la, daLat ? s.laLat : '', chon ? s.laChon : '',
                dangLat === nv.id ? px.lat : '',
              ].filter(Boolean).join(' ')}
              aria-pressed={chon}
              data-ky-ngo-la={nv.id}
              onClick={() => cham(nv.id)}
            >
              <span className={s.laIcon}>
                {laIcon(nv.icon) && <PixelIcon name={nv.icon} size={40} />}
              </span>
              <b className={s.laTen}>{nv.ten}</b>
              {!daLat ? (
                <span className={s.laMat}>{nv.mo_ta}</span>
              ) : (
                <span className={s.laMat}>
                  <span className={s.laQuaTen}>{nv.ten_dac_quyen}</span>
                  <span className={s.laQuaMoTa}>{nv.mo_ta_dac_quyen}</span>
                </span>
              )}
              <span className={s.laChan}>
                {chon ? 'ĐANG ĐI · chạm để bỏ' : daLat ? 'chạm để ĐI con đường này' : 'chạm để lật'}
              </span>
            </button>
          );
        })}
      </div>
      <div className={s.phuNut}>
        <button type="button" className={`${px.nut} ${px.khung} ${s.nutBoQua}`} onClick={onDong}>
          {dangChon ? 'XONG — về bàn' : 'BỎ QUA · không mất gì'}
        </button>
      </div>
      <p className={s.chu}>Không hoàn thành thì không mất gì. Đường bạn chọn hiện cho người khác SAU khi họ chốt.</p>
    </div>
  );
}

/** Thanh gọn thay panel cũ trên bàn ở vòng kỳ ngộ: một dòng + nút MỞ. */
export function KyNgoThanh({ dangChon, bang, onMo }: {
  dangChon: string | null;
  bang: readonly NhiemVuKyNgoDTO[];
  onMo: () => void;
}) {
  const nv = dangChon ? bang.find((x) => x.id === dangChon) : undefined;
  return (
    <button type="button" className={`${s.thanh} ${nv ? s.thanhChon : ''}`} onClick={onMo} data-tap="ky-ngo-thanh">
      <span className={s.nhan}>KỲ NGỘ</span>
      <span className={s.thanhChu}>
        {nv ? `đang đi ${nv.ten} — chốt vòng để nhận` : 'chưa chọn con đường — mở lại?'}
      </span>
      <span className={s.thanhMo}>MỞ ▸</span>
    </button>
  );
}
