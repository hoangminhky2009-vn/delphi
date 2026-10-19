/**
 * Ví & lịch sử — màn 4/6, dữ liệu THẬT (GET /wallet phân trang cursor +
 * POST /subsidy/claim). A3.10: mỗi dòng ledger có lý do; nhóm theo ngày chỉ là
 * trình bày. Nút trợ cấp chỉ HIỆN khi bankroll < 500 (server vẫn là gác cổng).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ECONOMY } from '@config/economy';
import { ApiError } from '@/api/client';
import { useSubsidyClaim, useWallet } from '@/api/queries';
import type { WalletEntry, WalletReason } from '@/api/types';
import { WALLET_REASON_LABELS } from '@/lib/labels';
import { formatDeltaT, formatT } from '@/lib/money';
import { formatDay, formatFull } from '@/lib/time';
import { useRevealed } from '@/lib/seen';
import { ROUTE_SHOP } from '@/lib/vocab';
import { AuthGate } from '@/components/AuthGate';
import { FilterRow, NeonButton, PixelIcon, Pill } from '@/components/ui';
import s from './Wallet.module.css';

type ReasonFilter = 'all' | WalletReason;

/** Filter theo loại (spec GĐ5 màn 4) — API nhận 1 reason/lần nên mỗi loại một chip. */
const REASON_OPTIONS: { value: ReasonFilter; label: string }[] = [
  { value: 'all', label: 'TẤT CẢ' },
  { value: 'payout', label: 'TRẢ THƯỞNG' },
  { value: 'bet_place', label: 'PHÂN BỔ' },
  { value: 'bet_adjust', label: 'ĐIỀU CHỈNH' },
  { value: 'subsidy', label: 'TRỢ CẤP' },
  { value: 'refund', label: 'HOÀN' },
  { value: 'signup_grant', label: 'VỐN' },
];

// Điều kiện HIỆN nút (UX) — server vẫn là gác cổng; số từ MỘT nguồn chân lý (A4)
const SUBSIDY_VISIBLE_BELOW = ECONOMY.SUBSIDY_THRESHOLD;

function groupByDay(entries: WalletEntry[]): [string, WalletEntry[]][] {
  const groups = new Map<string, WalletEntry[]>();
  for (const e of entries) {
    const day = formatDay(e.created_at);
    const list = groups.get(day) ?? [];
    list.push(e);
    groups.set(day, list);
  }
  return [...groups.entries()];
}

