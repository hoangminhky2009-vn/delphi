/**
 * MÀN CHÀO VAI — 5 giây đầu trận, rồi biến mất.
 *
 * Founder 23/08: *"Phần nói cho player biết mình là ai nên có riêng 1 khoảng
 * 5s/trận khi bắt đầu trận đấu, vào trận thì thu nhỏ nó lại chỉ còn 1 icon
 * pixel ở trong chợ đại diện cho role và nếu quên chức năng/role thì có thể bấm
 * vào để đọc."*
 *
 * ─── VÌ SAO MỘT MÀN RIÊNG LẠI GỌN HƠN MỘT KHỐI Ở LẠI ──────────────────────
 * Thẻ VAI cũ ngồi thường trực đầu shop và ăn ~140px MỖI LẦN mở chợ, cả trận —
 * để nói một điều CHỈ ĐỔI MỘT LẦN duy nhất: vai được bốc lúc tạo bàn (D107,
 * không cho chọn, không đổi giữa trận). Thông tin không đổi mà chiếm chỗ theo
 * số lần mở chợ là thứ đắt nhất trên một màn 375px.
 * Nay nó nói ĐÚNG MỘT LẦN, to và rõ, ở đúng lúc người chơi chưa có gì để làm;
 * rồi co lại thành một icon bấm được.
 *
 * ⚠ KHÔNG NUỐT LƯỢT: chạm bất kỳ đâu là tắt ngay, và vòng 1 vốn có 45 giây
 * (D38) nên 5s không ép ai. Đây là màn CHÀO, không phải cửa phải qua.
 * ⚠ `prefers-reduced-motion` bỏ hoạt ảnh nhưng GIỮ nguyên 5 giây: thứ bị tắt là
 * cái nháy, không phải cái tin — người ta vẫn cần chừng ấy thời gian để ĐỌC.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PixelIcon, type PixelIconName } from '@/components/ui';
import { useReducedMotion } from '@/lib/hooks';
import { NHIP } from '@/lib/nhip';
import { GheAvatar } from './BotAvatar';
import { NHAN_VAI } from './DoiThuStrip';
import s from './ChaoVai.module.css';

/** Giây đứng lại — founder chốt 5s. PLAYTEST-TUNE, một chỗ. */
export const CHAO_VAI_MS = 5000;

/**
 * Vai → icon pixel. Lấy từ bộ lưới CÓ SẴN, không vẽ mới:
 *   · cá nhân  `user`         — một người
 *   · đội lái  `bolt`         — cú đẩy giá, đúng thứ vai này làm
 *   · cá mập   `rank_ca_map`  — con cá mập đã vẽ cho thang rank
 *   · tổ chức  `hall`         — toà nhà
 * ⚠ Vai lạ (server thêm vai mới) rơi về `user` chứ không vỡ: một icon chưa hợp
 * vẫn hơn một ô trống, và nhãn chữ ngay cạnh vẫn nói đúng tên.
 */
export const ICON_VAI: Record<string, PixelIconName> = {
  ca_nhan: 'user', doi_lai: 'bolt', ca_map: 'rank_ca_map', to_chuc: 'hall',
};

export interface VaiChao {
  id: string;
  ten: string;
  dacQuyen: string;
  caiGia: string;
  /**
   * D312 — hệ số vốn khởi điểm của vai (`he_so_von`: cá nhân 1 · tổ chức 2 ·
   * cá mập/đội lái 3). Founder 08/09: *"đầu game phải giới thiệu luôn cơ chế
   * chia role các thứ"* — mà thứ khác nhau NHẤT giữa các vai lại là con số
   * không hề xuất hiện ở màn chào.
   */
  heSoVon: number;
}

/** 12/09 — một ghế trên bàn, đủ để chia lá vai (cấu trúc con của `DoiThuDTO`). */
export interface GheChia {
  ghe_id: string;
  ten: string;
  loai: 'nguoi' | 'bot' | 'bong';
  vai?: string | undefined;
  /** D528 — vai bị giấu với người xem (khoá v59, thiếu SOI VAI). */
  vai_an?: true | undefined;
}

