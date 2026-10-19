/**
 * Kết quả câu hỏi — màn 5/6: "LỄ CÔNG BỐ", port bám sát
 * "Delphi — Thiết kế giao diện/Mau E - Terminal Neon.dc.html" (choreography:
 * docs/ui-ux/design_style_terminal_neon.md mục 6). Bố cục trong thẻ đúng thứ tự mẫu:
 *   header (logo + VÍ) → breadcrumb → câu hỏi → banner dòng lệnh → các cửa
 *   → nút công bố / nhắc chạm / chạy lại → hoá đơn (VỐN · LÃI · TỔNG NHẬN)
 *   → huy hiệu.
 *
 * ⚠️ SỐ ±T KHÔNG ĐƯỢC LỘ TRƯỚC (chỉ đạo founder 19/07): danh sách Kết quả và
 * Hồ sơ chỉ hiện ±T sau khi user tự bấm công bố ở đây (lib/seen.ts).
 *
 * C4: mọi con số là số server (my_total_bet / my_return / net / bankroll);
 * client chỉ animate TỚI các số đó. Không chat, không "thưởng chuỗi" (không có
 * trong kinh tế A4 — doc mục 8).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/api/client';
import { queryKeys, useMarketDetail, useMe, useMyResults } from '@/api/queries';
import type { MarketDetail as MarketDetailDto, MyResultEntry } from '@/api/types';
import { POOL_LABELS } from '@/lib/labels';
import { formatDeltaT, formatT } from '@/lib/money';
import { formatLockTime } from '@/lib/time';
import { useLocalPref, useReducedMotion } from '@/lib/hooks';
import { markRevealed } from '@/lib/seen';
import {
  PREDICT_TAB_DONE, PREDICT_TAB_PARAM, ROUTE_PREDICT, ROUTE_TOKEN,
} from '@/lib/vocab';
import { AuthGate } from '@/components/AuthGate';
import {
  Badge,
  DoorRow,
  FlameCrown,
  NeonButton,
  Odometer,
  PixelIcon,
  Pill,
  Receipt,
  TerminalCard,
  TerminalPrompt,
  type DoorState,
} from '@/components/ui';
import s from './MarketResult.module.css';

// ═══════════════════════════════ Lễ công bố ═══════════════════════════════

interface CeremonyDoor {
  id: string;
  label: string;
  /** % pool cuối — server trả (distribution). */
  pct: number;
  isWinner: boolean;
  myStake: number;
}

interface StreakInfo {
  /** T thưởng — SERVER tính + ghi ledger (chi từ Kho bạc). */
  bonus: number;
  len: number;
  pools: number;
  ratePct?: number;
}

interface CeremonyProps {
  marketId: string;
  breadcrumb: string;
  question: string;
  promptUser: string;
  announceText: string;
  doors: CeremonyDoor[];
  /** Số SERVER (C4). */
  vonVe: number;
  laiPool: number;
  tongNhan: number;
  net: number;
  /** Số dư SAU trả thưởng (server). Ví đếm lên tới số này. */
  walletAfter: number;
  streak: StreakInfo | null;
  footNote: string;
}

type DoorSt = 'idle' | 'win' | 'lose';

interface St {
  started: boolean;
  running: boolean;
  done: boolean;
  phase: number;
  barW: number[];
  glowB: number;
  doorSt: DoorSt[];
  von: number | null;
  lai: number | null;
  bonus: number | null;
  tongV: number;
  g: number;
  shakeX: number;
  shakeY: number;
  spinning: boolean;
  spinP: number;
  colDone: boolean[];
  flash: boolean;
  wallet: number;
  dWallet: boolean;
  /** Ca THUA: vốn về "tạch" một cái ra 0 + mặt mếu (chỉ đạo founder 19/07). */
  tach: boolean;
}

