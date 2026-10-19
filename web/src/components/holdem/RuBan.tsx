/**
 * RỦ BẠN CÙNG BÀN — bàn chung theo seed (16/08, đề xuất `moi-ban-vao-doi.md` A,
 * migration 0040). Founder: *"mời bạn kiểu mời vào ĐỘI như TFT — game ít người
 * mà không cho họ mời thì tìm trận đến bao giờ. Cân bằng số người mời."*
 *
 * Cách rẻ và sạch: KHÔNG ghép phòng đồng thời (cả một mùa), mà phát MỘT MÃ ↔
 * (seed, cỡ map). Ai vào mã đó được một trận RIÊNG cùng seed cùng bot; xong thì
 * so NAV trong khối ĐỘI ở màn kết. Không đổi một chip nào của engine (mỗi người
 * một sổ, giá không ảnh hưởng nhau) — "cùng một đề" theo khuôn Wordle.
 * Cân bằng đội: server chặn một tài khoản một trận mỗi bàn (UNIQUE), bàn chung
 * = đấu tự do (D31: rank đòi toàn người thật), hạn 24h, số người khác chỉ lộ
 * SAU khi mình chốt bàn (A3.1).
 *
 * Hai cửa trên cùng một khối: TẠO BÀN (phát mã → chia sẻ/sao chép → vào) và
 * NHẬP MÃ (bạn gửi cho). Link `/arena/ban/<mã>` mở sảnh với mã điền sẵn.
 * ⚠ C4: mã/seed do server phát; client không gõ seed. Không thêm chữ "Earn
 * Token": bàn chung không đẻ T (D95 giữ ranh giới đó).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { linkBan, useTaoBan, useTaoTran, type KhauViDTO } from '@/api/holdem';
import { duongDanTran } from '@/lib/vocab';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { PixelIcon } from '@/components/ui';
import s from './RuBan.module.css';

export function RuBan({ dsCoMap, macDinh, khauVi, maDienSan, onVao, luonMo = false }: {
  dsCoMap: readonly number[];
  /** D300 — cỡ bàn chọn sẵn (catalog `MAP_MAC_DINH_SANH`); vắng ⇒ cỡ đầu danh sách. */
  macDinh?: number;
  khauVi: KhauViDTO['id'];
  /** Mã từ link `/arena/ban/<mã>` — điền sẵn và tự thử vào. */
  maDienSan?: string | undefined;
  /**
   * 16/08 — có phòng chờ: cha mở PHÒNG CHỜ với mã (phòng chờ gọi tạo trận và
   * hiện ĐỘI). Vắng ⇒ tự tạo trận + điều hướng như bản đầu.
   */
  onVao?: ((ma: string) => void) | undefined;
  /**
   * Sảnh bento (11/10): RỦ BẠN là một LỚP TRƯỢT — ruột mở sẵn, không còn nút "RỦ BẠN CÙNG BÀN ▾" để xổ ra (lớp trượt đã là cú chạm
   * mở; thêm một cú nữa là bắt người chơi bấm hai lần cho cùng một việc). Mặc định `false`: chỗ gọi cũ giữ nguyên.
   */
  luonMo?: boolean;
}) {
  const navigate = useNavigate();
  const taoBan = useTaoBan();
  const taoTran = useTaoTran();
  /*
   * ⚠ BẤM ĐÚP KHÔNG GỬI TRÙNG (SPEC 5b.2): `disabled={isPending}` chỉ có hiệu lực SAU lần vẽ lại kế tiếp — hai cú chạm cùng một khung hình
   * (hoặc hai sự kiện liền nhau trước khi React kịp vẽ) vẫn lọt cả hai và phát HAI mã bàn. Cờ ref đóng cửa NGAY trong lần bấm đầu.
   */
  const dangPhat = useRef(false);
  const dangVao = useRef(false);
  const [moNut, setMo] = useState(!!maDienSan);
  const mo = luonMo || moNut;
  const [soO, setSoO] = useState<number>(macDinh ?? dsCoMap[0] ?? 8);
  const [maNhap, setMaNhap] = useState(maDienSan ?? '');
  const [daChep, setDaChep] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  const ma = taoBan.data?.ma ?? null;

  /** Vào bàn theo mã: 201 ⇒ trận mới; 409 `da_vao_ban` ⇒ về trận cũ của mình. */
  const vao = (m: string) => {
    const sach = m.trim().toLowerCase();
    if (!/^[a-z0-9]{5}$/.test(sach)) { setLoi('Mã bàn là 5 ký tự chữ/số.'); return; }
    setLoi(null);
    if (onVao) { onVao(sach); return; }
    if (dangVao.current) return;
    dangVao.current = true;
    taoTran.mutate({ khauVi, banMa: sach }, {
      onSettled: () => { dangVao.current = false; },
      onSuccess: (d) => navigate(duongDanTran(d.match_id)),
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'da_vao_ban') {
          const id = (e as ApiError & { body?: { match_id?: string } }).body?.match_id;
          if (id) { navigate(duongDanTran(id)); return; }
        }
        setLoi(e instanceof ApiError && e.message ? e.message : 'Chưa vào được bàn — thử lại.');
      },
    });
  };

  // Link mời mở thẳng: thử vào một lần khi mount (người được rủ chỉ việc bấm link).
  useEffect(() => {
    if (maDienSan) vao(maDienSan);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maDienSan]);

  const chiaSe = async (m: string) => {
    const url = linkBan(m);
    const text = `Vào bàn ${m.toUpperCase()} chơi cùng tôi — cùng một bàn, xem ai đọc thị trường giỏi hơn.`;
    rung(NHIP_RUNG.cham);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'DELPHI · Bàn chung', text, url });
        return;
      }
    } catch { /* người dùng huỷ share — rơi về sao chép */ }
    await chep(`${text} ${url}`);
  };
  const chep = async (noiDung: string) => {
    try { await navigator.clipboard.writeText(noiDung); setDaChep(true); setTimeout(() => setDaChep(false), 1500); }
    catch { setLoi('Không sao chép được — chép tay mã ở trên.'); }
  };

  return (
    <div className={s.khoi} data-tap="ru-ban">
      {!luonMo && (
      <button type="button" className={`${s.mode} ${mo ? s.modeMo : ''}`} onClick={() => setMo((x) => !x)}>
        <span className={s.tieuDe}>
          <PixelIcon name="arena" size={16} />
          <span>RỦ BẠN CÙNG BÀN {mo ? '▴' : '▾'}</span>
        </span>
        <div className={s.moTa}>
          Cùng một bàn, mỗi người một ghế — không cần online cùng lúc. Xong thì so xem ai đọc thị trường giỏi hơn.
        </div>
      </button>
      )}

      {mo && (
        <div className={luonMo ? `${s.than} ${s.thanTam}` : s.than}>
          {!ma ? (
            <>
              <div className={s.nhan}>TẠO BÀN MỚI</div>
              <div className={s.hangCo}>
                {dsCoMap.map((so) => (
                  <button
                    key={so} type="button"
                    className={`${s.o} ${soO === so ? s.oChon : ''}`}
                    aria-pressed={soO === so}
                    onClick={() => setSoO(so)}
                  >
                    {so} Ô
                  </button>
                ))}
              </div>
              <button
                type="button" className={s.nutChinh}
                disabled={taoBan.isPending}
                onClick={() => {
                  if (dangPhat.current) return;
                  dangPhat.current = true;
                  rung(NHIP_RUNG.nang);
                  taoBan.mutate({ soO }, { onSettled: () => { dangPhat.current = false; } });
                }}
              >
                {taoBan.isPending ? 'ĐANG PHÁT MÃ…' : '▶ PHÁT MÃ BÀN'}
              </button>
            </>
          ) : (
            <>
              <div className={s.nhan}>MÃ BÀN CỦA BẠN · hạn 24 giờ</div>
              <div className={s.maTo} data-ma-ban={ma}>{ma.toUpperCase()}</div>
              <div className={s.hangNut}>
                <button type="button" className={s.nutPhu} onClick={() => void chiaSe(ma)}>
                  CHIA SẺ LINK
                </button>
                <button type="button" className={s.nutPhu} onClick={() => void chep(ma.toUpperCase())}>
                  {daChep ? 'ĐÃ CHÉP ✓' : 'SAO CHÉP MÃ'}
                </button>
              </div>
              <button
                type="button" className={s.nutChinh}
                disabled={taoTran.isPending}
                onClick={() => vao(ma)}
              >
                {taoTran.isPending ? 'ĐANG VÀO…' : '▶ VÀO BÀN NÀY'}
              </button>
              <div className={s.chu}>Bạn bè bấm link (hoặc nhập mã) là được một ghế cùng bàn. Tối đa một trận mỗi người.</div>
            </>
          )}

          <div className={s.vach} />
          <div className={s.nhan}>CÓ MÃ BẠN GỬI?</div>
          <div className={s.hangNhap}>
            <input
              className={s.nhap}
              value={maNhap}
              onChange={(e) => setMaNhap(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 5))}
              placeholder="5 ký tự"
              maxLength={5}
              inputMode="text"
              autoCapitalize="characters"
              aria-label="Mã bàn"
            />
            <button
              type="button" className={s.nutPhu}
              disabled={taoTran.isPending || maNhap.length !== 5}
              onClick={() => vao(maNhap)}
            >
              VÀO
            </button>
          </div>
          {loi && <div className={s.loi} role="alert">{loi}</div>}
        </div>
      )}
    </div>
  );
}
