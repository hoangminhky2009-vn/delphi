/**
 * MODULE PREDICT MARKET — danh sách kèo → đặt → chờ → công bố → lịch sử,
 * tất cả trong MỘT màn có hai lớp lọc. Gộp từ `Lobby.tsx` + `ResultsList.tsx`
 * (cả hai gỡ 25/07/2026).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * VÌ SAO GỘP: hai màn cũ trùng ~85% — ResultsList import THẲNG
 * `Lobby.module.css`, sao y `type Filter` + `FILTER_OPTIONS`, dùng cùng hook
 * `useMarkets`, cùng markup card. Khác nhau đúng MỘT thứ: mảng `statuses`.
 * Đó là một lớp lọc, chưa bao giờ đáng hai màn và hai ô nav.
 *
 * ⚠ HAI LẦN GỌI useMarkets, KHÔNG PHẢI MỘT LẦN 4-STATUS.
 * Gộp thành một request `['open','locked','resolved','cancelled']` thì queryKey
 * đổi → Hub (dùng key `['markets','all','open,locked']`) không share cache nữa
 * → thêm một request mỗi lần vào Hub. Đúng thứ ngân sách D11 cấm (1M req/tháng,
 * sảnh KHÔNG polling). Nên: giữ nguyên hai mảng statuses cũ, chỉ hợp nhất UI.
 *
 * ⚠ MẶC ĐỊNH LÀ "ĐANG MỞ". Kèo đã chốt không được trộn vào danh sách đang mở —
 * vừa loãng, vừa phá spec GĐ5 ("sảnh chỉ open+locked").
 *
 * A3.1 giữ nguyên: danh sách KHÔNG BAO GIỜ hiện phân bố (API cũng không trả).
 * ±T chỉ lộ SAU khi user tự bấm công bố ở màn lễ (chỉ đạo founder 19/07) —
 * gate bằng `useRevealed`, không phải bằng ý chí.
 */
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMarkets, useMyResults } from '@/api/queries';
import type { MarketDetail, MarketSummary, Pool } from '@/api/types';
import { POOL_LABELS } from '@/lib/labels';
import { formatDeltaT, formatT } from '@/lib/money';
import { formatLockTime } from '@/lib/time';
import { useNow } from '@/lib/hooks';
import { useRevealed } from '@/lib/seen';
import { AuthGate } from '@/components/AuthGate';
import { FilterRow, NeonButton, Pill } from '@/components/ui';
import { PREDICT_POOL_PARAM, PREDICT_TAB_DONE, PREDICT_TAB_PARAM } from '@/lib/vocab';
import s from './PredictMarket.module.css';

type PoolFilter = 'all' | Pool;

const POOL_OPTIONS: { value: PoolFilter; label: string }[] = [
  { value: 'all', label: 'TẤT CẢ' },
  { value: 'macro', label: POOL_LABELS.macro },
  { value: 'life', label: POOL_LABELS.life },
  { value: 'event', label: POOL_LABELS.event },
];

const HOUR_MS = 60 * 60_000;

function StatusPill({ m, now }: { m: MarketSummary; now: number }) {
  if (m.status === 'resolved') return <Pill tone="win">CÓ KẾT QUẢ</Pill>;
  if (m.status === 'cancelled') return <Pill tone="lose">ĐÃ HỦY — HOÀN 100%</Pill>;
  if (m.status === 'locked') return <Pill>CHỜ KẾT QUẢ</Pill>;
  const soon = new Date(m.lock_ts).getTime() - now < HOUR_MS;
  // Cùng tông accent (gold chỉ dành cho hiệu ứng đặc biệt — doc mục 2)
  return (
    <Pill tone="accent" dot>
      {soon ? 'SẮP KHÓA' : 'ĐANG MỞ'}
    </Pill>
  );
}

function lockLabel(m: MarketSummary, now: number): string {
  if (m.status !== 'open') return `Khóa lúc ${formatLockTime(m.lock_ts)}`;
  const remain = new Date(m.lock_ts).getTime() - now;
  if (remain > 0 && remain < HOUR_MS) {
    // Không icon đồng hồ: ⏳ là emoji do font HĐH vẽ (đơn sắc trên Windows, màu
    // trên iOS), mà chữ "còn ~N phút" đã nói đủ nghĩa — icon chỉ là lớp thừa.
    return `còn ~${Math.max(1, Math.round(remain / 60_000))} phút`;
  }
  return `Khóa lúc ${formatLockTime(m.lock_ts)}`;
}

