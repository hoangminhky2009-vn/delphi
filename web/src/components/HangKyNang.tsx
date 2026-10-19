/**
 * BA DẤU KỸ NĂNG — MỘT hàng dùng chung cho ba chỗ: dải "GHI VÀO THẺ" ở đáy khối PHONG CÁCH màn
 * kết, dòng chỉ số trên mặt THẺ tính cách, và nắp TRONG TRẬN của Gương.
 *
 * ⚠⚠ VÌ SAO MỘT COMPONENT (founder 13/09: *"chia ra nhiều quá thì thừa thãi và rối"*): trước lượt
 * gộp, cùng ba kỹ năng hiện ở ba chỗ bằng ba hình khác nhau — hàng 469px có ba ô số ở màn kết, thẻ
 * có thanh hai ô ở tab riêng, bốn dòng số ở Gương. Người chơi đọc ba thứ ấy như ba bảng điểm. Nay một
 * kỹ năng chỉ có MỘT hình: ô pixel đổ đầy theo bậc + tên ngắn + chữ bậc.
 *
 * ⚠ Chữ bậc luôn NHÌN THẤY dưới tên — màu ô chỉ nhấn, không bắt người chơi đoán màu nghĩa là gì.
 * ⚠ Cả ô là NÚT (vùng chạm cao ~44px); dấu `!` trong ô là affordance nhìn thấy (founder đã giữ
 *   `!` làm cửa vào chú thích). Chi tiết mở thành MỘT tấm rộng hết hàng dưới ba ô: tấm hẹp trong
 *   cột 1/3 là chữ dọc, đọc không nổi.
 * ⚠ A10: tấm chi tiết chỉ TẢ (câu "Trên đề này…", số bằng chứng, câu ngoài đời, tên khung).
 */
import { useState, type ReactNode } from 'react';
import { NGUONG_NANG_LUC, type BacNangLuc, type NangLucId } from '@config/nang_luc';
import type { NangLucCuaToi, NangLucCuaToiDTO, NangLucTran } from '@server/holdem/nang_luc_ids';
import {
  BAC_NGAN, CHU_NANG_LUC as C, NHAN_BAC, TEN_NANG_LUC, bangChungHien, cauTrenDe, ngayNgan,
} from '@/lib/nang_luc';
import s from './HangKyNang.module.css';

export interface MucKyNang {
  id: NangLucId;
  bac: BacNangLuc;
  chiTiet: ReactNode;
}

/** ID lạ (API mới hơn bundle) ⇒ bỏ qua, không nổ, không hiện ID thô. */
export function laIdKyNang(id: string): id is NangLucId {
  return Object.prototype.hasOwnProperty.call(TEN_NANG_LUC, id);
}