/**
 * NHỊP LỄ CÔNG BỐ — chỗ duy nhất chỉnh tốc độ. Mốc còn lại bám nguyên Mẫu E
 * (typewriter 24ms · glow 1500 · bar so le 150/dur 900 ease-out³ · vốn 400 ·
 * lãi 650 · thưởng 480 · khoá cột 160 · ví 700).
 *
 * ⚠ BA SỐ DƯỚI ĐÂY LỆCH MẪU E CÓ CHỦ ĐÍCH — founder duyệt sau khi xem thật
 * 20/07/2026. README bàn giao ghi timing là "giá trị cuối", nên ghi rõ ở đây
 * để người sau không tưởng là chép sai rồi "sửa lại cho đúng mẫu".
 */
const PACE = {
  /** Giãn cách giữa hai cửa TẠCH. Mẫu E 400–450ms; đo thật thấy dồn quá, mắt
   *  không kịp đọc tên cửa vừa bị gạch trước khi cửa sau đổ. */
  loseGap: 620,
  /** Khoảng lặng trước khi cửa thắng nảy — nuôi hồi hộp. Mẫu E ~600ms sau cửa
   *  tạch cuối; giữ tinh thần đó nhưng nới thêm chút. */
  beforeWin: 320,
  /** Độ dài đếm TỔNG NHẬN. Mẫu E 1150ms. */
  tongDur: 1550,
  /**
   * Số mũ ease-in của nhịp tổng. Mẫu E dùng 2.7 — quá gắt: số và glow gần như
   * đứng im ~800ms rồi dồn hết vào ~350ms cuối, nên ô nhận token đọc ra là
   * "phựt" một phát còn số thì mãi mới nhảy → hai thứ tuy chung một biến vẫn
   * cảm thấy lệch nhau. 1.9 vẫn dồn cảm xúc về cuối nhưng số lăn thấy được
   * suốt nhịp, và glow dâng theo kịp.
   */
  tongEase: 1.9,
} as const;