/** Pill ±T của riêng tôi — chỉ ở nhóm ĐÃ CHỐT, và chỉ sau khi đã xem lễ. */
function MyNetPill({ net, revealed }: { net: number | undefined; revealed: boolean }) {
  if (net === undefined) return null;
  if (!revealed) {
    return (
      <Pill tone="accent" dot>
        CHỜ CÔNG BỐ
      </Pill>
    );
  }
  if (net === 0) return <Pill>HOÀN VỐN</Pill>;
  return <Pill tone={net > 0 ? 'win' : 'lose'}>{formatDeltaT(net)}</Pill>;
}

function MarketCard({
  m, now, placed, net, revealed,
}: {
  m: MarketSummary;
  now: number;
  placed: boolean;
  net?: number;
  revealed: boolean;
}) {
  const done = m.status === 'resolved' || m.status === 'cancelled';
  return (
    <Link to={done ? `/keo/${m.market_id}/ket-qua` : `/keo/${m.market_id}`} className={s.card}>
      <div className={s.cardTop}>
        <StatusPill m={m} now={now} />
        <Pill>{POOL_LABELS[m.pool]}</Pill>
        {placed && !done && <Pill tone="accent">ĐÃ ĐẶT</Pill>}
        {done && <MyNetPill net={net} revealed={revealed} />}
        <span className={s.source}>Nguồn: {m.resolution_source_name}</span>
      </div>
      <div className={s.question}>{m.question_text}</div>
      <div className={s.cardFoot}>
        <span>{lockLabel(m, now)}</span>
        {/* KHÔNG hiện số người (founder 19/07 — sửa A3.1): chỉ tổng tiền trong pool */}
        <span>{formatT(m.total_volume)}</span>
      </div>
    </Link>
  );
}