export function HangKyNang({ muc }: { muc: readonly MucKyNang[] }): React.ReactElement | null {
  const [mo, datMo] = useState<NangLucId | null>(null);
  if (muc.length === 0) return null;
  const dangMo = muc.find((m) => m.id === mo);
  return (
    <div className={s.khoi}>
      <ul className={s.hang}>
        {muc.map((m) => {
          const t = TEN_NANG_LUC[m.id];
          const moi = mo === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                className={`${s.dau} ${moi ? s.dauMo : ''}`}
                aria-expanded={moi}
                aria-label={`${C.hoiNhan}: ${t.ngan}, ${BAC_NGAN[m.bac]}`}
                data-testid={`dau-${m.id}`}
                data-bac={m.bac}
                onClick={() => datMo(moi ? null : m.id)}
              >
                <span className={`${s.o} ${s[m.bac] ?? ''}`} aria-hidden />
                <span className={s.chu}>
                  <b className={s.ten}>{t.ngan}</b>
                  <i className={`${s.bac} ${m.bac === 'lam_duoc' || m.bac === 'chung_minh' ? s.bacCo : ''}`}>
                    {BAC_NGAN[m.bac]}
                  </i>
                </span>
                <span className={s.hoi} aria-hidden>{moi ? '✕' : '!'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {dangMo && (
        <div className={s.giai} data-testid="giai-ky-nang">{dangMo.chiTiet}</div>
      )}
    </div>
  );
}

function DongKhung({ id }: { id: NangLucId }): React.ReactElement {
  const t = TEN_NANG_LUC[id];
  return (
    <>
      <p className={s.giaiDong}>{C.ngoaiDoiPre}{t.ngoai_doi}</p>
      <p className={s.khung}>
        {C.khungPre}<b>OECD/INFE</b> {t.khung.oecd}
        {t.khung.gdkt ? <> · <b>GDKT&amp;PL</b> {t.khung.gdkt.replace(/^GDKT&PL /, '')}</> : null}
      </p>
    </>
  );
}

/** Chi tiết của MỘT trận (màn kết): câu "Trên đề này…" + ba ô số bằng chứng + khung. */
export function ChiTietTran({ n }: { n: NangLucTran & { id: NangLucId } }): React.ReactElement {
  const t = TEN_NANG_LUC[n.id];
  return (
    <>
      <p className={s.giaiTen}>{t.ten} · {NHAN_BAC[n.bac].ten}</p>
      <p className={s.giaiDong}>{cauTrenDe(n.id, n)}</p>
      <div className={s.bc}>
        {bangChungHien(n.id, n).map((o) => (
          <div key={o.nhan}><b>{o.so}</b><i>{o.nhan}</i></div>
        ))}
      </div>
      <DongKhung id={n.id} />
    </>
  );
}

/** Chi tiết theo NGƯỜI (mặt THẺ · nắp Gương): mấy đề khác nhau đã làm được + khung. */
export function ChiTietNguoi({ n }: { n: NangLucCuaToi & { id: NangLucId } }): React.ReactElement {
  const t = TEN_NANG_LUC[n.id];
  const D = NGUONG_NANG_LUC.CHUNG_MINH_SO_DE;
  return (
    <>
      <p className={s.giaiTen}>{t.ten} · {NHAN_BAC[n.bac].ten}</p>
      <p className={s.giaiDong}>
        {C.deLamPre}{Math.min(n.so_de_lam_duoc, D)}/{D}{C.deLamHau}
        {n.lan_dau_lam_duoc ? `${C.lanDauPre}${ngayNgan(n.lan_dau_lam_duoc)}` : ''}
      </p>
      {n.bac !== 'chung_minh' && <p className={s.giaiDong}>{C.chungMinhGiai}</p>}
      <DongKhung id={n.id} />
    </>
  );
}

/** Theo NGƯỜI — mặt THẺ và nắp TRONG TRẬN của Gương map cùng MỘT cách (D61: không bản thứ hai). */
/**
 * D426 — MỘT dấu TĨNH (không nút, không tấm chi tiết): cùng ô pixel + tên ngắn + chữ bậc của hàng ba dấu, cho nắp
 * NÓI · LÀM · TRONG TRẬN của Gương — nơi mỗi dấu đứng cạnh con số SỔ của cùng năng lực. Một kỹ năng, MỘT hình ở mọi chỗ
 * (founder 13/09) — nên nó dựng từ đúng các lớp của `HangKyNang`, không vẽ lại.
 */
export function DauKyNangTinh({ id, bac }: { id: NangLucId; bac: BacNangLuc }): React.ReactElement {
  const t = TEN_NANG_LUC[id];
  return (
    <span className={s.dauTinh} data-testid={`dau-tinh-${id}`} data-bac={bac}>
      <span className={`${s.o} ${s[bac] ?? ''}`} aria-hidden />
      <span className={s.chu}>
        <b className={s.ten}>{t.ngan}</b>
        <i className={`${s.bac} ${bac === 'lam_duoc' || bac === 'chung_minh' ? s.bacCo : ''}`}>{BAC_NGAN[bac]}</i>
      </span>
    </span>
  );
}

export function HangKyNangNguoi({ nl }: { nl: NangLucCuaToiDTO }): React.ReactElement | null {
  const muc = nl.nang_luc.filter((n): n is typeof n & { id: NangLucId } => laIdKyNang(n.id));
  return <HangKyNang muc={muc.map((n) => ({ id: n.id, bac: n.bac, chiTiet: <ChiTietNguoi n={n} /> }))} />;
}
