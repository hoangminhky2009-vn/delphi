/**
 * PHÒNG CHỜ — "tìm trận" cho Đấu trường (16/08). Founder: *"tạo lobby tìm trận ở
 * chế độ rank đi chứ bấm phát vào trận luôn thì hơi không quen"* + *"bàn chung
 * còn là kiểu mời anh em vào tìm trận chung"*.
 *
 * ─── THẬT THÀ VỀ CÁI ĐANG XẢY RA ────────────────────────────────────────────
 * Mùa Beta không có hàng đợi người thật (D31: rank toàn người thật MỞ SAU; nay
 * `rank_pve` đấu máy có điểm). Phòng chờ này là NHỊP TFT — "đang xếp bàn…" rồi
 * từng ghế LỘ MẶT — chứ KHÔNG giả vờ có người đang tới: ghế máy hiện đúng là
 * MÁY (D25/R3, avatar bot + chữ "Máy"), chữ trên màn nói thẳng "mùa Beta ghép
 * với máy". Ba pha:
 *   1. TÌM   — 1,6s "đang xếp bàn", HUỶ được, CHƯA tạo trận (huỷ = không để lại
 *              trận dở nào);
 *   2. LỘ    — gọi POST /matches (server dựng bàn thật), rồi ghế hiện lần lượt
 *              350ms/ghế từ `doi_thu` server trả — số ghế 4–8 là số thật.
 *              Ghế BẠN ngồi sẵn từ giây đầu (TFT: mình đã ở bàn, ghế còn lại
 *              "đang tìm…"); `doi_thu` của server KHÔNG chứa ghế mình.
 *   3. SẴN   — VÀO BÀN (hoặc tự vào sau 3s).
 * BÀN CHUNG (`banMa`): phòng chờ hiện thêm ĐỘI (ai đã vào mã, đang chơi/xong)
 * và nút CHIA SẺ LINK — "mời anh em vào tìm trận chung": mỗi người vẫn một
 * trận riêng cùng seed (doc 08), phòng chờ chỉ cho thấy nhau. Rank_pve KHÔNG
 * ghép đội (D31 — hạng đòi công bằng, mà trong đội thì seed lộ giữa bạn bè).
 * ⚠ C4: phòng chờ không tính gì; nó chỉ gọi đúng cửa tạo trận sẵn có.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { MA_ROI_HANG, roiHangSuat } from '@/api/suatTran';
import {
  linkBan, useBan, useDongYBuoiDo, useTaoTran, type DoiThuDTO, type KhauViDTO,
} from '@/api/holdem';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import { PHIEU_BUOI_DO, linkPhieu } from '@config/buoi_do_form';
import { useMe } from '@/api/queries';
import { CHU_BUOI_DO, CHU_CHE_DO_TESTER, VAN_BAN_BUOI_DO } from '@/lib/buoi_do_chu';
import { nhoTranTap } from '@/lib/man_tap_dau';
import { ghiDiemQuayVe } from '@/lib/diem_quay_ve';
import { duongDanTran } from '@/lib/vocab';
import { NHIP_RUNG, rung } from '@/lib/rung';
import { useReducedMotion } from '@/lib/hooks';
import { GheAvatar, GheAvatarKet } from './BotAvatar';
import s from './PhongCho.module.css';

/** Nhịp phòng chờ (ms) — PLAYTEST-TUNE, một chỗ. */
export const NHIP_PHONG_CHO = { TIM: 1600, MOI_GHE: 350, TU_VAO_S: 3 } as const;

