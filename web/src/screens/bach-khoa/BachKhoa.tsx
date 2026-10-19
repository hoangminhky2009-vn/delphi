/**
 * BÁCH KHOA (D334) — danh sách mục + trang từng mục, một màn, route `/bach-khoa` và `/bach-khoa/:mucId`.
 *
 * Founder 14/09: *"giải thích cơ chế trong game bằng định nghĩa ngoài đời · bố nào muốn chơi pro hoặc không muốn mày
 * mò game có thể đọc bách khoa"* → rồi *"game chưa giải thích rõ chức năng lõi trong game liên quan gì đến ngoài
 * đời"* → rồi *"nhiều phần giải thích đang hơi khó hiểu đối với người bình thường"*. Demo: docs/ui-ux/demo/bach-khoa.html.
 *
 * Học từ bách khoa của game (demo): mục nào cũng ĐỌC ĐƯỢC, lớp CỦA BẠN dày lên theo số lần gặp (Monster Hunter ·
 * Hades) · từ khoá trong câu chạm được (Slay the Spire · Hearthstone) · đếm ĐÃ GẶP (Pokédex) · người chơi kỹ cần số
 * đúng (TFT) — nhưng số ở đây là số của BỘ LUẬT ĐANG CHẠY, đọc từ catalog, không gõ tay.
 *
 * ⚠ Đọc được khi chưa đăng nhập: catalog và sổ tay cần phiên, nên khách thấy trọn phần chữ, còn các khối số / mức /
 * "đã gặp" tự ẩn — không khung rỗng, không đoán (D62).
 * ⚠ Nạp trễ (routes.tsx): ~50 lưới icon + toàn bộ chữ không vào gói của người chỉ đến để chơi.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { useSoTay } from '@/api/tinh_cach';
import { useCatalogBachKhoa, type CatalogBachKhoaDTO } from '@/api/bach_khoa';
import { ScreenFrame } from '@/components/ScreenFrame';
import {
  CHU_MAT_TIEN, DUONG_MAT_TIEN, MUC_BACH_KHOA, MUC_THEO_ID, NGUON_TINH, NHOM_BACH_KHOA, khopTim,
  type MucBK, type NguonSo, type NhomId,
} from '@/lib/bach_khoa';
import { ROUTE_BACH_KHOA, duongBachKhoa } from '@/lib/vocab';
import { IconBK, TrangMuc, lanGap } from './TrangMuc';
import s from './BachKhoa.module.css';

/** Catalog → nguồn số của `%{…}`. Thiếu catalog thì chỉ còn phần tĩnh — mọi dòng số tự ẩn. */
export function dungNguon(cat: CatalogBachKhoaDTO | undefined): NguonSo {
  if (!cat) return { ...NGUON_TINH };
  const ghim: Record<string, string> = {};
  for (const v of Object.values(cat.vai ?? {})) if (v.loi_ghim) ghim[v.loi_ghim] = v.ten;
  return {
    ...NGUON_TINH,
    dq: cat.dac_quyen, gia: cat.gia_bang, luat: cat.luat, vai: cat.vai, mandate: cat.mandate_to_chuc, tk: cat.tiet_kiem, lv: cat.lai_vay_don_bay,
    ddv: cat.da_dang_moi_vong, nhdv: cat.ngan_hang_do_vo,
    ts: Object.fromEntries(cat.tai_san.map((t) => [t.id, t])),
    hang: cat.bach_khoa?.bien_dong_hang, mg: cat.bach_khoa?.minigame,
    kv: Object.fromEntries((cat.khau_vi ?? []).map((k) => [k.id, k])),
    ghim,
  };
}

/*
 * D543 (founder 06/10: *"Phần bách khoa thì nên để phần tra cứu (ô tìm) trên đầu, còn phần cách bạn mất tiền thì cho thành 1 ô ở dưới ô tìm kiếm
 * (mấy ô 'tất cả' 'vai' 'sáu mã' ấy) … có màu vàng sáng ở góc (nếu có những cách mới mà chưa xem)"*) — CÁCH MẤT TIỀN thành một ô LỌC, đứng sau
 * TẤT CẢ. Chấm vàng = có đường trong `DUONG_MAT_TIEN` mà máy này chưa mở ô lọc ấy lần nào kể từ khi đường đó có mặt. Nhớ ở máy (tiện ích của người
 * xem — không phải dữ liệu); hỏng bộ nhớ ⇒ coi như chưa xem (chấm sáng), không vỡ màn.
 */
