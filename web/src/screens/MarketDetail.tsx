/**
 * Chi tiết câu hỏi & phân bổ — màn 3/6, dữ liệu THẬT (GET /markets/:id).
 * BỐN LUẬT CỨNG (docs/ui-ux/gd5_ui_technical_directives.md):
 *  - C4: không tính tiền hệ thống — cap/implied/bankroll hiển thị nguyên văn từ
 *    server; sau khi gửi, mọi con số cập nhật TỪ RESPONSE. (Các phép cộng/clamp
 *    dưới đây CHỈ trên BẢN NHÁP input của user, giới hạn bởi số server — server
 *    vẫn là gác cổng cuối.)
 *  - A3.1: rẽ nhánh bằng SỰ VẮNG MẶT của key `distribution`.
 *  - Declarative: allocations gửi lên = phân bổ MỚI TOÀN CÂU HỎI.
 *  - Idempotency §2.3: key sinh mỗi lần bấm gửi; lỗi mạng → GIỮ key + body.
 *
 * UX phân bổ (chỉ đạo founder 19/07): chạm cửa → bung thanh kéo + ô số;
 * kéo kịch trần → cháy + ALL-IN (họ hiệu ứng lửa Mẫu E); rải nhiều cửa →
 * thanh chia khúc theo cửa; đồng hồ "KHẨU VỊ RỦI RO" đo liều/cẩn trọng từ
 * bản nháp (chỉ để tự soi — không ảnh hưởng kết quả, A3.9; bản ghi đo lường
 * thật nằm server-side trong events.bet_place/bet_adjust).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ECONOMY } from '@config/economy';
import { ApiError } from '@/api/client';
import { useMarketDetail, useMarketPoolPolling, usePlaceBets } from '@/api/queries';
import type { Allocation } from '@/api/types';
import { POOL_LABELS } from '@/lib/labels';
import { ROUTE_PREDICT } from '@/lib/vocab';
import { formatT } from '@/lib/money';
import { formatLockTime } from '@/lib/time';
import { useLocalPref, useNow } from '@/lib/hooks';
import { AuthGate } from '@/components/AuthGate';
import { DoorRow, NeonButton, PixelIcon, Pill, TerminalCard } from '@/components/ui';
import s from './MarketDetail.module.css';

const HOUR_MS = 60 * 60_000;

// A4: tham số kinh tế đọc từ MỘT nguồn chân lý — copy UI không bao giờ nói dối config
const RAKE_PCT = (ECONOMY.RAKE_BURN_BP + ECONOMY.RAKE_TREASURY_BP) / 100;
const BURN_PCT = ECONOMY.RAKE_BURN_BP / 100;
const TREA_PCT = ECONOMY.RAKE_TREASURY_BP / 100;
const CAP_PCT = ECONOMY.BET_CAP_BP / 100;

/** Màu khúc thanh chia cửa (xoay vòng theo thứ tự cửa). */
const SEG_COLORS = ['#22d3ee', '#8b5cf6', '#4ade80', '#67e8f9'];

