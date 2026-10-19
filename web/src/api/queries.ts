/**
 * Server-state qua TanStack Query — nối API THẬT theo docs/ui-ux/gd5_ui_technical_directives.md.
 * Kỷ luật request (D11, ngân sách 1M/tháng):
 *  - Sảnh: fetch khi vào màn / focus lại tab — KHÔNG polling.
 *  - GET /markets/:id ghi event market_view — CHỈ gọi khi user mở màn chi tiết,
 *    tuyệt đối không dùng để polling (polling đi đường /pool).
 *  - C4: mọi con số tiền là số server trả; sau khi đặt, ví cập nhật từ RESPONSE.
 */
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { api, ApiError } from './client';
import type {
  MarketDetail,
  MarketsResponse,
  MarketStatus,
  MeResponse,
  MyResultEntry,
  MyStats,
  PlaceBetsRequest,
  PlaceBetsResponse,
  Pool,
  PoolSnapshot,
  ProgressResponse,
  SubsidyClaimResponse,
  WalletReason,
  WalletResponse,
} from './types';
import { marketPollIntervalMs, usePageVisible } from './polling';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 15_000,
        refetchOnWindowFocus: false, // mặc định tiết kiệm; query nào cần sẽ tự bật
      },
    },
  });
}

/** Khóa query tập trung — thêm màn mới thì thêm ở đây, không rải chuỗi tay. */
export const queryKeys = {
  me: ['me'] as const,
  markets: (pool: Pool | 'all', statuses: string) => ['markets', pool, statuses] as const,
  market: (id: string) => ['market', id] as const,
  marketPool: (id: string) => ['market-pool', id] as const,
  wallet: ['wallet'] as const,
  myStats: ['my-stats'] as const,
  myResults: ['my-results'] as const,
  progress: ['progress'] as const,
  rank: ['rank'] as const,
  forecastBoards: ['forecast-boards'] as const,
};

/** Tiến độ xếp hạng Đấu trường — `GET /me/rank`. Trả về nguyên payload của server. */
export interface RankResponse {
  season_id: string;
  diem: number;
  diem_dinh: number;
  so_tran: number;
  bac: string;
  bac_ten: string;
  bac_biet_danh: string;
  bac_icon: string;
  bac_icon_lon: string;
  nac: number | null;
  con_thieu_diem: number | null;
  con_thieu_tran: number;
  hang: number | null;
  phan_vi: number | null;
  /** Id các bậc đã nhận sticker vinh danh TRONG MÙA NÀY. Vắng (máy chủ cũ) ⇒ coi như chưa nhận ô nào. */
  sticker_da_nhan?: string[];
  formula_version: string;
  bang_bat: boolean;
}

export interface BangDuBaoResponse {
  dong: {
    hang: number; user_id: string; handle: string;
    so?: number; k?: number; n?: number; pct?: number;
  }[];
  tong: number;
  computed_at: string | null;
  cua_toi: { hang: number; phan_vi: number } | null;
}

export interface ForecastBoardsResponse {
  mua: string;
  so_luong: BangDuBaoResponse;
  do_chinh_xac: BangDuBaoResponse;
}