const KHOA_DA_XEM_MAT_TIEN = 'delphi:bk:mat-tien-da-xem';
function docDaXemMatTien(): ReadonlySet<string> {
  try { return new Set(JSON.parse(window.localStorage.getItem(KHOA_DA_XEM_MAT_TIEN) ?? '[]') as string[]); } catch { return new Set(); }
}
function ghiDaXemMatTien(): void {
  try { window.localStorage.setItem(KHOA_DA_XEM_MAT_TIEN, JSON.stringify(DUONG_MAT_TIEN.map((d) => d.id))); } catch { /* chế độ riêng tư */ }
}

export function DanhSach({ soTay, onMo }: { soTay: ReturnType<typeof useSoTay>['data']; onMo: (id: string) => void }) {
  const [tim, datTim] = useState('');
  const [nhom, datNhom] = useState<NhomId | 'tat_ca' | 'mat_tien'>('tat_ca');
  const [daXem, datDaXem] = useState(docDaXemMatTien);
  const coMoi = DUONG_MAT_TIEN.some((d) => !daXem.has(d.id));
  const chonNhom = (id: NhomId | 'tat_ca' | 'mat_tien') => {
    datNhom(id);
    if (id === 'mat_tien' && coMoi) { ghiDaXemMatTien(); datDaXem(new Set(DUONG_MAT_TIEN.map((d) => d.id))); }
  };
  const doDuoc = MUC_BACH_KHOA.filter((m) => lanGap(m, soTay) !== null);
  const daGap = doDuoc.filter((m) => (lanGap(m, soTay) ?? 0) > 0);

  return (
    <div className={s.danhSach}>
      {soTay && soTay.so_tran > 0 && (
        <div className={s.demGap} data-testid="dem-da-gap">
          ĐÃ GẶP TRÊN BÀN <b>{daGap.length}</b>/{doDuoc.length}
        </div>
      )}
      <label className={s.tim}>
        <span aria-hidden>⌕</span>
        <input
          value={tim}
          onChange={(e) => datTim(e.target.value)}
          placeholder="lãi suất, đòn bẩy, lạm phát…"
          aria-label="Tìm trong bách khoa"
        />
      </label>
      <div className={s.chipNhomHang} role="tablist" aria-label="Nhóm">
        {[['tat_ca', 'TẤT CẢ'] as const, ['mat_tien', 'CÁCH MẤT TIỀN'] as const, ...NHOM_BACH_KHOA].map(([id, ten]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={nhom === id}
            className={`${s.chipNhom} ${nhom === id ? s.chipNhomBat : ''} ${id === 'mat_tien' ? s.chipMatTien : ''}`}
            onClick={() => chonNhom(id)}
            {...(id === 'mat_tien' ? { 'data-testid': 'chip-mat-tien', 'aria-label': coMoi ? 'CÁCH MẤT TIỀN — có cách mới chưa xem' : 'CÁCH MẤT TIỀN' } : {})}
          >{ten}{id === 'mat_tien' && coMoi && <i className={s.chamMoi} aria-hidden data-cham-moi />}</button>
        ))}
      </div>
      {nhom === 'mat_tien' && <CuaMatTien onMo={onMo} />}
      {nhom !== 'mat_tien' && NHOM_BACH_KHOA.filter(([id]) => nhom === 'tat_ca' || nhom === id).map(([id, ten]) => {
        const ds = MUC_BACH_KHOA.filter((m) => m.nhom === id && khopTim(m, tim));
        if (ds.length === 0) return null;
        return (
          <section key={id} className={s.phan} aria-label={ten}>
            <h2 className={s.phanDau}>{ten}</h2>
            <div className={s.luoi}>
              {ds.map((m) => <OMuc key={m.id} m={m} gap={lanGap(m, soTay)} onMo={onMo} />)}
            </div>
          </section>
        );
      })}
      {nhom !== 'mat_tien' && MUC_BACH_KHOA.every((m) => !khopTim(m, tim)) && <p className={s.rong}>Không có mục nào khớp.</p>}
    </div>
  );
}