function countdownLabel(remainMs: number): string {
  const total = Math.max(0, Math.floor(remainMs / 1000));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `còn ${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Nhãn khẩu vị rủi ro từ mức dùng trần + độ dồn cửa (thuần trình diễn bản nháp). */
function riskTier(capUsage: number, herf: number, allIn: boolean) {
  // Không emoji lửa ở đuôi nhãn: cả hàng ô LED đã chuyển vàng và chữ đã đổi
  // sang vàng có quầng — lửa thứ ba do font HĐH vẽ chỉ thêm một hình lạc hệ.
  if (allIn) return { label: 'HẾT TRẦN', cls: 'allin' as const };
  const risk = capUsage * (0.4 + 0.6 * herf);
  if (risk >= 0.6) return { label: 'RỰC LỬA', cls: 'hot' as const };
  if (risk >= 0.28) return { label: 'CHẮC TAY', cls: 'steady' as const };
  return { label: 'THĂM DÒ', cls: 'probe' as const };
}

function DetailInner({ id }: { id: string }) {
  const detail = useMarketDetail(id, true);
  useMarketPoolPolling(detail.data);
  const place = usePlaceBets(id);
  const now = useNow(1000); // đếm ngược HIỂN THỊ — giờ khóa thật do server quyết
  // Bản nháp phân bổ: null = chưa sửa (hiển thị theo my_allocation server)
  const [draft, setDraft] = useState<Record<string, number> | null>(null);
  const [openDoor, setOpenDoor] = useState<string | null>(null);
  const [clientErr, setClientErr] = useState('');
  const [justPlaced, setJustPlaced] = useState(false);
  const [scan] = useLocalPref('scanline', true); // tôn trọng toggle chung (doc 7.4)
  // §2.3: {key, body} — cùng body thì giữ key (retry), body đổi thì key mới
  const keyRef = useRef<{ key: string; body: string } | null>(null);

  const d = detail.data;

  /** Phân bổ đang hiển thị: bản nháp nếu có, không thì đúng my_allocation server. */
  const effective = useMemo<Record<string, number>>(() => {
    if (draft) return draft;
    return Object.fromEntries((d?.my_allocation ?? []).map((a) => [a.option_id, a.amount]));
  }, [draft, d?.my_allocation]);

  // Giờ khóa trôi qua khi tab đang mở (đỉnh CCU quanh giờ khóa — D11): refetch
  // MỘT lần để status server về 'locked' và phiếu tự ẩn.
  const lockedOnce = useRef(false);
  const refetchDetail = detail.refetch;
  const lockPassed =
    detail.data?.status === 'open' && new Date(detail.data.lock_ts).getTime() - now <= 0;
  useEffect(() => {
    if (lockPassed && !lockedOnce.current) {
      lockedOnce.current = true;
      void refetchDetail();
    }
  }, [lockPassed, refetchDetail]);

  if (detail.isPending) {
    return <div className="skeleton" style={{ height: 360 }} aria-busy="true" />;
  }
  if (detail.isError) {
    const err = detail.error;
    const notFound = err instanceof ApiError && err.status === 404;
    return (
      <div className={s.errBox} role="alert">
        <span>
          {notFound
            ? 'Không có câu hỏi này (có thể đã gỡ).'
            : 'Không tải được dữ liệu. Kiểm tra mạng rồi thử lại nhé.'}
        </span>
        {notFound ? (
          <Link to={ROUTE_PREDICT}>← Về bảng giá</Link>
        ) : (
          <NeonButton variant="ghost" onClick={() => detail.refetch()}>
            ↻ THỬ LẠI
          </NeonButton>
        )}
      </div>
    );
  }
  if (!d) return null;

  // A3.1 — rẽ nhánh theo SỰ VẮNG MẶT của key (không phải null/[])
  const revealed = 'distribution' in d && d.distribution !== undefined;
  const distMap = new Map((d.distribution ?? []).map((e) => [e.option_id, e]));
  const open = d.status === 'open';
  const remainMs = new Date(d.lock_ts).getTime() - now;

  // ===== Bản nháp (input-side, bị chặn bởi số SERVER: bet_cap) =====
  const totalDraft = Object.values(effective).reduce((t, n) => t + n, 0);
  const maxFor = (optionId: string) =>
    Math.max(0, d.bet_cap - (totalDraft - (effective[optionId] ?? 0)));
  const allIn = d.bet_cap > 0 && totalDraft >= d.bet_cap;
  const activeAmounts = Object.values(effective).filter((n) => n > 0);
  const capUsage = d.bet_cap > 0 ? Math.min(1, totalDraft / d.bet_cap) : 0;
  const herf =
    totalDraft > 0 ? activeAmounts.reduce((t, n) => t + (n / totalDraft) ** 2, 0) : 0;
  const tier = riskTier(capUsage, herf, allIn);

  function setAmt(optionId: string, raw: number) {
    const clamped = Math.max(0, Math.min(maxFor(optionId), Math.floor(raw) || 0));
    const base = { ...effective };
    if (clamped > 0) base[optionId] = clamped;
    else delete base[optionId];
    setDraft(base);
    setClientErr('');
  }

  function submit() {
    if (!d || place.isPending) return;
    const allocations: Allocation[] = d.options
      .filter((o) => (effective[o.option_id] ?? 0) > 0)
      .map((o) => ({ option_id: o.option_id, amount: effective[o.option_id]! }));
    if (allocations.length === 0) {
      setClientErr('Chạm một cửa rồi kéo mức phân bổ trước nhé.');
      return;
    }
    setClientErr('');
    const body = JSON.stringify(allocations);
    const key = keyRef.current?.body === body ? keyRef.current.key : crypto.randomUUID();
    keyRef.current = { key, body };
    place.mutate(
      { allocations, idempotency_key: key },
      {
        onSuccess: () => {
          keyRef.current = null;
          setDraft(null);
          setOpenDoor(null);
          setJustPlaced(true); // khoảnh khắc reveal/ghi nhận
        },
      },
    );
  }

  const serverErr =
    place.error instanceof ApiError
      ? place.error.message
      : place.error
        ? 'Mất kết nối khi gửi. Bấm gửi lại — hệ thống chống trừ đôi, yên tâm.'
        : '';

  const doorsWithAmount = d.options.filter((o) => (effective[o.option_id] ?? 0) > 0);

  return (
    <div className={s.wrap}>
      <div className={s.topRow}>
        {open && remainMs > 0 && remainMs < HOUR_MS && (
          <Pill tone="accent" dot>
            {countdownLabel(remainMs)}
          </Pill>
        )}
        {d.status === 'locked' && <Pill>ĐÃ KHÓA — CHỜ NGUỒN CÔNG BỐ</Pill>}
        {(d.status === 'resolved' || d.status === 'cancelled') && (
          <Link to={`/keo/${d.market_id}/ket-qua`} className={s.resultLink}>
            <Pill tone="win">XEM KẾT QUẢ →</Pill>
          </Link>
        )}
      </div>

      <TerminalCard scanline={scan} glow={allIn ? 0.5 : 0.08}>
        <div className={s.breadcrumb}>
          <span className={s.prompt}>&gt;_</span>
          <span>
            keo/{d.market_id.slice(0, 6)} · {POOL_LABELS[d.pool].toLowerCase()} · nguồn:{' '}
            <a href={d.resolution_source_url} target="_blank" rel="noreferrer">
              {d.resolution_source_name}
            </a>{' '}
            · khóa lúc {formatLockTime(d.lock_ts)}
          </span>
        </div>
        <h1 className={s.question}>{d.question_text}</h1>

        {!revealed && (
          <div className={s.maskNote}>
            <PixelIcon name="lock" size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            <b>Đặt lần đầu để xem phân bố cộng đồng.</b> Hiện chỉ thấy tổng pool:{' '}
            {formatT(d.total_volume)}.
          </div>
        )}

        {justPlaced && (
          <div className={s.placedFlash}>
            <Pill tone="win">✓ PHÂN BỔ ĐÃ GHI</Pill>
            <span>Phân bố cộng đồng đã mở khóa — số dư cập nhật theo máy chủ.</span>
          </div>
        )}

        {open && (
          <p className={s.tapHint}>
            <span className={s.prompt}>&gt;_</span> chạm một cửa để kéo mức phân bổ
          </p>
        )}

        <div className={justPlaced ? `${s.doors} ${s.revealIn}` : s.doors}>
          {d.options.map((o) => {
            const dist = distMap.get(o.option_id);
            const amt = effective[o.option_id] ?? 0;
            const isOpenPanel = open && openDoor === o.option_id;
            const doorMax = maxFor(o.option_id);
            const doorFire = allIn && amt > 0;
            const fillPct = doorMax > 0 ? Math.round((amt / doorMax) * 100) : 0;
            return (
              <div key={o.option_id} className={s.doorBlock}>
                <DoorRow
                  label={o.label}
                  state={revealed ? 'idle' : 'masked'}
                  pct={dist?.pct ?? 0}
                  pctText={dist ? `${dist.pct}%` : undefined}
                  mineTag={amt > 0 ? `ĐẶT · ${formatT(amt)}` : undefined}
                  selectable={open}
                  selected={isOpenPanel}
                  onSelect={() => setOpenDoor(isOpenPanel ? null : o.option_id)}
                  footer={
                    // Chỉ SỐ TIỀN đang ở cửa. KHÔNG hiện tỷ lệ ăn ngụ ý và
                    // KHÔNG hiện số người (founder 19/07 — sửa A3.1): thấy "được
                    // bao nhiêu" thì người chơi tối ưu theo thưởng thay vì theo
                    // niềm tin thật → bẩn tín hiệu "% ví = độ tự tin" (A1).
                    revealed && dist ? `${formatT(dist.volume)} đang ở cửa này` : undefined
                  }
                />
                {isOpenPanel && (
                  <div className={doorFire ? `${s.sliderPanel} ${s.fire}` : s.sliderPanel}>
                    {doorFire && (
                      <>
                        <span className={s.allinTag}>HẾT TRẦN</span>
                        <span className={s.ember} style={{ left: '12%', animationDelay: '0.1s' }} />
                        <span className={s.ember} style={{ left: '38%', animationDelay: '0.6s' }} />
                        <span className={s.ember} style={{ left: '64%', animationDelay: '0.3s' }} />
                        <span className={s.ember} style={{ left: '86%', animationDelay: '0.8s' }} />
                      </>
                    )}
                    <input
                      type="range"
                      className={s.range}
                      min={0}
                      max={Math.max(doorMax, 0)}
                      step={1}
                      value={amt}
                      aria-label={`Kéo phân bổ cho ${o.label}`}
                      onChange={(e) => setAmt(o.option_id, Number(e.target.value))}
                      /*
                       * MẶT ĐƯỜNG RAY là bề mặt của VẬT → hai dải PHẲNG, không
                       * hoà sắc: ray cao 9px, một chuyển sắc trải trên 9px đọc
                       * ra cạnh nhoè chứ không ra nguồn sáng (luật 5). Vẫn giữ
                       * hai màu vì cặp màu đó là tín hiệu "đang nóng dần"; chỉ
                       * đổi cách tô — mỗi màu một nửa phần đã kéo, cắt cứng.
                       */
                      style={{
                        background: doorFire
                          ? `linear-gradient(90deg, #fb923c 0 ${fillPct / 2}%, #fde047 ${fillPct / 2}% ${fillPct}%, var(--surface-track) ${fillPct}%)`
                          : `linear-gradient(90deg, #22d3ee 0 ${fillPct / 2}%, #4ade80 ${fillPct / 2}% ${fillPct}%, var(--surface-track) ${fillPct}%)`,
                      }}
                    />
                    <div className={s.sliderRow}>
                      <input
                        className={s.numInput}
                        inputMode="numeric"
                        aria-label={`Phân bổ cho ${o.label}`}
                        placeholder="0"
                        value={amt === 0 ? '' : String(amt)}
                        onChange={(e) => setAmt(o.option_id, Number(e.target.value.replace(/\D/g, '')))}
                      />
                      <span className={s.unit}>T</span>
                      <button
                        type="button"
                        className={s.maxBtn}
                        onClick={() => setAmt(o.option_id, doorMax)}
                      >
                        MAX
                      </button>
                      <span className={s.maxInfo}>tối đa {formatT(doorMax)} (trần server)</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {revealed && (
          <div className={s.statsLine}>
            Tổng pool {formatT(d.total_volume)}
            {d.seed_per_option > 0 &&
              ` · pool có seed đệm ${formatT(d.seed_per_option)}/cửa từ hệ thống`}
          </div>
        )}

        {open ? (
          <div className={allIn ? `${s.slip} ${s.slipFire}` : s.slip}>
            <div className={s.slipHead}>
              <span className={s.slipLabel}>PHIẾU PHÂN BỔ</span>
              <span className={s.slipCap}>
                Khả dụng: {formatT(d.bankroll)} · trần câu hỏi này: {formatT(d.bet_cap)}
              </span>
            </div>

            {doorsWithAmount.length >= 2 && (
              <>
                <div className={s.splitBar} aria-hidden="true">
                  {doorsWithAmount.map((o, i) => (
                    <div
                      key={o.option_id}
                      className={s.splitSeg}
                      style={{
                        width: `${(effective[o.option_id]! / totalDraft) * 100}%`,
                        background: SEG_COLORS[i % SEG_COLORS.length],
                      }}
                    />
                  ))}
                </div>
                <div className={s.splitLegend}>
                  {doorsWithAmount.map((o, i) => (
                    <span key={o.option_id} className={s.legendItem}>
                      <span
                        className={s.legendDot}
                        style={{ background: SEG_COLORS[i % SEG_COLORS.length] }}
                      />
                      {o.label} · {formatT(effective[o.option_id]!)}
                    </span>
                  ))}
                </div>
              </>
            )}

            {totalDraft > 0 && (
              <div className={s.riskBlock}>
                <div className={s.riskRow}>
                  <span className={s.riskLabel}>KHẨU VỊ RỦI RO</span>
                  <div className={s.riskCells} aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          i < Math.round(capUsage * 10)
                            ? `${s.riskCell} ${s[`cell_${tier.cls}`]}`
                            : s.riskCell
                        }
                      />
                    ))}
                  </div>
                  <span className={`${s.riskTier} ${s[`tier_${tier.cls}`]}`}>{tier.label}</span>
                </div>
                <p className={s.riskNote}>
                  rải {activeAmounts.length} cửa · {Math.round(capUsage * 100)}% trần — chỉ để bạn
                  tự soi khẩu vị, không ảnh hưởng kết quả.
                </p>
              </div>
            )}

            <div className={s.totalRow}>
              <span className={s.totalLabel}>TỔNG PHÂN BỔ</span>
              <span className={allIn ? `${s.totalVal} ${s.totalValFire}` : s.totalVal}>
                {formatT(totalDraft)}
              </span>
            </div>

            <p className={s.slipHint}>
              Phiếu là phân bổ <b>mới toàn câu hỏi</b>: cửa để trống = rút cửa đó về 0, nhưng{' '}
              <b>tổng không được giảm</b> (token đã phân bổ không rút về ví).
            </p>
            {(clientErr || serverErr) && (
              <p className={s.errLine} role="alert">
                ✕ {clientErr || serverErr}
              </p>
            )}
            <NeonButton block disabled={place.isPending} onClick={submit}>
              {place.isPending
                ? 'ĐANG GỬI…'
                : d.my_allocation.length > 0
                  ? '▶ CẬP NHẬT PHÂN BỔ'
                  : '▶ GỬI PHÂN BỔ'}
            </NeonButton>
          </div>
        ) : (
          d.status === 'locked' && (
            <div className={s.lockedNote}>
              Câu hỏi đã khóa lúc {formatLockTime(d.lock_ts)}. Nguồn {d.resolution_source_name} công
              bố là có kết quả — trả thưởng tự động về ví.
            </div>
          )
        )}

        <p className={s.rules}>
          Rake {RAKE_PCT}% khi chốt ({BURN_PCT}% đốt · {TREA_PCT}% Kho bạc) · trần {CAP_PCT}% tài
          sản mỗi câu hỏi · tổng phân bổ không giảm trước giờ khóa
          {d.seed_per_option > 0 &&
            ` · seed ${formatT(d.seed_per_option)}/cửa minh bạch, không tính vào thống kê`}
          .
        </p>
      </TerminalCard>
    </div>
  );
}

export function MarketDetail() {
  const { marketId = '' } = useParams();
  return (
    <div className={s.wrap}>
      <AuthGate>
        <DetailInner id={marketId} />
      </AuthGate>
    </div>
  );
}
