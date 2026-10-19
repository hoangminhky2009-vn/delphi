/**
 * LỜI KHAI SỰ CỐ `su_co_khai` — phía client (D93, founder 16/08 "dán nhãn").
 *
 * Bàn đấu THẬT qua route thật (bẫy số 1 của repo: hook đẹp mà không ai gọi).
 * Kịch bản là đúng cái nó sinh ra để tả: server không tới được ở hai cú nộp
 * đầu, cú thứ ba mới tới — cú đó PHẢI mang `su_co_khai: {2, 'network'}`.
 *
 * ⚠ Bẫy đã tính trước, khoá bằng chính bài này: sau mỗi cú nộp hỏng màn gọi
 * `dongBoLaiTuServer` (GET) và cú GET đó đóng dấu lại `dhNeo.luc`. Nếu cửa sổ
 * đếm sự cố neo vào `dhNeo.luc` thì mốc nhảy lên SAU mỗi lần hỏng và lời khai
 * luôn rỗng ở đúng ca nó sinh ra để tả. Cửa sổ phải neo vào LẦN ĐẦU THẤY VÒNG.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { ME_ONBOARDED, renderAt, stubFetch } from './helpers';
import { resetCamBienMang } from '../src/api/mang';

const CATALOG = {
  engine_version: 'holdem-test-sc', balance_version: 'balance-test',
  luat: {
    SEATS: 5, START_VON: 10000, CAM_KET_NEN: 500, MAX_TAI_SAN: 4,
    MAX_CHIEN_THUAT: 2, SHOP_TAI_SAN: 3, SHOP_CHIEN_THUAT: 2,
    CHI_PHI_KHAO_SAT_LAI: 2, TRAN_TANG_CAM_KET_BP: 4000, PHI_BANG_DIEN_TU: 25,
  },
  nhip_chon_bai: ['tai_san', 'tai_san', 'chien_thuat', 'tai_san', 'tai_san',
    'chien_thuat', 'khong', 'khong'],
  cap_stack_bp: [10000, 16000, 20000],
  quyet_dinh: { MAP_SIZE: 8, SHOWDOWN_MODEL: 'A' },
  tai_san: [{ id: 'btc', label: 'BTC', icon: '₿', nhom: 'rui_ro', thanh_khoan: 'mong', bien_dong_bp: 400 }],
  chien_thuat: [], giai_doan: [{ id: 'di_ngang', label: 'Đi ngang', icon: '➖' }], su_kien: [],
  tu_dien: { tai_san: {}, chien_thuat: {} }, khau_vi: [],
};

const tran = (patch: Record<string, unknown> = {}) => ({
  match_id: 'm-sc', vong: 4, tong_vong: 8, status: 'dang_choi',
  // Đã chạm 0, server CHƯA tuyên hết giờ ⇒ client tự nộp sau 10s.
  dong_ho: { con_lai_s: 0, tong_s: 25, het_gio: false, an_han_s: 8 },
  ban: {
    von: 9000, luot_khao_sat: 1, danh_muc: { tai_san: ['btc'], chien_thuat: [] },
    da_chay: false, tu_the: 'choi', vong_roi: null, so_lan_cat_lo: 0, con_lai_cat_lo: 1,
    khau_vi: 'can_bang', fx: 'binh_thuong',
  },
  doi_thu: [], so_nguoi_song: 1,
  o_hien_tai: { kind: 'giai_doan', giai_doan: 'di_ngang' }, lich_su_o: [], telegraph: null,
  bo_bai_con_lai: { con_lai: 5, so_giai_doan: 3, so_su_kien: 2, tin_gia_ky_vong: 1 },
  quy_vong_hien_tai: 500, shop: null, loi_von: null, ...patch,
});

describe('su_co_khai — bàn đấu thật', () => {
  it('⭐ hai cú nộp rớt mạng rồi cú thứ ba tới ⇒ cú thứ ba khai {2, network}; cửa sổ KHÔNG bị resync xoá', async () => {
    resetCamBienMang();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const calls = stubFetch([
        ['/auth/me', { status: 200, body: ME_ONBOARDED }],
        ['/holdem/catalog', { status: 200, body: CATALOG }],
        ['/holdem/art', { status: 200, body: { version: 'holdem-test-sc', art: {} } }],
        ['/holdem/matches/m-sc/rounds', {
          failFirst: 2,
          status: 200,
          body: {
            ...tran(), vong: 5, tu_dong: true,
            ket_qua_vong: {
              vong: 4, o: { kind: 'giai_doan', giai_doan: 'di_ngang' },
              tin_gia_lo: null, quy_vong: 500, ghe_thang: 'ban', chay_vong_nay: [],
              cua_ban: null, cua_doi_thu: [], phi_cua_ban: null, ty_le_cat_lo_bp: 0,
            },
          },
        }],
        ['/holdem/matches/m-sc', { status: 200, body: tran() }],
      ]);
      renderAt('/arena/tran/m-sc');
      await screen.findByText(/còn \d+ ô/);

      const posts = () => calls.filter((c) => c.method === 'POST' && c.url.includes('/rounds'));
      // Ba chu kỳ "chờ 10s → nộp → (hỏng → resync GET) → chờ 10s…". Cho dư thời gian.
      for (let i = 0; i < 6 && posts().length < 3; i += 1) {
        await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });
      }
      const p = posts().map((c) => c.body as { su_co_khai?: unknown });
      expect(p.length, 'phải có ≥3 cú POST: hai hỏng + một tới').toBeGreaterThanOrEqual(3);

      // Cú đầu: chưa có gì để khai ⇒ KHÔNG gửi trường (server phân biệt vắng mặt).
      expect(p[0]!.su_co_khai, 'cú đầu chưa hỏng lần nào — không được bịa').toBeUndefined();
      // Cú thứ ba (sau hai lần rớt): khai đúng số lần + lỗi cuối.
      expect(p[2]!.su_co_khai,
        'cửa sổ đếm bị resync GET đặt lại ⇒ lời khai rỗng ở đúng ca nó sinh ra để tả')
        .toEqual({ so_lan_hong: 2, loi_cuoi: 'network' });
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