/**
 * CỬA "CÁCH BẠN MẤT TIỀN" (D352) — mười đường, mỗi đường một dòng chạm được.
 *
 * ⚠ HIỆN VÔ ĐIỀU KIỆN, KHÔNG SAU NGĂN KÉO (D25/R1 + gu founder 13/09: *không giấu chức năng
 * sau ngăn kéo*). Đây đúng là câu người mới muốn hỏi đầu tiên; bắt họ mở một nếp gấp để đọc nó
 * là làm đúng cái lỗi vừa phải sửa.
 * ⚠ KHÔNG lọc theo ô tìm kiếm: nó là một CỬA, không phải một nhóm mục. Gõ tìm là đang tìm trong
 * danh sách bên dưới, và cửa này biến mất giữa chừng thì trông như một lỗi.
 */
export function CuaMatTien({ onMo }: { onMo: (id: string) => void }) {
  return (
    <section className={s.matTien} aria-label={CHU_MAT_TIEN.tieuDe} data-testid="cua-mat-tien">
      <h2 className={s.matTienDau}>{CHU_MAT_TIEN.tieuDe}</h2>
      <p className={s.matTienDan}>{CHU_MAT_TIEN.dan}</p>
      <ol className={s.matTienDs}>
        {DUONG_MAT_TIEN.map((d) => {
          const m = MUC_THEO_ID.get(d.id);
          // Id gõ sai ⇒ bỏ dòng, không dựng nút dẫn vào chỗ trống. Bài canh bắt trước khi tới đây.
          if (!m) return null;
          return (
            <li key={d.id}>
              <button
                type="button"
                className={s.matTienHang}
                onClick={() => onMo(d.id)}
                data-testid={`mat-tien-${d.id}`}
              >
                <span className={s.matTienIcon}><IconBK ten={m.icon} size={16} /></span>
                <span className={s.matTienChu}>
                  <b>{m.ten}</b>
                  {' — '}
                  {d.cau}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function OMuc({ m, gap, onMo }: { m: MucBK; gap: number | null; onMo: (id: string) => void }) {
  const chuaGap = gap === 0;
  return (
    <button type="button" className={`${s.o} ${chuaGap ? s.oChua : ''}`} onClick={() => onMo(m.id)} data-testid={`o-${m.id}`}>
      <span className={s.oDau}>
        <span className={s.oIcon}><IconBK ten={m.icon} size={32} /></span>
        <span className={s.oTen}>{m.ten}<span className={s.oAnh}>{m.anh}</span></span>
      </span>
      <span className={s.oNhac}>{m.nhac}</span>
      {gap !== null && <span className={s.oChan}>{gap > 0 ? `ĐÃ GẶP ×${gap}` : 'CHƯA GẶP TRÊN BÀN'}</span>}
    </button>
  );
}

export function BachKhoa() {
  const { mucId } = useParams();
  const navigate = useNavigate();
  const me = useMe();
  const coPhien = Boolean(me.data?.user);
  const cat = useCatalogBachKhoa(coPhien);
  const soTay = useSoTay(coPhien);
  const nguon = useMemo(() => dungNguon(cat.data), [cat.data]);
  const m = mucId ? MUC_THEO_ID.get(mucId) : undefined;
  const mo = (id: string) => { navigate(duongBachKhoa(id)); window.scrollTo?.(0, 0); };

  return (
    <ScreenFrame title="Bách khoa" live>
      {mucId === undefined && <DanhSach soTay={soTay.data} onMo={mo} />}
      {mucId !== undefined && m && (
        <TrangMuc m={m} cat={cat.data} soTay={soTay.data} nguon={nguon} onMo={mo} onVe={() => navigate(ROUTE_BACH_KHOA)} />
      )}
      {mucId !== undefined && !m && (
        <div className={s.rong}>
          <p>Bách khoa chưa có mục này.</p>
          <button type="button" className={s.lui} onClick={() => navigate(ROUTE_BACH_KHOA)}>‹ BÁCH KHOA</button>
        </div>
      )}
    </ScreenFrame>
  );
}

export default BachKhoa;