function Ceremony(p: CeremonyProps) {
  const reduced = useReducedMotion();
  const [scan, setScan] = useLocalPref('scanline', true);

  const n = p.doors.length;
  const target = p.doors.map((d) => d.pct);
  const winIdx = p.doors.findIndex((d) => d.isWinner);
  // Loại cửa sai từ ít người nhất — chừa cửa ĐÔNG NHẤT cuối cho hồi hộp (Mẫu E)
  const loseOrder = p.doors
    .map((d, i) => ({ i, pct: d.pct }))
    .filter((x) => x.i !== winIdx)
    .sort((a, b) => a.pct - b.pct)
    .map((x) => x.i);
  const cols = Math.max(3, String(Math.max(0, p.tongNhan)).length);
  // THUA = không có tiền về. Lễ đổi hẳn kịch bản: số KHÔNG nhảy, chỉ "tạch".
  const isLoss = p.net < 0;
  // Ví chỉ nhúc nhích khi CÓ tiền về (thua thì token đã trừ lúc đặt, resolve
  // không đụng ví) — nên delta ví chỉ tồn tại ở ca thắng.
  const walletGain = Math.max(0, p.net);
  const walletBefore = p.walletAfter - walletGain;

  const INITIAL: St = {
    started: false,
    running: false,
    done: false,
    phase: 0,
    barW: Array(n).fill(0),
    glowB: 0,
    doorSt: Array(n).fill('idle'),
    von: null,
    lai: null,
    bonus: null,
    tongV: 0,
    g: 0,
    shakeX: 0,
    shakeY: 0,
    spinning: false,
    spinP: 0,
    colDone: Array(cols).fill(false),
    flash: false,
    wallet: walletBefore,
    dWallet: false,
    tach: false,
  };
  const FINAL: St = {
    ...INITIAL,
    started: true,
    done: true,
    phase: 5,
    barW: [...target],
    doorSt: p.doors.map((d) => (d.isWinner ? 'win' : 'lose')),
    von: p.vonVe,
    lai: p.laiPool,
    bonus: p.streak?.bonus ?? null,
    tongV: p.tongNhan,
    g: 1,
    colDone: Array(cols).fill(true),
    wallet: p.walletAfter,
    dWallet: !isLoss,
    tach: isLoss,
  };

  const [st, setSt] = useState<St>(INITIAL);
  const timers = useRef<number[]>([]);
  const rafs = useRef<number[]>([]);
  const spinStop = useRef(true);
  const runningRef = useRef(false);

  const stopAll = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    rafs.current.forEach(cancelAnimationFrame);
    rafs.current = [];
    spinStop.current = true;
  }, []);
  useEffect(() => stopAll, [stopAll]);

  const patch = useCallback((x: Partial<St>) => setSt((prev) => ({ ...prev, ...x })), []);

  /**
   * prefers-reduced-motion KHÔNG được xoá lễ — chỉ được bỏ CHUYỂN ĐỘNG.
   * Cái gây chóng mặt là rung/nảy/số lăn, không phải việc lần lượt lộ kết quả.
   * Nên: tween nhảy thẳng tới đích (số hiện ra chứ không lăn), rung tắt, odometer
   * không quay mờ — nhưng TRÌNH TỰ giữ nguyên (cửa nào tạch, cửa nào thắng, rồi
   * mới tới tiền), vì đó là THÔNG TIN chứ không phải trang trí.
   * Co còn 25% (toàn lễ ≈2,3s, các cửa cách nhau ~106ms) — vẫn đọc kịp từng nhịp;
   * co sâu hơn nữa thì thành một cái chớp, mất đúng thứ cần giữ.
   * Đọc qua ref: at/anim là useCallback deps rỗng, đóng biến sẽ ôi.
   */
  const RM_SCALE = 0.25;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const at = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms * (reducedRef.current ? RM_SCALE : 1)));
  }, []);
  const anim = useCallback(
    (dur: number, ease: (e: number) => number, frame: (v: number) => void, done?: () => void) => {
      // Reduced-motion: đặt thẳng giá trị cuối. Cũng là đường an toàn khi rAF bị
      // treo (máy tiết kiệm pin) — không có nó thì số đứng dở giữa chừng.
      if (reducedRef.current) {
        frame(ease(1));
        done?.();
        return;
      }
      const t0 = performance.now();
      const step = (nowT: number) => {
        const pr = Math.min(1, (nowT - t0) / dur);
        frame(ease(pr));
        if (pr < 1) rafs.current.push(requestAnimationFrame(step));
        else done?.();
      };
      rafs.current.push(requestAnimationFrame(step));
    },
    [],
  );
  const setDoor = useCallback((i: number, v: DoorSt) => {
    setSt((prev) => {
      const doorSt = [...prev.doorSt];
      doorSt[i] = v;
      return { ...prev, doorSt };
    });
  }, []);
  const setCol = useCallback((i: number) => {
    setSt((prev) => {
      const colDone = [...prev.colDone];
      colDone[i] = true;
      return { ...prev, colDone };
    });
  }, []);

  const finishNow = useCallback(() => {
    stopAll();
    runningRef.current = false;
    setSt({ ...FINAL });
    markRevealed(p.marketId); // từ giờ danh sách/hồ sơ mới được hiện ±T
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll, p.marketId]);

  // Bật prefers-reduced-motion GIỮA lễ → về kết quả tức thì
  useEffect(() => {
    if (reduced && runningRef.current) finishNow();
  }, [reduced, finishNow]);

  // Tab bị ẩn giữa lễ (điện thoại rất hay ẩn): rAF dừng nhưng timer vẫn nhích →
  // timeline rách, đóng băng. Chốt thẳng kết quả như skip.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && runningRef.current) finishNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [finishNow]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    stopAll();
    runningRef.current = true;
    // Ca THUA: odometer KHÔNG quay mờ — không nhá hàng số tiền không tồn tại.
    // Reduced-motion cũng không quay mờ: quay = chuyển động thuần trang trí.
    setSt({ ...INITIAL, started: true, running: true, spinning: !isLoss && !reduced, phase: 1 });

    if (!isLoss && !reduced) {
      // Odometer quay mờ ngay từ đầu lễ (chưa lộ số)
      spinStop.current = false;
      const t0 = performance.now();
      const spinLoop = (nowT: number) => {
        if (spinStop.current) return;
        setSt((prev) => (prev.spinning ? { ...prev, spinP: (nowT - t0) / 1000 } : prev));
        rafs.current.push(requestAnimationFrame(spinLoop));
      };
      rafs.current.push(requestAnimationFrame(spinLoop));
    }

    // Nhịp 2 (1250) — glow tăng + 4 bar chạy so le 150ms, ease-out bậc 3
    at(1250, () => {
      patch({ phase: 2 });
      anim(1500, (e) => e, (v) => patch({ glowB: v }));
      target.forEach((pct, idx) => {
        at(idx * 150, () =>
          anim(900, (e) => 1 - Math.pow(1 - e, 3), (v) =>
            setSt((prev) => {
              const w = [...prev.barW];
              w[idx] = v * pct;
              return { ...prev, barW: w };
            }),
          ),
        );
      });
    });

    // Nhịp 3 — loại cửa sai, chừa cửa đông nhất cuối; rồi cửa thắng nảy
    loseOrder.forEach((doorIdx, i) => {
      at(3000 + i * PACE.loseGap, () => {
        if (i === 0) patch({ phase: 3 });
        setDoor(doorIdx, 'lose');
      });
    });
    const winAt = 3000 + loseOrder.length * PACE.loseGap + PACE.beforeWin;
    at(winAt, () => setDoor(winIdx, 'win'));

    // Nhịp 4 — kết toán (đếm TỚI số server)
    if (isLoss) {
      // ── Kịch bản THUA: không đếm tiền. VỐN VỀ "tạch" một cái ra 0 + mặt mếu ──
      at(winAt + 900, () => {
        patch({ phase: 4, von: p.vonVe, lai: p.laiPool, tach: true });
      });
      at(winAt + 2850, () =>
        patch({ tongV: p.tongNhan, colDone: Array(cols).fill(true), g: 0 }),
      );
    } else {
      at(winAt + 900, () => {
        patch({ phase: 4 });
        anim(400, (e) => e * e, (v) => patch({ von: Math.round(v * p.vonVe) }));
      });
      at(winAt + 1400, () =>
        anim(650, (e) => Math.pow(e, 2.2), (v) => patch({ lai: Math.round(v * p.laiPool) })),
      );
      // Thưởng chuỗi bùng lửa sau lãi (đúng nhịp mẫu E: 5350 → 5850 → 6650)
      if (p.streak) {
        at(winAt + 2200, () =>
          anim(480, (e) => e * e, (v) => patch({ bonus: Math.round(v * p.streak!.bonus) })),
        );
      }

      // Nhịp 5 — tổng nhận: rung Stardew → khóa số trái→phải → chớp → ví đếm lên
      at(winAt + 2850, () => {
        spinStop.current = true;
        patch({ spinning: false });
        anim(
          PACE.tongDur,
          (e) => Math.pow(e, PACE.tongEase),
          (v) => {
            const amp = 0.6 + 3.4 * v;
            patch({
              tongV: v * p.tongNhan,
              g: v,
              shakeX: (Math.random() - 0.5) * 2 * amp,
              shakeY: (Math.random() - 0.5) * 2 * amp,
            });
          },
          () => {
            patch({ tongV: p.tongNhan, shakeX: 0, shakeY: 0 });
            for (let i = 0; i < cols; i += 1) at(i * 160, () => setCol(i));
            at(cols * 160, () => patch({ flash: true }));
            at(cols * 160 + 650, () => patch({ flash: false }));
            anim(700, (e) => 1 - Math.pow(1 - e, 2), (v) =>
              patch({ wallet: Math.round(walletBefore + v * walletGain), dWallet: true }),
            );
          },
        );
      });
    }

    // Nhịp 6 — dư âm
    at(winAt + 4200, () => patch({ phase: 5 }));
    // CHỐT CỨNG về FINAL, không chỉ lật cờ running/done.
    // Mốc lễ chạy bằng setTimeout còn tween chạy bằng rAF — hai đồng hồ khác nhau.
    // Khi rAF bị bóp (tiết kiệm pin, tab chạy nền, máy yếu rớt khung) timer vẫn
    // về đích còn tween thì không: lễ "xong" với thanh đứng dở và số sai.
    // Đo được thật: done=true mà cả 3 thanh 0% và TỔNG NHẬN 0 T.
    at(winAt + 4650, finishNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anim, at, patch, reduced, setCol, setDoor, stopAll, finishNow]);

  // Mức năng lượng thẻ (công thức Mẫu E)
  const L = st.running
    ? Math.max(st.glowB * (st.phase === 2 ? 0.8 : 0.3), st.g)
    : st.done
      ? 0.3
      : 0.08;
  const barsLive = st.phase === 2 && st.running;
  const rolling = st.running && !st.spinning && st.tongV > 0 && st.tongV < p.tongNhan;
  const odoOp = st.spinning ? 0.45 : st.tongV > 0 || st.phase >= 4 ? 1 : 0.3;
  // Huy hiệu "Ngược đám đông" — tính từ phân bố THẬT của server
  const winnerPct = p.doors.find((d) => d.isWinner)?.pct ?? 0;
  const contrarian = st.phase >= 5 && p.net > 0 && winnerPct > 0 && winnerPct < 25;

  return (
    <>
      <div className={s.topRow}>
        <NeonButton variant="ghost" onClick={() => setScan(!scan)} aria-pressed={scan}>
          SCAN {scan ? 'ON' : 'OFF'}
        </NeonButton>
      </div>

      <TerminalCard
        scanline={scan}
        glow={L}
        data-testid="ceremony-card"
        onClick={() => {
          if (runningRef.current) finishNow();
        }}
      >
        {/* Header thẻ — đúng mẫu: logo chip + DELPHI://KẾT-QUẢ + pill VÍ */}
        <div className={s.cardHead}>
          <div className={s.brand}>
            <span className={s.brandChip} aria-hidden="true" />
            <span className={s.brandText}>
              DELPHI<span className={s.brandSlash}>://</span>
              <span className={s.brandScreen}>KẾT-QUẢ</span>
            </span>
          </div>
          <div className={s.walletPill}>
            <span className={s.walletLabel}>VÍ</span>
            <span className={s.walletVal}>{formatT(st.wallet)}</span>
            {st.dWallet && walletGain > 0 && (
              <span className={s.walletUp}>▲ +{walletGain.toLocaleString('vi-VN')}</span>
            )}
          </div>
        </div>

        <div className={s.breadcrumb}>
          <span className={s.prompt}>&gt;_</span>
          <span>{p.breadcrumb}</span>
        </div>
        <h1 className={s.question}>{p.question}</h1>

        <TerminalPrompt
          user={p.promptUser}
          text={st.started ? p.announceText : ''}
          typing={st.running && st.phase < 3}
        />

        <div className={s.doors}>
          {p.doors.map((d, i) => {
            const doorState = st.doorSt[i]!;
            const w = st.barW[i]!;
            const settled = !barsLive || Math.abs(w - d.pct) < 0.4;
            const state: DoorState =
              doorState === 'win' ? 'win' : doorState === 'lose' ? 'lose' : barsLive ? 'live' : 'idle';
            return (
              <DoorRow
                key={d.id}
                label={d.label}
                state={state}
                pct={w}
                pctText={st.phase >= 2 ? `${Math.round(w)}%` : '· · ·'}
                settled={settled}
                mineTag={d.myStake > 0 ? `BẠN · ${formatT(d.myStake)}` : undefined}
              />
            );
          })}
        </div>

        {!st.running && !st.done && (
          <NeonButton
            block
            onClick={(e) => {
              e.stopPropagation();
              start();
            }}
          >
            ▶ CÔNG BỐ KẾT QUẢ
          </NeonButton>
        )}
        {st.running && (
          /* Nhìn y như dòng chữ của mẫu, nhưng là <button> để bàn phím/screen
             reader cũng bỏ qua được chuỗi animation ~9 giây */
          <button
            type="button"
            className={s.skipHint}
            onClick={(e) => {
              e.stopPropagation();
              finishNow();
            }}
          >
            chạm màn hình để xem ngay kết quả »
          </button>
        )}
        {st.done && (
          <div className={s.retryRow}>
            <NeonButton
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                start();
              }}
            >
              ↻ CHẠY LẠI
            </NeonButton>
          </div>
        )}

        <Receipt flash={st.flash}>
          {/* Ca THUA: vốn về tạch một cái ra 0, mặt mếu bên cạnh — không đếm số */}
          <div className={s.vonRow}>
            <span className={s.vonLabel}>VỐN VỀ</span>
            <span className={st.tach ? `${s.vonVal} ${s.vonTach}` : s.vonVal}>
              {st.von == null ? '· · ·' : formatT(st.von)}
              {st.tach && (
                <span className={s.sadFace}>
                  <PixelIcon name="sad" size={16} />
                </span>
              )}
            </span>
          </div>
          <Receipt.Row
            label="LÃI TỪ POOL"
            value={st.lai == null ? '· · ·' : p.laiPool === 0 ? '—' : formatDeltaT(st.lai)}
            tone={st.lai == null || p.laiPool === 0 ? 'plain' : p.laiPool > 0 ? 'win' : 'lose'}
          />
          {p.streak && p.streak.bonus > 0 && st.bonus != null && (
            <div className={s.streakRow}>
              <FlameCrown />
              <span className={s.streakText}>
                <span className={s.streakTitle}>
                  THƯỞNG CHUỖI{' '}
                  {p.streak.ratePct !== undefined && (
                    <b className={s.streakRate}>+{p.streak.ratePct}%</b>
                  )}
                </span>
                <span className={s.streakSub}>
                  đúng {p.streak.len} câu liên tiếp · {p.streak.pools} pool khác nhau
                </span>
              </span>
              <span className={s.streakVal}>▲ +{formatT(st.bonus)}</span>
            </div>
          )}
          <Receipt.Sep />
          <div className={s.tongWrap}>
            <div className={s.tongLabel}>TỔNG NHẬN</div>
            <div
              className={s.odoRow}
              /*
               * RUNG THEO SỐ NGUYÊN ĐIỂM ẢNH. Cũ `toFixed(1)` đẩy cả khối đồng
               * hồ ra vị trí lẻ 0,1px mỗi khung — trình duyệt phải nội suy lại
               * chữ, và cú rung kiểu Stardew đọc ra thành chữ bị nhoè. Rung
               * pixel thật là nhảy nguyên ô: −4…+4, không có gì ở giữa.
               */
              style={{
                transform: `translate(${Math.round(st.shakeX)}px, ${Math.round(st.shakeY)}px)`,
              }}
            >
              {/* Quầng dâng theo tiến độ — ÁNH SÁNG, đổi độ mạnh nên để mượt. */}
              <div className={s.tongGlow} style={{ opacity: 0.1 + 0.9 * st.g }} aria-hidden="true" />
              {/* Đồng hồ hiện ra là VẬT xuất hiện → nhảy 3 nấc, không hoà dần. */}
              <div style={{ opacity: odoOp, transition: 'opacity 400ms steps(3, end)' }}>
                <Odometer
                  value={st.tongV}
                  cols={cols}
                  rolling={rolling}
                  spinning={st.spinning}
                  spinP={st.spinP}
                  lockedCols={st.colDone}
                  glow={st.g}
                />
              </div>
              <span className={s.tongT}>T</span>
            </div>
          </div>
        </Receipt>

        {(contrarian || (st.phase >= 5 && p.streak)) && (
          <div className={s.badges}>
            {contrarian && (
              <Badge
                icon="target"
                title="Ngược đám đông"
                detail={`chỉ ${winnerPct}% pool ở cửa này`}
              />
            )}
            {st.phase >= 5 && p.streak && (
              <Badge
                icon="flame"
                tone="gold"
                iconAnim="flame"
                delayS={contrarian ? 0.18 : 0}
                title={`Chuỗi ${p.streak.len} câu đúng`}
                detail={
                  p.streak.bonus > 0
                    ? `thưởng chuỗi +${p.streak.ratePct ?? 0}% đã cộng`
                    : `${p.streak.pools} pool khác nhau — vinh danh`
                }
              />
            )}
          </div>
        )}
      </TerminalCard>

      <p className={s.footNote}>{p.footNote}</p>
    </>
  );
}