function WalletInner() {
  const [reason, setReason] = useState<ReasonFilter>('all');
  const wallet = useWallet(true, reason === 'all' ? null : reason);
  const claim = useSubsidyClaim();
  /*
   * CHỐNG LỘ KẾT QUẢ (chỉ đạo founder 19/07 + 20/07).
   * Sổ ví từng phun thẳng "Nhận từ pool ▲ +253 T" kèm link sang đúng câu hỏi —
   * người chơi biết trước mình được bao nhiêu thì lễ công bố thành vô nghĩa,
   * không ai buồn bấm. Màn Kết quả đã chặn, nhưng ví thì quên.
   * Chỉ giấu dòng `payout` của kèo CHƯA công bố; `refund` (kèo hủy) không giấu
   * vì hủy thì hoàn 100%, không có gì để hồi hộp.
   * KHÔNG thể giấu tuyệt đối — số dư tổng vẫn đúng và người kiên trì vẫn trừ
   * được từ hai dòng kề. Mục tiêu là không dí con số vào mặt, không phải mã hoá.
   */
  const revealed = useRevealed();

  if (wallet.isPending)
    return <div className="skeleton" style={{ height: 220 }} aria-busy="true" />;
  if (wallet.isError) {
    return (
      <div className={s.errBox} role="alert">
        <span>Không tải được ví. Kiểm tra mạng rồi thử lại nhé.</span>
        <NeonButton variant="ghost" onClick={() => wallet.refetch()}>
          ↻ THỬ LẠI
        </NeonButton>
      </div>
    );
  }

  const pages = wallet.data.pages;
  const bankroll = pages[0]?.bankroll ?? 0; // số server — C4
  const entries = pages.flatMap((p) => p.entries);
  const claimErr = claim.error instanceof ApiError ? claim.error.message : '';

  return (
    <>
      <div className={s.balanceCard}>
        <span className={s.balanceLabel}>SỐ DƯ KHẢ DỤNG</span>
        <span className={s.balanceValue}>{formatT(bankroll)}</span>
        {bankroll < SUBSIDY_VISIBLE_BELOW && (
          <div className={s.subsidyRow}>
            {claim.isSuccess ? (
              <Pill tone="win">✓ +{formatT(claim.data.amount)} trợ cấp đã vào ví</Pill>
            ) : (
              <>
                <NeonButton
                  variant="ghost"
                  disabled={claim.isPending}
                  onClick={() => claim.mutate()}
                >
                  {/* ⛑ (mũ cứu hộ) đổi sang lưới `shield`: cùng nghĩa "lưới an
                      toàn", nhưng vẽ bằng lưới của mình thay vì để font hệ điều
                      hành quyết định — trên iPhone ký tự đó ra hình MÀU. */}
                  {claim.isPending ? 'ĐANG NHẬN…' : (
                    <>
                      <PixelIcon name="shield" size={16} className={s.nutIcon} />
                      {' '}NHẬN TRỢ CẤP NGÀY (+{formatT(ECONOMY.SUBSIDY_AMOUNT)})
                    </>
                  )}
                </NeonButton>
                {claimErr && (
                  <span className={s.claimErr} role="alert">
                    {claimErr}
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <FilterRow options={REASON_OPTIONS} value={reason} onChange={setReason} label="Lọc theo loại" />

      {entries.length === 0 ? (
        <div className={s.errBox}>
          <span>
            {reason === 'all' ? (
              <>
                {/* D86: chợ dự báo đóng băng — ví T mùa này sống bằng trợ cấp
                    + quà + Shop, nên lời mời trỏ sang Shop. */}
                Chưa có giao dịch nào. Nhận trợ cấp ngày hoặc ghé{' '}
                <Link to={ROUTE_SHOP}>Shop</Link> nhé.
              </>
            ) : (
              'Chưa có giao dịch loại này.'
            )}
          </span>
        </div>
      ) : (
        groupByDay(entries).map(([day, list]) => (
          <div key={day} className={s.dayGroup}>
            <div className={s.dayLabel}>{day}</div>
            {list.map((e) => {
              const sealed =
                e.reason === 'payout' && !!e.ref_market_id && !revealed.has(e.ref_market_id);
              return (
                <div key={e.entry_id} className={s.entry}>
                  <div className={s.entryMain}>
                    <span className={s.entryReason}>
                      {WALLET_REASON_LABELS[e.reason] ?? e.reason}
                      {e.ref_market_id && (
                        <>
                          {' '}
                          <Link
                            className={s.entryLink}
                            to={
                              e.reason === 'payout' || e.reason === 'refund'
                                ? `/keo/${e.ref_market_id}/ket-qua`
                                : `/keo/${e.ref_market_id}`
                            }
                          >
                            {sealed ? 'công bố kết quả →' : 'xem câu hỏi →'}
                          </Link>
                        </>
                      )}
                    </span>
                    <span className={s.entryTime} title={formatFull(e.created_at)}>
                      {formatFull(e.created_at)}
                    </span>
                  </div>
                  <div className={s.entryNums}>
                    {sealed ? (
                      <>
                        <span className={s.sealed}>▲ ••• T</span>
                        <span className={s.balanceAfter}>chưa công bố</span>
                      </>
                    ) : (
                      <>
                        <span className={e.delta >= 0 ? s.deltaUp : s.deltaDown}>
                          {formatDeltaT(e.delta)}
                        </span>
                        <span className={s.balanceAfter}>dư {formatT(e.balance_after)}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {wallet.hasNextPage && (
        <NeonButton
          variant="ghost"
          block
          disabled={wallet.isFetchingNextPage}
          onClick={() => wallet.fetchNextPage()}
        >
          {wallet.isFetchingNextPage ? 'ĐANG TẢI…' : '↓ TẢI THÊM'}
        </NeonButton>
      )}

      {/*
        Ô CHỪA CHO ĐIỂM QUEST (Q) — hiện khi hệ Q lên sóng.
        Cố ý là một Ô TRỐNG CÓ NHÃN chứ không phải số 0: Q chưa có nguồn phát nào
        trong repo, in "0 Q" là bịa một loại tiền đang tồn tại. Và ghi thẳng câu
        "không có đường quy đổi" ngay đây, vì đó là tường lửa A3.5 — người chơi
        cần biết trước, không phải phát hiện sau khi cày.
      */}
      <div className={s.oQ}>
        <span className={s.oQNhan}>ĐIỂM QUEST (Q)</span>
        <span className={s.oQCho}>
          <PixelIcon name="lock" size={16} className={s.nutIcon} />
          {' '}Chưa mở. Q và token T <b>không có đường quy đổi</b> nào — hai loại tách hẳn.
        </span>
      </div>
    </>
  );
}

export function Wallet() {
  return (
    <div className={s.wrap}>
      <AuthGate>
        <WalletInner />
      </AuthGate>
    </div>
  );
}