export function PhongCho({ cheDo, soO, khauVi, banMa, epSeed, epBalance, onHuy, onChuaDongY }: {
  cheDo: 'tu_do' | 'rank_pve';
  soO: number;
  khauVi: KhauViDTO['id'];
  banMa?: string | undefined;
  /** 12/09 — seed ép cho TESTER (`?seed=` ở sảnh). Server kiểm quyền và hình dạng. */
  epSeed?: number | undefined;
  /** D456 — khoá luật ép cho TESTER (`?luat=` ở sảnh). Server kiểm quyền; ngoài tester bị lờ. */
  epBalance?: string | undefined;
  onHuy: () => void;
  /** 403 `chua_dong_y` (rank cần đồng ý điều khoản) — trả về sảnh để mở khối đồng ý. */
  onChuaDongY?: (() => void) | undefined;
}) {
  const navigate = useNavigate();
  const tao = useTaoTran();
  const itMotion = useReducedMotion();
  const [pha, setPha] = useState<'tim' | 'lo' | 'san' | 'loi'>('tim');
  const [ghe, setGhe] = useState<DoiThuDTO[]>([]);
  const [soLo, setSoLo] = useState(0);
  const [matchId, setMatchId] = useState<string | null>(null);
  /** Số ô THẬT của bàn vừa dựng (server) — bàn chung có cỡ riêng, không phải cỡ đang chọn ở sảnh. */
  const [tongVong, setTongVong] = useState<number | null>(null);
  const [demNguoc, setDemNguoc] = useState<number>(NHIP_PHONG_CHO.TU_VAO_S);
  const [loi, setLoi] = useState<string | null>(null);
  /**
   * D392 — MÃ lỗi server (không phải câu chữ). Hai lỗi của bàn buổi đo là LỜI BẢO LÀM MỘT VIỆC, nên màn
   * phải có nút làm luôn việc ấy: trước bản này tester đọc "Làm PHIẾU 1 trước đã" mà không có link nào
   * (dải có nút nằm dưới lớp phủ), đọc "Chơi BÀN TẬP trước đã" mà chỉ có nút VỀ SẢNH.
   */
  const [maLoi, setMaLoi] = useState<string | null>(null);
  const me = useMe();
  const bdMe = me.data?.buoi_do ?? null;
  const daGoi = useRef(false);
  const doi = useBan(banMa, { poll: !!banMa });
  /*
   * D329 — BÀN BUỔI ĐO CHƯA ĐỒNG Ý. Máy chủ là nguồn (403 `chua_dong_y_buoi_do`), máy không đoán trước từ
   * `/ban`: câu hỏi "người này đã đồng ý bản hiện hành chưa" chỉ có một câu trả lời, ở `events`. Phòng chờ
   * thay lưới ghế bằng thẻ đồng ý; KHÔNG thì về sảnh — chưa trận nào được tạo.
   */
  const [canDongY, setCanDongY] = useState(false);
  const [loiDongY, setLoiDongY] = useState<string | null>(null);
  const dongY = useDongYBuoiDo();

  function taoTranNay(): void {
    tao.mutate(
      {
        khauVi, soO,
        ...(cheDo === 'rank_pve' ? { cheDo: 'rank_pve' as const } : {}),
        ...(banMa ? { banMa } : {}),
        ...(epSeed !== undefined ? { epSeed } : {}),
        ...(epBalance !== undefined ? { epBalance } : {}),
      },
      {
        onSuccess: (d) => {
          setGhe(d.doi_thu ?? []); setMatchId(d.match_id); setTongVong(d.tong_vong ?? null); setPha('lo');
          // Bàn chung: mình vừa thành một dòng của ĐỘI — hỏi lại ngay, đừng đợi nhịp 20s.
          if (banMa) void doi.refetch();
        },
        onError: (e) => {
          // Bàn chung mà đã có trận ⇒ về trận cũ, không phải lỗi.
          if (e instanceof ApiError && e.code === 'da_vao_ban') {
            const id = (e.body as { match_id?: string } | undefined)?.match_id;
            if (id) { navigate(duongDanTran(id)); return; }
          }
          // Rời hàng chờ suất trận (dải chung) ⇒ về sảnh lặng lẽ: người chơi tự chọn, không phải lỗi.
          if (e instanceof ApiError && e.code === MA_ROI_HANG) { onHuy(); return; }
          if (e instanceof ApiError && e.code === 'chua_dong_y' && onChuaDongY) { onChuaDongY(); return; }
          if (e instanceof ApiError && e.code === 'chua_dong_y_buoi_do') { setCanDongY(true); return; }
          setLoi(e instanceof ApiError && e.message ? e.message : 'Không dựng được bàn. Kiểm tra mạng rồi thử lại nhé.');
          setMaLoi(e instanceof ApiError ? e.code ?? null : null);
          setPha('loi');
        },
      },
    );
  }

  async function batDongY(): Promise<void> {
    if (!banMa) return;
    rung(NHIP_RUNG.cham);
    setLoiDongY(null);
    try {
      await dongY.mutateAsync(banMa);
      setCanDongY(false);
      taoTranNay();
    } catch (e) {
      setLoiDongY(e instanceof ApiError && e.message ? e.message : CHU_BUOI_DO.loiGui);
    }
  }

  // Pha 1 → tạo trận thật.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (daGoi.current) return;
      daGoi.current = true;
      taoTranNay();
    }, itMotion ? 0 : NHIP_PHONG_CHO.TIM);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pha 2 → lộ ghế lần lượt.
  useEffect(() => {
    if (pha !== 'lo') return undefined;
    if (itMotion) { setSoLo(ghe.length); setPha('san'); return undefined; }
    if (soLo >= ghe.length) { setPha('san'); return undefined; }
    const t = window.setTimeout(() => { rung(NHIP_RUNG.cham); setSoLo((n) => n + 1); }, NHIP_PHONG_CHO.MOI_GHE);
    return () => window.clearTimeout(t);
  }, [pha, soLo, ghe.length, itMotion]);

  // Pha 3 → đếm ngược rồi vào.
  useEffect(() => {
    if (pha !== 'san' || !matchId) return undefined;
    if (demNguoc <= 0) { navigate(duongDanTran(matchId)); return undefined; }
    const t = window.setTimeout(() => setDemNguoc((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [pha, demNguoc, matchId, navigate]);

  const chiaSe = async () => {
    if (!banMa) return;
    rung(NHIP_RUNG.cham);
    const url = linkBan(banMa);
    const text = laNgay
      ? 'Bàn hôm nay của DELPHI — cùng seed, cùng bot, xem ai đọc thị trường giỏi hơn.'
      : `Vào bàn ${banMa.toUpperCase()} chơi cùng tôi — cùng một bàn, xem ai đọc thị trường giỏi hơn.`;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') { await navigator.share({ title: 'DELPHI · Bàn chung', text, url }); return; }
    } catch { /* huỷ ⇒ chép */ }
    try { await navigator.clipboard.writeText(`${text} ${url}`); } catch { /* im */ }
  };

  const laNgay = doi.data?.loai === 'ngay';
  const laBuoiDo = doi.data?.loai === 'buoi_do' || canDongY;
  const tenCheDo = cheDo === 'rank_pve' ? 'XẾP HẠNG · MÙA BETA'
    : laBuoiDo && banMa ? `${CHU_BUOI_DO.cheDoPre}${(doi.data?.buoi_do?.nhan ?? banMa).toUpperCase()}`
    : laNgay ? `THỬ THÁCH HÔM NAY · ${doi.data?.thu_thach?.ngay.slice(8, 10)}/${doi.data?.thu_thach?.ngay.slice(5, 7)}`
      : banMa ? `BÀN CHUNG · ${banMa.toUpperCase()}` : 'ĐẤU VỚI MÁY';
  /*
   * Số ô hiển thị: bàn chung lấy từ CHÍNH BÀN (server phát cỡ lúc tạo mã), trận
   * đã dựng lấy `tong_vong` server trả; chỉ khi chưa biết gì mới in cỡ đang chọn.
   * Không thì bàn 12 ô mà nhãn ghi "8 ô" theo nút sảnh — nhãn nói dối.
   */
  const soOHien = tongVong ?? doi.data?.so_o ?? soO;
  /*
   * Số ô = 1 (BẠN) + đối thủ. Lúc còn TÌM chưa biết bàn mấy ghế (server rút 4–8
   * theo seed) ⇒ vẽ 5 ô chờ (cỡ bàn hay gặp nhất) rồi co/giãn theo số thật khi lộ.
   */
  const soDoiThu = pha === 'tim' ? 4 : ghe.length;
  /** Tên hiển thị: server đã dán "Máy · " cho bot (D25/R3) — dòng dưới nói "máy" rồi, khỏi lặp. */
  const tenNgan = (d: DoiThuDTO) => (d.loai === 'bot' ? d.ten.replace(/^Máy · /, '') : d.ten);

  return (
    <div className={s.phu} role="dialog" aria-modal="true" aria-label="Phòng chờ" data-tap="phong-cho" data-pha={pha}>
      <div className={s.dau}>
        <span className={s.nhan}>{canDongY ? 'ĐỌC TRƯỚC KHI VÀO' : pha === 'tim' ? (cheDo === 'rank_pve' ? 'ĐANG TÌM TRẬN' : 'ĐANG XẾP BÀN') : pha === 'san' ? 'BÀN ĐÃ ĐỦ' : pha === 'loi' ? 'CHƯA DỰNG ĐƯỢC BÀN' : 'ĐANG XẾP GHẾ'}</span>
        <span className={s.cheDo}>{tenCheDo} · {soOHien} ô</span>
      </div>

      {canDongY && (
        <div className={s.dongY} data-testid="the-dong-y-buoi-do">
          <div className={s.dongYDau}>
            <span className={s.dongYTen}>{VAN_BAN_BUOI_DO.tieuDe}</span>
            <span className={s.dongYBan}>{CHU_BUOI_DO.phienBanPre}{CONSENT_PHIEN_BAN.buoi_do}</span>
          </div>
          <p className={s.dongYChu}>{VAN_BAN_BUOI_DO.tomTat}</p>
          <p className={s.dongYChu}><span className={s.dongYNhan}>{CHU_BUOI_DO.nhanRoiMay}</span>{VAN_BAN_BUOI_DO.roiMay}</p>
          <p className={s.dongYChu}><span className={s.dongYNhan}>{CHU_BUOI_DO.nhanKhongNhan}</span>{VAN_BAN_BUOI_DO.mayChuKhongDoc}</p>
          <p className={s.dongYChot}>{VAN_BAN_BUOI_DO.chot}</p>
        </div>
      )}

      {!canDongY && (
      <div className={s.ghe} aria-live="polite">
        {/* Ghế BẠN — ngồi sẵn, mặt mình từ /auth/me (GheAvatarKet, tường lửa D24). */}
        <div className={`${s.o} ${s.oLo} ${s.oToi}`} data-ghe="ban">
          <GheAvatarKet loai="nguoi" ten="Bạn" laToi size={32} />
          <span className={s.ten}>BẠN</span>
          <span className={s.loai}>{cheDo === 'rank_pve' ? 'xếp hạng' : 'tự do'}</span>
        </div>
        {Array.from({ length: soDoiThu }, (_, i) => {
          const d = i < soLo ? ghe[i] : undefined;
          return (
            <div key={d?.ghe_id ?? `cho-${i}`} className={`${s.o} ${d ? s.oLo : ''}`} data-ghe={d?.ghe_id}>
              {d ? (
                <>
                  <GheAvatar
                    ghe={d.loai === 'bot' ? { loai: 'may', hat: d.ten } : { loai: 'nguoi', dm: d.dm ?? null }}
                    ten={d.ten} size={32}
                  />
                  <span className={s.ten}>{tenNgan(d)}</span>
                  <span className={s.loai}>{d.loai === 'bot' ? 'máy' : `người · ${d.bac_rank}`}</span>
                </>
              ) : (
                <>
                  <span className={s.cho} aria-hidden>?</span>
                  <span className={s.ten}>{pha === 'tim' ? 'đang tìm…' : '…'}</span>
                </>
              )}
            </div>
          );
        })}
      </div>

      )}

      <p className={s.chu}>
        {laBuoiDo ? CHU_BUOI_DO.chuPhongCho : cheDo === 'rank_pve'
          ? 'Mùa Beta ghép với máy — thắng có điểm, thua không tụt. Ghép người thật mở sau (bàn xếp hạng cần toàn người thật).'
          : laNgay
            ? 'Bàn chung của cả ngày — ai cũng cùng seed, cùng bot, một lượt mỗi người. Xong thì xem mình đứng đâu trong cả sân.'
            : banMa
              ? 'Bạn bè vào cùng mã sẽ ngồi CÙNG BÀN — mỗi người một ghế riêng, xong thì so NAV. Không cần online cùng lúc.'
              : 'Bàn tự do với đối thủ máy — mỗi con một tính cách, cùng một bàn.'}
      </p>

      {banMa && laBuoiDo && !canDongY && (
        <div className={s.doi}>
          <div className={s.doiDau}>{CHU_BUOI_DO.caNhomPre}{doi.data?.so_nguoi ?? '…'}{CHU_BUOI_DO.caNhomHau}</div>
        </div>
      )}
      {banMa && !laBuoiDo && (
        <div className={s.doi}>
          {laNgay ? (
            // Bàn ngày: KHÔNG danh sách tên (D32) — chỉ số người; phân vị lộ sau khi mình xong (A3.1).
            <div className={s.doiDau}>
              CẢ SÂN · {doi.data?.thu_thach?.so_nguoi_vao ?? '…'} người đã vào · {doi.data?.thu_thach?.so_nguoi_xong ?? '…'} xong
              <span className={s.doiPhu}> · phân vị lộ khi bạn xong</span>
            </div>
          ) : (
            <>
              <div className={s.doiDau}>ĐỘI · {doi.data?.so_nguoi ?? '…'} người</div>
              <div className={s.doiDs}>
                {(doi.data?.doi ?? []).map((m) => (
                  <span key={m.handle} className={`${s.doiThe} ${m.la_toi ? s.doiToi : ''}`}>
                    {m.handle}{m.la_toi ? ' (bạn)' : ''} · {m.xong ? 'xong' : m.dang_choi ? 'đang chơi' : 'bỏ dở'}
                  </span>
                ))}
                {doi.data?.doi?.length === 0 && <span className={s.doiThe}>chưa ai vào</span>}
              </div>
            </>
          )}
          <button type="button" className={s.nutPhu} onClick={() => void chiaSe()}>RỦ THÊM · CHIA SẺ LINK</button>
        </div>
      )}

      {pha === 'loi' && <div className={s.loi} role="alert">{loi}</div>}
      {loiDongY !== null && <div className={s.loi} role="alert">{loiDongY}</div>}

      <div className={s.hangNut}>
        {canDongY && (
          <>
            <button type="button" className={s.nutPhu} onClick={onHuy}>{CHU_BUOI_DO.nutKhong}</button>
            <button
              type="button" className={s.nutChinh} disabled={dongY.isPending}
              onClick={() => { void batDongY(); }}
            >
              {dongY.isPending ? CHU_BUOI_DO.dangGui : CHU_BUOI_DO.nutDongY}
            </button>
          </>
        )}
        {pha === 'tim' && !canDongY && (
          // Huỷ lúc đang xếp hàng suất trận = rời hàng luôn (chủ ý của người bấm); sang Hub bằng thanh dưới thì KHÔNG rời.
          <button type="button" className={s.nutPhu} onClick={() => { roiHangSuat(); onHuy(); }}>HUỶ</button>
        )}
        {pha === 'loi' && (
          <button type="button" className={s.nutPhu} onClick={onHuy}>‹ VỀ SẢNH</button>
        )}
        {pha === 'loi' && maLoi === 'chua_nop_phieu_1' && bdMe && (
          <a
            className={`${s.nutChinh} ${s.nutLink}`}
            href={linkPhieu(PHIEU_BUOI_DO[0]!, bdMe.ma, bdMe.nhan)}
            target="_blank" rel="noopener noreferrer" data-testid="phong-cho-mo-phieu-1"
          >
            {CHU_CHE_DO_TESTER.moPhieu} {PHIEU_BUOI_DO[0]!.so}
          </a>
        )}
        {pha === 'loi' && maLoi === 'chua_xong_ban_tap' && (
          <button
            type="button" className={s.nutChinh} disabled={tao.isPending} data-testid="phong-cho-vao-ban-tap"
            onClick={() => tao.mutate({ tap: true }, {
              // Cùng đường vào bàn tập của HƯỚNG DẪN: nhớ id để thẻ TIẾP TỤC dắt về kèm trợ lý (`?tap=1`).
              onSuccess: (d) => { nhoTranTap(d.match_id); navigate(`${duongDanTran(d.match_id)}?tap=1`); },
            })}
          >
            {tao.isPending ? CHU_CHE_DO_TESTER.dangDungBanTap : CHU_CHE_DO_TESTER.vaoBanTap}
          </button>
        )}
        {/*
          D396 — KHÁCH (vào bằng "Chơi ngay") mở link buổi đo: server trả `khach_khong_vao_buoi_do` — buổi đo
          có đo lại mà khách không có danh tính để đo lại. Trước bản này câu báo bảo "tạo tài khoản rồi mở lại
          link" mà chỉ có nút VỀ SẢNH. Nút này NHỚ BÀN trước (khách đang có phiên nên cổng đăng nhập không tự
          nhớ) rồi mở `/onboard` — cửa duy nhất để thoát chế độ khách; đăng ký xong thì luồng D392 đưa thẳng
          vào lập hồ sơ và "VỀ BÀN BUỔI ĐO".
        */}
        {pha === 'loi' && maLoi === 'khach_khong_vao_buoi_do' && banMa && (
          <button
            type="button" className={s.nutChinh} data-testid="phong-cho-tao-tai-khoan"
            onClick={() => { ghiDiemQuayVe(`/arena/ban/${banMa}`); navigate('/onboard'); }}
          >
            {CHU_BUOI_DO.taoTaiKhoan}
          </button>
        )}
        {pha === 'san' && matchId && (
          <button type="button" className={s.nutChinh} onClick={() => navigate(duongDanTran(matchId))}>
            ▶ VÀO BÀN · {demNguoc}s
          </button>
        )}
      </div>
    </div>
  );
}