/** Pha CHIA VAI kéo dài bao lâu: n ghế (kể cả mình) × một nhịp + giữ. */
export function chiaVaiMs(soGhe: number): number {
  return NHIP.CHIA_VAI * soGhe + NHIP.CHIA_VAI_GIU;
}

/** D542 — thứ tự đọc: tay to trước (vai có đặc quyền nặng nhất), Cá nhân cuối. */
const THU_TU_VAI = ['ca_map', 'doi_lai', 'to_chuc', 'ca_nhan'];

export function ChaoVai({ vai, onXong, doiThu, demVai, vaiBang, avatarToi, dongBang, onPha }: {
  vai: VaiChao;
  /**
   * D542 (founder 06/10: *"đầu trận chỉ nên báo là 'Trận có X role (icon)(số)'"*) — số vai của các ghế KHÁC (server `dem_vai`). Có ⇒ pha CHIA VAI
   * chỉ nói BÀN CÓ BAO NHIÊU tay to, không lật vai từng ghế.
   */
  demVai?: Readonly<Record<string, number>> | undefined;
  onXong: () => void;
  /** 12/09 — các ghế KHÁC theo thứ tự bàn. Có (≥1) ⇒ pha CHIA VAI chạy trước "VAI CỦA BẠN". */
  doiThu?: readonly GheChia[] | undefined;
  /** Bảng vai của catalog — `he_so_von` cho lá vai từng ghế. */
  vaiBang?: Record<string, { ten: string; he_so_von: number }> | undefined;
  /** Avatar của mình — cha truyền (`GheAvatarKet` cần `useMe`, tường lửa D24). Vắng ⇒ hình người chung. */
  avatarToi?: ReactNode;
  /**
   * 12/09 — MÀN TẬP ĐÓNG BĂNG (founder: *"màn tập thì cho nó đóng băng ở cái lúc
   * phân vai để giới thiệu và hướng dẫn đi đã"*): không hẹn giờ ở cả hai pha,
   * Oracle nói trên chính màn này, người chơi chạm mới đi tiếp. Trận thật vẫn tự trôi.
   */
  dongBang?: boolean | undefined;
  /** Báo pha cho cha (coach bàn tập rọi đúng khối). Gọi lúc mount và mỗi lần đổi pha. */
  onPha?: ((pha: 'chia' | 'toi') => void) | undefined;
}) {
  const itMotion = useReducedMotion();
  const coChia = doiThu !== undefined && doiThu.length > 0;
  /*
   * 12/09 — HAI PHA. `chia`: cả bàn nhận lá vai lần lượt, mình cuối cùng (founder:
   * bàn tập đi thẳng vào trận, chưa có khoảnh khắc nào cho thấy CẢ BÀN được chia
   * vai). `toi`: màn "VAI CỦA BẠN" 5 giây như cũ. Không có `doiThu` (trận cũ /
   * người gọi cũ) ⇒ vào thẳng `toi`, mọi hẹn giờ y nguyên.
   */
  const [pha, setPha] = useState<'chia' | 'toi'>(coChia ? 'chia' : 'toi');
  const [dangTat, setDangTat] = useState(false);
  /*
   * D406 — VỐN ĐỀU (v54): mọi vai hệ số 1 ⇒ nhãn "×1" trên từng lá là tám lần nói một điều không phân biệt gì, và câu
   * "vai quyết vốn khởi điểm" thành sai. Đọc từ CHÍNH bảng vai của trận (`vaiBang`), không hỏi phiên bản.
   */
  const vonDeu = vaiBang !== undefined && Object.values(vaiBang).length > 0
    && Object.values(vaiBang).every((v) => v.he_so_von === 1);
  const vonCua = (id: string | undefined): string => {
    if (vonDeu) return '';
    const hs = id ? vaiBang?.[id]?.he_so_von : undefined;
    return hs === undefined ? '' : `×${hs}`;
  };
  const hen = useRef<ReturnType<typeof setTimeout>[]>([]);
  /*
   * ⚠⚠ `onXong` ĐI QUA REF, KHÔNG QUA MẢNG PHỤ THUỘC — và đây là bug thật, chỉ
   * lộ trên trình duyệt: cha truyền `onXong={() => setDaChaoVai(true)}`, tức
   * một hàm MỚI mỗi lần render, mà màn trận re-render MỖI GIÂY vì đồng hồ đếm
   * ngược. Effect chạy lại mỗi giây ⇒ cleanup huỷ cái hẹn 5 giây rồi đặt lại từ
   * đầu ⇒ nó KHÔNG BAO GIỜ tới hạn, và màn chào đứng lại vĩnh viễn.
   * Cùng họ với lỗi mảng phụ thuộc đã vá ở `ThanhPhongCach` hôm nay — lần này
   * nguồn nhiễu không phải state nội bộ mà là một prop hàm.
   * ⚠ Test một lượt render KHÔNG bắt được ca này; bài canh nằm ở "cha render
   * lại nhiều lần trong lúc chờ".
   */
  const xongRef = useRef(onXong);
  xongRef.current = onXong;

  const phaRef = useRef(onPha);
  phaRef.current = onPha;
  useEffect(() => { phaRef.current?.(pha); }, [pha]);

  useEffect(() => {
    const dat = (f: () => void, ms: number) => { hen.current.push(setTimeout(f, ms)); };
    // Bàn tập đóng băng: không một cái hẹn nào — chỉ tay người chơi mới đi tiếp.
    if (dongBang === true) return undefined;
    if (pha === 'chia') {
      dat(() => setPha('toi'), chiaVaiMs((doiThu?.length ?? 0) + 1));
    } else {
      dat(() => setDangTat(true), CHAO_VAI_MS - (itMotion ? 0 : 260));
      dat(() => xongRef.current(), CHAO_VAI_MS);
    }
    return () => { hen.current.forEach(clearTimeout); hen.current = []; };
    // `doiThu` chỉ đọc độ dài lúc vào pha chia — bàn không đổi ghế giữa chừng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pha, itMotion, dongBang]);

  /** Chạm: đang chia ⇒ nhảy tới vai của mình; đang xem vai ⇒ vào bàn. Không nuốt lượt. */
  const cham = () => { if (pha === 'chia') setPha('toi'); else onXong(); };

  return (
    <div
      className={`${s.phu} ${dangTat ? s.tat : ''}`}
      /*
       * Cả lớp phủ là một cái nút TẮT — người chơi không phải tìm chữ ✕ nhỏ xíu
       * để thoát khỏi thứ họ đã đọc xong. `role="button"` + phím để bàn phím và
       * trình đọc màn hình cũng qua được.
       */
      role="button"
      tabIndex={0}
      aria-label={pha === 'chia'
        ? 'Đang chia vai cho cả bàn. Chạm để xem vai của bạn.'
        : `Vai của bạn: ${vai.ten}. Chạm để vào bàn.`}
      onClick={cham}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') cham(); }}
      data-testid="chao-vai"
      data-vai={vai.id}
      data-pha={pha}
    >
      {pha === 'chia' ? (
        <div className={s.khoi}>
          <div className={s.nhan}>{demVai ? 'TRẬN CÓ' : 'CHIA VAI'}</div>
          {demVai ? (() => {
            const ds = THU_TU_VAI.filter((v) => (demVai[v] ?? 0) > 0 && v !== 'ca_nhan').map((v) => [v, demVai[v]!] as const);
            const cau = ds.length ? ds.map(([v, n]) => `${n} ${NHAN_VAI[v] ?? v}`).join(' · ') : 'không tay to nào';
            return (
              <div className={s.demVai} role="list" aria-label={`Trận có ${cau}`} data-tap="chia-vai" data-dem-vai>
                {ds.map(([v, n], i) => (
                  <div key={v} role="listitem" className={s.oDem} style={{ '--tre': i } as CSSProperties} data-vai={v}>
                    <PixelIcon name={ICON_VAI[v] ?? 'user'} size={32} />
                    <b className={s.soDem}>{n}</b>
                    <span className={s.tenDem}>{NHAN_VAI[v] ?? v}</span>
                  </div>
                ))}
                {ds.length === 0 && <div className={s.oDem}><span className={s.tenDem}>KHÔNG TAY TO NÀO</span></div>}
              </div>
            );
          })() : (
          <div className={s.chia} role="list" aria-label="Vai của từng ghế" data-tap="chia-vai">
            {[
              ...(doiThu ?? []).map((g) => ({ g, toi: false })),
              { g: { ghe_id: 'ban', ten: 'Bạn', loai: 'nguoi' as const, vai: vai.id }, toi: true },
            ].map(({ g, toi }, i) => (
              <div
                key={g.ghe_id}
                role="listitem"
                className={`${s.laVai} ${toi ? s.laToi : ''}`}
                style={{ '--tre': i } as CSSProperties}
                data-ghe={g.ghe_id}
                data-vai={g.vai ?? ''}
                aria-label={`${toi ? 'Bạn' : g.ten}: ${g.vai ? (NHAN_VAI[g.vai] ?? g.vai) : g.vai_an ? 'vai bị giấu' : 'không vai'} ${vonCua(g.vai)}`.trim()}
              >
                <span className={s.laMat}>
                  {toi && avatarToi ? avatarToi : (
                    <GheAvatar
                      ghe={g.loai === 'nguoi' ? { loai: 'nguoi', dm: null } : { loai: 'may', hat: g.ten }}
                      size={32}
                      ten={toi ? 'Bạn' : g.ten}
                    />
                  )}
                </span>
                <PixelIcon name={ICON_VAI[g.vai ?? ''] ?? 'user'} size={16} />
                {/* D528 — khoá v59: vai ghế khác bị giấu (trừ SOI VAI) ⇒ lá úp "?" thay vì "—" (không vai). */}
                <span className={s.laTen}>{g.vai ? (NHAN_VAI[g.vai] ?? g.vai) : g.vai_an ? '?' : '—'}</span>
                <span className={s.laVon}>{vonCua(g.vai)}</span>
              </div>
            ))}
          </div>
          )}
          {demVai && <div className={s.luat}>Ai cầm vai nào thì giấu — chỉ biết bàn có bao nhiêu tay to.</div>}
          <div className={s.luat}>
            {vonDeu
              ? 'Mỗi ghế bốc một vai lúc dựng bàn — vai quyết một quyền riêng và một cái giá riêng; vốn mọi ghế như nhau.'
              : 'Mỗi ghế bốc một vai lúc dựng bàn — vai quyết vốn khởi điểm và quyền riêng của ghế.'}
          </div>
          <div className={s.nhac}>chạm để xem vai của bạn</div>
        </div>
      ) : (
      <div className={s.khoi} data-tap="chao-vai">
        <div className={s.nhan}>VAI CỦA BẠN</div>
        <PixelIcon name={ICON_VAI[vai.id] ?? 'user'} size={64} className={s.icon} />
        <div className={s.ten}>{vai.ten}</div>
        <div className={s.dong}>
          <span className={s.k}>QUYỀN</span>
          <span className={s.v}>{vai.dacQuyen}</span>
        </div>
        <div className={s.dong}>
          <span className={s.k}>GIÁ</span>
          <span className={`${s.v} ${s.gia}`}>{vai.caiGia}</span>
        </div>
        <div className={s.dong}>
          <span className={s.k}>VỐN</span>
          <span className={s.v}>
            {vonDeu ? 'như mọi ghế' : vai.heSoVon === 1 ? 'vốn cơ bản' : `gấp ${vai.heSoVon} lần vốn cơ bản`}
          </span>
        </div>
        {/*
          CƠ CHẾ, không chỉ danh tính (D312). Màn này trước đây nói "bạn là X"
          mà không nói LUẬT — người chơi không biết cả bàn cũng đang được chia
          vai, nên đọc vốn của cá mập thành "máy ăn gian".
        */}
        {/* D406 — vốn đều thì câu "vai quyết vốn khởi điểm" sai, và "% vốn của chính bạn" hết là chỗ đáng nhắc. */}
        <div className={s.luat}>
          {vonDeu ? (
            <>Mỗi ghế ở bàn đều được chia một vai. Vai quyết một quyền riêng và một cái giá
              riêng — vốn khởi điểm mọi ghế như nhau.</>
          ) : (
            <>Mỗi ghế ở bàn đều được chia một vai. Vai quyết vốn khởi điểm và lõi
              ghim sẵn — thắng thua tính theo <b>% vốn của chính bạn</b>, không phải
              số tuyệt đối.</>
          )}
        </div>
        <div className={s.nhac}>chạm để vào bàn</div>
      </div>
      )}
    </div>
  );
}