function PredictInner() {
  // Lớp lọc TRẠNG THÁI nằm trên URL, không phải useState: redirect từ
  // `/ket-qua` mang theo `?tt=chot`, và người chơi share được đúng lớp đang xem.
  const [params, setParams] = useSearchParams();
  const xongTab = params.get(PREDICT_TAB_PARAM) === PREDICT_TAB_DONE;
  const pool = (params.get(PREDICT_POOL_PARAM) as PoolFilter | null) ?? 'all';

  const now = useNow(30_000); // đếm ngược nhãn card — không gọi mạng
  const qc = useQueryClient();

  // Hai query, ĐÚNG hai mảng statuses cũ → giữ chung cache với Hub (xem docstring)
  const dangMo = useMarkets(pool, ['open', 'locked'], !xongTab);
  const daChot = useMarkets(pool, ['resolved', 'cancelled'], xongTab);
  const q = xongTab ? daChot : dangMo;

  const results = useMyResults(xongTab);
  const revealed = useRevealed();

  const netById = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of results.data ?? []) map.set(r.market_id, r.net);
    return map;
  }, [results.data]);

  // Badge "ĐÃ ĐẶT" — §2.2: đọc CACHE chi tiết đã ghé (my_allocation), KHÔNG gọi
  // per-card (D11). Chấp nhận: chỉ chính xác sau khi từng vào kèo.
  const placedIds = useMemo(() => {
    const set = new Set<string>();
    for (const [, data] of qc.getQueriesData<MarketDetail>({ queryKey: ['market'] })) {
      if (data && data.my_allocation.length > 0) set.add(data.market_id);
    }
    return set;
    // q.dataUpdatedAt: tính lại mỗi lần danh sách refetch/quay lại màn
  }, [qc, q.dataUpdatedAt]);

  function doiTab(sangXong: boolean): void {
    const next = new URLSearchParams(params);
    if (sangXong) next.set(PREDICT_TAB_PARAM, PREDICT_TAB_DONE);
    else next.delete(PREDICT_TAB_PARAM);
    setParams(next, { replace: true });
  }

  function doiPool(v: PoolFilter): void {
    const next = new URLSearchParams(params);
    if (v === 'all') next.delete(PREDICT_POOL_PARAM);
    else next.set(PREDICT_POOL_PARAM, v);
    setParams(next, { replace: true });
  }

  const tabs = (
    <div className={s.tabRow} role="tablist" aria-label="Trạng thái câu hỏi">
      <button
        type="button"
        role="tab"
        aria-selected={!xongTab}
        className={[s.tab, xongTab ? '' : s.tabOn].filter(Boolean).join(' ')}
        onClick={() => doiTab(false)}
      >
        ĐANG MỞ
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={xongTab}
        className={[s.tab, xongTab ? s.tabOn : ''].filter(Boolean).join(' ')}
        onClick={() => doiTab(true)}
      >
        ĐÃ CHỐT
      </button>
    </div>
  );

  if (q.isPending) {
    return (
      <>
        {tabs}
        <div className={s.list} aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 110 }} />
          ))}
        </div>
      </>
    );
  }
  if (q.isError) {
    return (
      <>
        {tabs}
        <div className={s.empty} role="alert">
          <span>Không tải được bảng giá. Kiểm tra mạng rồi thử lại nhé.</span>
          <NeonButton variant="ghost" onClick={() => q.refetch()}>
            ↻ THỬ LẠI
          </NeonButton>
        </div>
      </>
    );
  }

  const all = q.data.markets;

  // ── Nhóm ĐÃ CHỐT ────────────────────────────────────────────────────
  if (xongTab) {
    // Phòng thủ: màn này tuyệt đối không được lộ kèo đang mở như thể có kết quả
    const list = all.filter((m) => m.status === 'resolved' || m.status === 'cancelled');
    return (
      <>
        {tabs}
        <div className={s.topRow}>
          <div className={s.breadcrumb}>
            <span className={s.prompt}>&gt;_</span>
            <span>kết quả · {list.length} câu hỏi đã chốt</span>
          </div>
        </div>

        <FilterRow options={POOL_OPTIONS} value={pool} onChange={doiPool} label="Pool" />

        {list.length === 0 && (
          <div className={s.empty}>
            <span className={s.prompt}>&gt;_</span> chưa có câu hỏi nào chốt — xem{' '}
            <button type="button" className={s.nutChu} onClick={() => doiTab(false)}>
              bảng giá đang mở
            </button>{' '}
            nhé.
          </div>
        )}

        <div className={s.list}>
          {list.map((m) => (
            <MarketCard
              key={m.market_id}
              m={m}
              now={now}
              placed={false}
              net={netById.get(m.market_id)}
              revealed={revealed.has(m.market_id)}
            />
          ))}
        </div>
      </>
    );
  }

  // ── Nhóm ĐANG MỞ ────────────────────────────────────────────────────
  const open = all.filter((m) => m.status === 'open');
  const locked = all.filter((m) => m.status === 'locked');

  return (
    <>
      {tabs}
      <div className={s.topRow}>
        <div className={s.breadcrumb}>
          <span className={s.prompt}>&gt;_</span>
          <span>bảng giá · {open.length} câu hỏi đang mở</span>
        </div>
        <NeonButton
          variant="ghost"
          onClick={() => q.refetch()}
          disabled={q.isRefetching}
          aria-label="Làm mới bảng giá"
        >
          ↻
        </NeonButton>
      </div>

      <FilterRow options={POOL_OPTIONS} value={pool} onChange={doiPool} label="Pool" />

      {open.length + locked.length === 0 && (
        <div className={s.empty}>
          <span className={s.prompt}>&gt;_</span> chưa có câu hỏi nào trong pool này — quay lại sau
          nhé.
        </div>
      )}

      {open.length > 0 && (
        <div className={s.list}>
          {open.map((m) => (
            <MarketCard
              key={m.market_id}
              m={m}
              now={now}
              placed={placedIds.has(m.market_id)}
              revealed={false}
            />
          ))}
        </div>
      )}

      {locked.length > 0 && (
        <>
          <div className={s.sectionLabel}>ĐÃ KHÓA — CHỜ NGUỒN CÔNG BỐ</div>
          <div className={s.list}>
            {locked.map((m) => (
              <MarketCard
                key={m.market_id}
                m={m}
                now={now}
                placed={placedIds.has(m.market_id)}
                revealed={false}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function PredictMarket() {
  return (
    <div className={s.wrap}>
      <AuthGate>
        <PredictInner />
      </AuthGate>
    </div>
  );
}
