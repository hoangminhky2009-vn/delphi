/**
 * BA CHỖ MỜI CÀI APP ngoài cổng (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 4 + E5–E7, D603 đợt 2):
 *   · `NutCaiDangNhap` — nút cố định ở màn đăng nhập.
 *   · `TheMoiCaiHub`   — thẻ nhắc ở Hub "Cài app để lưu dữ liệu lâu hơn"; ✕ ẩn 7 ngày (E7, localStorage — tiện nghi mỗi máy).
 *   · `BangNhung`      — băng một dòng trên cùng MỌI màn khi mở trong Zalo/FB/Messenger/Instagram/TikTok (không Discord — E5);
 *                        ✕ thu thành chấm nhỏ ở góc tới hết phiên tab (E6); màn bàn đấu luôn là chấm (trả chỗ cho HUD trận).
 * Cả ba ẨN trong bản cài. Một chạm khi trình duyệt cho mời (`moiCai`); không thì ra CỔNG — cổng có hướng dẫn đủ cho từng nền.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { daCai, moiTruongHienTai } from '@/lib/cai_app';
import { CHU_CAI_APP as C } from '@/lib/cai_app_chu';
import { chepLink, doCaiApp, doHien, moiCai, useMoiCai, type NoiMoiCai } from '@/lib/moi_cai';
import { duongCaiApp } from '@/lib/vocab';
import { NeonButton } from './ui';
import s from './MoiCai.module.css';

/** Bấm "cài": một chạm nếu trình duyệt đang giữ lời mời, không thì ra cổng (cổng tự ghi `hien`). */
function useBamCai(noi: NoiMoiCai): () => void {
  const navigate = useNavigate();
  const { coLoiMoi } = useMoiCai();
  return () => {
    if (coLoiMoi) {
      void moiCai(noi).then((kq) => { if (kq === 'khong_co') navigate(duongCaiApp(noi)); });
      return;
    }
    navigate(duongCaiApp(noi));
  };
}

/** Lời mời có nên hiện ở đây không: chưa cài, không trong Discord. */
function nenMoi(): boolean {
  return !daCai() && moiTruongHienTai().cachCai !== 'mo_ngoai_discord';
}

// ─── MÀN ĐĂNG NHẬP ─────────────────────────────────────────────────────────────────────────────────────────────────

export function NutCaiDangNhap(): React.ReactElement | null {
  const bam = useBamCai('dang_nhap');
  const hien = nenMoi();
  useEffect(() => { if (hien) doHien('dang_nhap'); }, [hien]);
  if (!hien) return null;
  return (
    <div className={s.dangNhap}>
      <NeonButton type="button" variant="ghost" block data-nut="cai-app" onClick={bam}>{C.nutDangNhap}</NeonButton>
      <p className={s.dangNhapMo}>{C.nutDangNhapMo}</p>
    </div>
  );
}

// ─── THẺ NHẮC Ở HUB (E7) ───────────────────────────────────────────────────────────────────────────────────────────

export const KHOA_THE_AN = 'delphi:the_cai_app_an_toi';
export const AN_THE_MS = 7 * 24 * 60 * 60 * 1000;

function theDangAn(bayGio: number): boolean {
  try {
    const toi = Number(localStorage.getItem(KHOA_THE_AN) ?? 0);
    return Number.isFinite(toi) && toi > bayGio;
  } catch {
    return false;
  }
}

export function TheMoiCaiHub(): React.ReactElement | null {
  const bam = useBamCai('hub');
  // Trình duyệt nhúng đã có băng ở mọi màn — không nhắc hai lần trên cùng một màn.
  const [an, datAn] = useState(() => !nenMoi() || moiTruongHienTai().nen === 'nhung' || theDangAn(Date.now()));
  useEffect(() => { if (!an) doHien('hub'); }, [an]);
  if (an) return null;
  return (
    <div className={s.the} data-o="the-cai-app">
      <button type="button" className={s.theBam} onClick={bam}>
        <span className={s.theDau} aria-hidden="true">⤓</span>
        <span className={s.theChu}>{C.theHub}</span>
        <span aria-hidden="true">▸</span>
      </button>
      <button
        type="button"
        className={s.dong}
        aria-label={C.theHubDong}
        data-nut="dong-the-cai"
        onClick={() => {
          try { localStorage.setItem(KHOA_THE_AN, String(Date.now() + AN_THE_MS)); } catch { /* chặn lưu trữ thì chỉ ẩn trong lượt này */ }
          doCaiApp('bo', 'hub');
          datAn(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─── BĂNG TRÌNH DUYỆT NHÚNG (E6) ───────────────────────────────────────────────────────────────────────────────────

export const KHOA_BANG_THU = 'delphi:bang_nhung_thu';
/** Chiều cao băng — đi vào `--cao-bang` để mọi màn chừa đúng chỗ (xem `--an-tren` ở `styles/tokens.css`). */
const CAO_BANG = '32px';

function bangDaThu(): boolean {
  try { return sessionStorage.getItem(KHOA_BANG_THU) === '1'; } catch { return false; }
}

export function BangNhung({ thuGon = false }: { thuGon?: boolean }): React.ReactElement | null {
  const mt = moiTruongHienTai();
  const hien = !daCai() && mt.nen === 'nhung' && mt.trinhDuyet !== 'discord';
  const navigate = useNavigate();
  const [thu, datThu] = useState(bangDaThu);
  const [daChep, datDaChep] = useState(false);
  const day = hien && !thu && !thuGon;

  useEffect(() => { if (hien) doHien('bang_nhung'); }, [hien]);
  // Băng nằm đè trên cùng ⇒ báo cho mọi màn chừa đúng chỗ qua `--cao-bang`; thu gọn / gỡ thì trả chỗ.
  useEffect(() => {
    if (!day) return undefined;
    const goc = document.documentElement;
    goc.style.setProperty('--cao-bang', CAO_BANG);
    return () => { goc.style.removeProperty('--cao-bang'); };
  }, [day]);

  if (!hien) return null;
  if (!day) {
    return (
      <button
        type="button"
        className={s.cham}
        aria-label={C.bangMoLai}
        data-o="cham-bang-nhung"
        onClick={() => {
          if (thuGon) { navigate(duongCaiApp('bang_nhung')); return; }
          try { sessionStorage.removeItem(KHOA_BANG_THU); } catch { /* không lưu được thì chỉ mở lại trong lượt này */ }
          datThu(false);
        }}
      />
    );
  }
  return (
    <div className={s.bang} role="region" aria-label={C.bang} data-o="bang-nhung">
      <button type="button" className={s.bangChu} onClick={() => navigate(duongCaiApp('bang_nhung'))}>{C.bang}</button>
      <button
        type="button"
        className={s.bangChep}
        data-nut="chep-link-bang"
        // Chép hỏng (trình duyệt nhúng chặn clipboard) ⇒ ra cổng, nơi link HIỆN bằng chữ để nhấn giữ chép tay.
        onClick={() => { void chepLink('bang_nhung').then((ok) => { if (ok) datDaChep(true); else navigate(duongCaiApp('bang_nhung')); }); }}
      >
        {daChep ? C.daChep : C.chepLink}
      </button>
      <button
        type="button"
        className={s.dong}
        aria-label={C.bangDong}
        data-nut="thu-bang-nhung"
        onClick={() => {
          try { sessionStorage.setItem(KHOA_BANG_THU, '1'); } catch { /* chỉ thu trong lượt này */ }
          doCaiApp('bo', 'bang_nhung');
          datThu(true);
        }}
      >
        ✕
      </button>
    </div>
  );
}