/** Phiên hiện tại; null = khách. 401 không phải lỗi — là trạng thái. */
export function useMe() {
  return useQuery<MeResponse | null>({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await api<MeResponse>('/auth/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
  });
}

/** Ghi đè bankroll trong cache me từ số SERVER trả (C4 — không tự cộng trừ). */
export function applyServerBankroll(qc: QueryClient, bankroll: number): void {
  qc.setQueryData<MeResponse | null>(queryKeys.me, (old) =>
    old?.user ? { ...old, user: { ...old.user, bankroll } } : old,
  );
}

// ============================== Sảnh ==============================

/** Danh sách kèo theo status (sảnh: open,locked · màn kết quả: resolved,cancelled). Không polling. */
export function useMarkets(pool: Pool | 'all', statuses: MarketStatus[], enabled: boolean) {
  const statusStr = statuses.join(',');
  const search = new URLSearchParams({ status: statusStr });
  if (pool !== 'all') search.set('pool', pool);
  return useQuery<MarketsResponse>({
    queryKey: queryKeys.markets(pool, statusStr),
    queryFn: () => api(`/markets?${search.toString()}`),
    enabled,
    refetchOnWindowFocus: true, // chỉ đạo §3: fetch khi focus lại tab
    staleTime: 15_000,
  });
}

// =========================== Chi tiết kèo ===========================

/**
 * GET /markets/:id — server GHI EVENT market_view mỗi lần gọi (dữ liệu nghiên cứu).
 * staleTime Infinity + refetchOnMount 'always': đúng 1 lần mỗi lần MỞ màn,
 * không bao giờ refetch ngầm; cập nhật sau đó đến từ /pool và response đặt.
 */
export function useMarketDetail(id: string, enabled: boolean) {
  return useQuery<MarketDetail>({
    queryKey: queryKeys.market(id),
    queryFn: () => api(`/markets/${id}`),
    enabled,
    staleTime: Infinity,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: (count, err) => (!(err instanceof ApiError) || err.chuaToiMayChu) && count < 1,
  });
}

/**
 * Polling /pool theo bậc thang D11 — CHỈ khi đã đặt + kèo open + tab hiển thị.
 * Kết quả merge vào cache chi tiết (một nguồn hiển thị duy nhất cho màn).
 */
export function useMarketPoolPolling(detail: MarketDetail | undefined) {
  const qc = useQueryClient();
  const visible = usePageVisible();
  const id = detail?.market_id ?? '';
  const hasBet = (detail?.my_allocation.length ?? 0) > 0;
  const active = Boolean(detail) && hasBet && detail!.status === 'open' && visible;

  return useQuery<PoolSnapshot>({
    queryKey: queryKeys.marketPool(id),
    queryFn: async () => {
      const snap = await api<PoolSnapshot>(`/markets/${id}/pool`);
      qc.setQueryData<MarketDetail>(queryKeys.market(id), (old) =>
        old
          ? {
              ...old,
              status: snap.status,
              lock_ts: snap.lock_ts,
              total_volume: snap.total_volume,
              distribution: snap.distribution,
            }
          : old,
      );
      return snap;
    },
    enabled: active,
    refetchOnWindowFocus: true, // quay lại tab → fetch ngay một phát rồi vào nhịp
    refetchInterval: () => {
      if (!detail) return false;
      return marketPollIntervalMs(Date.now(), new Date(detail.lock_ts).getTime(), {
        hasBet,
        visible,
      });
    },
    staleTime: 0,
    retry: false,
  });
}

/**
 * Đặt/điều chỉnh phân bổ (declarative). Idempotency (§2.3): key sinh mỗi lần
 * user bấm gửi, GIỮ NGUYÊN khi retry lỗi mạng (retry tự động 2 lần cùng body).
 * Thành công (kể cả replayed) → đồng bộ cache từ RESPONSE (C4).
 */
export function usePlaceBets(marketId: string) {
  const qc = useQueryClient();
  return useMutation<PlaceBetsResponse, Error, PlaceBetsRequest>({
    mutationFn: (body) => api(`/markets/${marketId}/bets`, { method: 'POST', body }),
    // Gửi lại CHỈ khi request chưa tới được máy chủ — xem `ApiError.chuaToiMayChu`.
    retry: (count, err) => (!(err instanceof ApiError) || err.chuaToiMayChu) && count < 2,
    retryDelay: 300, // mạng chập → thử lại nhanh, CÙNG key + body (server idempotent)
    onSuccess: (res) => {
      qc.setQueryData<MarketDetail>(queryKeys.market(marketId), (old) =>
        old
          ? {
              ...old,
              bankroll: res.bankroll,
              bet_cap: res.bet_cap,
              my_allocation: res.my_allocation,
              total_volume: res.total_volume,
              distribution: res.distribution,
            }
          : old,
      );
      applyServerBankroll(qc, res.bankroll);
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

// ============================== Ví ==============================

export function useWallet(enabled: boolean, reason: WalletReason | null = null) {
  return useInfiniteQuery<WalletResponse>({
    // prefix ['wallet'] giữ nguyên để invalidateQueries theo queryKeys.wallet quét hết
    queryKey: [...queryKeys.wallet, reason ?? 'all'],
    queryFn: ({ pageParam }) =>
      api(
        `/wallet?limit=20${pageParam ? `&before=${pageParam as number}` : ''}${
          reason ? `&reason=${reason}` : ''
        }`,
      ),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.next_before,
    enabled,
    refetchOnWindowFocus: true,
  });
}

export function useSubsidyClaim() {
  const qc = useQueryClient();
  return useMutation<SubsidyClaimResponse, Error, void>({
    mutationFn: () => api('/subsidy/claim', { method: 'POST' }),
    onSuccess: (res) => {
      applyServerBankroll(qc, res.bankroll);
      void qc.invalidateQueries({ queryKey: queryKeys.wallet });
    },
  });
}

// ================= §2.5 — backend ship đầu GĐ5 =================
// Endpoint có thể CHƯA tồn tại (404) → trả null, UI ẩn phần đó thay vì vỡ màn.

export function useMyStats(enabled: boolean) {
  return useQuery<MyStats | null>({
    queryKey: queryKeys.myStats,
    queryFn: async () => {
      try {
        return await api<MyStats>('/me/stats');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}

export function useMyResults(enabled: boolean) {
  return useQuery<MyResultEntry[] | null>({
    queryKey: queryKeys.myResults,
    queryFn: async () => {
      try {
        const res = await api<MyResultEntry[] | { results: MyResultEntry[] }>('/me/results');
        return Array.isArray(res) ? res : res.results;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Bậc + điểm xếp hạng Đấu trường của CHÍNH CHỦ.
 *
 * Không polling: điểm chỉ đổi sau một trận Giải xếp hạng, tức sau một hành động
 * của chính người chơi. `staleTime` dài là đúng — đây không phải số dư.
 * 404 → null để màn tự ẩn khối thay vì vỡ (cùng lối useMyStats/useProgress).
 */
export function useRank(enabled: boolean) {
  return useQuery<RankResponse | null>({
    queryKey: queryKeys.rank,
    queryFn: async () => {
      try {
        return await api<RankResponse>('/me/rank');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 120_000,
    retry: false,
  });
}

/**
 * Hai bảng dự báo (D32). Đọc từ SNAPSHOT nên rẻ, nhưng vẫn `staleTime` dài: bảng
 * được dựng lại mỗi 10 phút, gọi dày hơn thế chỉ tốn request mà không có số mới.
 */
export function useForecastBoards(enabled: boolean) {
  return useQuery<ForecastBoardsResponse | null>({
    queryKey: queryKeys.forecastBoards,
    queryFn: async () => {
      try {
        return await api<ForecastBoardsResponse>('/boards/forecast');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 300_000,
    retry: false,
  });
}

/**
 * Oracle Level + Bậc dự báo. Chỉ số DẪN XUẤT nên không cần polling: nó chỉ đổi
 * khi có kèo chốt hoặc trận xong, tức là sau một hành động của chính người chơi.
 * staleTime dài + invalidate ở chỗ đặt lệnh là đủ; đây không phải số dư.
 *
 * 404 → null để UI ẩn khối thay vì vỡ màn (cùng lối với useMyStats).
 */
export function useProgress(enabled: boolean) {
  return useQuery<ProgressResponse | null>({
    queryKey: queryKeys.progress,
    queryFn: async () => {
      try {
        return await api<ProgressResponse>('/me/progress');
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    enabled,
    staleTime: 120_000,
    retry: false,
  });
}

/** DÒNG TOKEN của chính mình, gộp theo lý do sổ cái — trang Tài chính cá nhân. */
export interface DongToken {
  dong: { reason: string; vao: number; ra: number; so_but_toan: number }[];
}

export function useDongToken(enabled: boolean) {
  return useQuery<DongToken>({
    queryKey: ['me', 'dong-token'],
    queryFn: () => api<DongToken>('/me/dong-token'),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
}
