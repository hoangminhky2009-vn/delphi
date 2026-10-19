/**
 * THẺ KẾT TRẬN — khối "khoe" ở màn kết (17/08, `man-ket-de-khoe.md`).
 *
 * Vẽ thẻ bằng canvas (`lib/the_ket_tran.ts`, hàm thuần) rồi:
 *   · CHIA SẺ  → `navigator.share({files})` nếu máy nhận file (Android/iOS);
 *                không thì `navigator.share({text})`; không nữa thì chép chữ;
 *   · LƯU ẢNH  → `<a download>` từ blob (máy tính).
 * ⚠ Không dịch vụ ảnh ngoài (C1 0đ), không gửi gì lên server: thẻ dựng HOÀN
 * TOÀN trên máy người chơi từ payload màn kết đã có.
 * ⚠ Ảnh chỉ vẽ khi NGƯỜI CHƠI BẤM (không vẽ sẵn lúc mount): canvas 1080×1350
 * trên điện thoại yếu tốn vài trăm ms, mà đa số người sẽ không bấm khoe.
 */
import { useRef, useState } from 'react';
import { useMe } from '@/api/queries';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { chuDan, cuLatLon, veThe, type DuLieuThe } from '@/lib/the_ket_tran';
import s from './TheKetTran.module.css';

/** Hạn dựng ảnh (ms) — quá thì chia sẻ CHỮ, không để nút treo. */
const HAN_VE_MS = 2500;

/**
 * ⚠ `handle` tự đọc từ `/auth/me` NGAY TRONG COMPONENT, không nhận từ màn trận:
 * tường lửa D24 cấm một MÀN import cả ví trận lẫn ví T, mà `useMe` nằm ở
 * `api/queries`. Cùng lối đi của `GheAvatarKet` — gói việc đọc danh tính vào
 * một component thì luật còn nguyên mà thẻ vẫn có tên người.
 */
export function TheKetTran({ du }: { du: Omit<DuLieuThe, 'cuLat' | 'handle'> }) {
  const handle = useMe().data?.user?.handle ?? 'khách';
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [anh, setAnh] = useState<string | null>(null);
  const [chu, setChu] = useState<string | null>(null);
  const [trangThai, setTrangThai] = useState<'im' | 've' | 'chep' | 'loi'>('im');
  const day: DuLieuThe = { ...du, handle, cuLat: cuLatLon(du.duong, du.navDau) };

  /**
   * Vẽ (một lần) rồi trả blob PNG — `null` nếu máy không xuất được canvas.
   *
   * ⚠⚠ HẠN GIỜ LÀ BẮT BUỘC, không phải phòng xa: `toBlob` có thể KHÔNG BAO GIỜ
   * gọi callback (canvas bị chặn, hết bộ nhớ, jsdom) — mà `await` một lời hứa
   * không bao giờ xong thì nút CHIA SẺ đứng ở "ĐANG DỰNG THẺ…" vĩnh viễn, đúng
   * lớp lỗi D57 ("trận trông như chết") ở chỗ tệ nhất: cú bấm khoe duy nhất.
   * Hết hạn ⇒ trả null ⇒ vẫn chia sẻ được CHỮ. Bài test bắt đúng cú treo này.
   */
  const dungAnh = async (): Promise<Blob | null> => {
    const canvas = ref.current ?? document.createElement('canvas');
    try { veThe(canvas, day); } catch { return null; }
    if (!anh) { try { setAnh(canvas.toDataURL('image/png')); } catch { /* canvas không xuất được */ } }
    return new Promise<Blob | null>((ok) => {
      let xong = false;
      const chot = (b: Blob | null) => { if (!xong) { xong = true; ok(b); } };
      const t = setTimeout(() => chot(null), HAN_VE_MS);
      try {
        if (typeof canvas.toBlob !== 'function') { clearTimeout(t); chot(null); return; }
        canvas.toBlob((b) => { clearTimeout(t); chot(b); }, 'image/png');
      } catch { clearTimeout(t); chot(null); }
    });
  };

  const chiaSe = async () => {
    rung(NHIP_RUNG.nang);
    setTrangThai('ve');
    const text = chuDan(day);
    setChu(text);
    try {
      const blob = await dungAnh();
      const nav = navigator as Navigator & {
        canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void>;
      };
      if (blob && typeof nav.share === 'function') {
        const file = new File([blob], 'delphi-ket-tran.png', { type: 'image/png' });
        if (!nav.canShare || nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text, title: 'DELPHI · Đấu trường' });
          setTrangThai('im');
          return;
        }
      }
      if (typeof nav.share === 'function') {
        await nav.share({ text, title: 'DELPHI · Đấu trường' });
        setTrangThai('im');
        return;
      }
      await navigator.clipboard.writeText(text);
      setTrangThai('chep');
    } catch {
      // Người dùng bấm huỷ hộp chia sẻ cũng rơi vào đây — chép chữ là đường lùi
      // im lặng, KHÔNG báo lỗi cho một việc họ vừa tự huỷ.
      try { await navigator.clipboard.writeText(text); setTrangThai('chep'); }
      catch { setTrangThai('loi'); }
    }
  };

  const luuAnh = async () => {
    rung(NHIP_RUNG.cham);
    const blob = await dungAnh();
    if (!blob) { setTrangThai('loi'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'delphi-ket-tran.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className={s.khoi} data-tap="the-ket-tran" aria-label="Thẻ kết trận">
      <header className={s.dau}>
        <span className={s.nhan}>THẺ KẾT TRẬN</span>
        <span className={s.phu}>một tấm để khoe</span>
      </header>
      <canvas ref={ref} className={s.canvas} aria-hidden />
      {anh && <img className={s.xem} src={anh} alt="Xem trước thẻ kết trận" />}
      <div className={s.hang}>
        <button type="button" className={s.nutChinh} onClick={() => void chiaSe()}>
          {trangThai === 've' ? 'ĐANG DỰNG THẺ…' : trangThai === 'chep' ? 'ĐÃ CHÉP CHỮ ✓' : '▶ CHIA SẺ'}
        </button>
        <button type="button" className={s.nutPhu} onClick={() => void luuAnh()}>LƯU ẢNH</button>
      </div>
      {chu && <pre className={s.chuDan}>{chu}</pre>}
      {trangThai === 'loi' && <div className={s.loi} role="alert">Máy này không xuất được ảnh — chép tay đoạn chữ trên nhé.</div>}
    </section>
  );
}