// ══════════════════════════ Vỏ màn (dữ liệu thật) ══════════════════════════

function staticFootNote(d: MarketDetailDto): string {
  return `Nguồn chung thẩm: ${d.resolution_source_name} — số công bố lần đầu là kết quả cuối cùng.${
    d.resolution_note ? ` Ghi chú: ${d.resolution_note}` : ''
  }`;
}

function ResultInner({ id }: { id: string }) {
  const detail = useMarketDetail(id, true);
  const results = useMyResults(true);
  const me = useMe();
  const qc = useQueryClient();

  // Payout/refund xảy ra server-side lúc resolve — làm mới ví MỘT lần khi mở màn
  const status = detail.data?.status;
  useEffect(() => {
    if (status === 'resolved' || status === 'cancelled') {
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
    }
  }, [qc, status]);

  if (detail.isPending || results.isPending) {
    return <div className="skeleton" style={{ height: 420 }} aria-busy="true" />;
  }
  if (detail.isError) {
    const notFound = detail.error instanceof ApiError && detail.error.status === 404;
    return (
      <div className={s.errBox} role="alert">
        <span>{notFound ? 'Không có câu hỏi này.' : 'Không tải được dữ liệu. Thử lại nhé.'}</span>
        {notFound ? (
          <Link to={`${ROUTE_PREDICT}?${PREDICT_TAB_PARAM}=${PREDICT_TAB_DONE}`}>
            ← Về danh sách kết quả
          </Link>
        ) : (
          <NeonButton variant="ghost" onClick={() => detail.refetch()}>
            ↻ THỬ LẠI
          </NeonButton>
        )}
      </div>
    );
  }
  const d = detail.data!;

  if (d.status === 'open' || d.status === 'locked') {
    return (
      <div className={s.errBox}>
        <span>
          Câu hỏi này chưa chốt ({d.status === 'open' ? 'đang mở' : 'đã khóa, chờ nguồn công bố'}).
        </span>
        <Link to={`/keo/${d.market_id}`}>← Xem chi tiết</Link>
      </div>
    );
  }

  const breadcrumb = `keo/${d.market_id.slice(0, 6)} · ${POOL_LABELS[d.pool].toLowerCase()} · nguồn: ${d.resolution_source_name} · đã khóa ${formatLockTime(d.lock_ts)}`;

  if (d.status === 'cancelled') {
    return (
      <>
        <TerminalCard glow={0.08}>
          <div className={s.breadcrumb}>
            <span className={s.prompt}>&gt;_</span>
            <span>{breadcrumb}</span>
          </div>
          <h1 className={s.question}>{d.question_text}</h1>
          <div className={s.cancelBox}>
            <Pill tone="lose">ĐÃ HỦY</Pill>
            <span>
              Nguồn không công bố trong hạn hoặc câu hỏi bị hủy — <b>hoàn 100%</b> token đã phân bổ
              về ví (không rake). Kiểm tra dòng "Hoàn token" trong <Link to={ROUTE_TOKEN}>Ví</Link>.
            </span>
            {d.resolution_note && <span className={s.note}>Ghi chú: {d.resolution_note}</span>}
          </div>
        </TerminalCard>
      </>
    );
  }

  // ---- resolved ----
  const mine: MyResultEntry | null = results.data?.find((r) => r.market_id === id) ?? null;
  const winnerId = d.outcome_option_id ?? mine?.outcome_option_id ?? null;
  const participated = d.my_allocation.length > 0;
  const dist = 'distribution' in d && d.distribution ? d.distribution : null;
  const allocMap = new Map(d.my_allocation.map((a) => [a.option_id, a.amount]));

  if (participated && dist && mine && winnerId) {
    const distMap = new Map(dist.map((e) => [e.option_id, e]));
    const winnerLabel = d.options.find((o) => o.option_id === winnerId)?.label ?? '';
    // Tách my_return của SERVER thành 2 dòng như mẫu E: phần vốn quay lại và
    // phần lãi. Thua trắng → vốn về 0, lãi 0. Thua một phần → vốn về = số nhận.
    const vonVe = Math.min(mine.my_return, mine.my_total_bet);
    const laiPool = mine.my_return - vonVe;
    // Chuỗi: có thưởng T (pool VĨ MÔ) HOẶC chỉ vinh danh (pool khác) — cả hai
    // đều do server quyết, client không tự tính đồng nào.
    const streak: StreakInfo | null =
      (mine.streak_len ?? 0) >= 2
        ? {
            bonus: mine.streak_bonus ?? 0,
            len: mine.streak_len ?? 0,
            pools: mine.streak_pools ?? 0,
            ...(mine.streak_rate_pct !== undefined ? { ratePct: mine.streak_rate_pct } : {}),
          }
        : null;
    return (
      <Ceremony
        marketId={d.market_id}
        breadcrumb={breadcrumb}
        question={d.question_text}
        promptUser={`${d.resolution_source_name.toLowerCase().replace(/\s+/g, '-')}@delphi:~$`}
        announceText={`${d.resolution_source_name.toUpperCase()} CÔNG BỐ · ${winnerLabel}`}
        doors={d.options.map((o) => ({
          id: o.option_id,
          label: o.label,
          pct: distMap.get(o.option_id)?.pct ?? 0,
          isWinner: o.option_id === winnerId,
          myStake: allocMap.get(o.option_id) ?? 0,
        }))}
        vonVe={vonVe}
        laiPool={laiPool}
        tongNhan={mine.my_return + (streak?.bonus ?? 0)}
        net={mine.net + (streak?.bonus ?? 0)}
        walletAfter={me.data?.user?.bankroll ?? mine.my_return}
        streak={streak}
        footNote={staticFootNote(d)}
      />
    );
  }

  // Không tham gia (A3.1: không thấy phân bố) hoặc thiếu số cá nhân → bản tĩnh
  return (
    <>
      <TerminalCard glow={0.3}>
        <div className={s.breadcrumb}>
          <span className={s.prompt}>&gt;_</span>
          <span>{breadcrumb}</span>
        </div>
        <h1 className={s.question}>{d.question_text}</h1>
        <div className={s.doors}>
          {d.options.map((o) => {
            const isWinner = winnerId !== null && o.option_id === winnerId;
            const mineAmt = allocMap.get(o.option_id) ?? 0;
            const pct = dist?.find((e) => e.option_id === o.option_id)?.pct;
            return (
              <DoorRow
                key={o.option_id}
                label={o.label}
                state={isWinner ? 'win' : dist ? 'lose' : 'masked'}
                pct={pct ?? 0}
                pctText={pct !== undefined ? `${pct}%` : ''}
                mineTag={mineAmt > 0 ? `BẠN · ${formatT(mineAmt)}` : undefined}
              />
            );
          })}
        </div>
        {winnerId === null && (
          <p className={s.note}>Cửa đúng sẽ hiển thị khi backend bổ sung dữ liệu kết quả (§2.5).</p>
        )}
        {participated && !mine && (
          <p className={s.note}>
            Bảng kết toán cá nhân sẽ hiện khi backend hoàn tất <code>/me/results</code>. Token thắng
            (nếu có) đã về ví tự động — xem <Link to={ROUTE_TOKEN}>Ví</Link>.
          </p>
        )}
        {!participated && (
          <p className={s.note}>
            Bạn không tham gia câu hỏi này nên phân bố cộng đồng không hiển thị (luật sân chơi).
          </p>
        )}
      </TerminalCard>
      <p className={s.footNote}>{staticFootNote(d)}</p>
    </>
  );
}

export function MarketResult() {
  const { marketId = '' } = useParams();
  return (
    <div className={s.wrap}>
      <AuthGate>
        <ResultInner id={marketId} />
      </AuthGate>
    </div>
  );
}
