/**
 * KHỐI LỘ TRÌNH Ở HUB — test THỨ NGƯỜI CHƠI ĐỌC ĐƯỢC, không test props.
 *
 * Ba thứ được canh ở đây, và cả ba là YÊU CẦU THIẾT KẾ chứ không phải chi tiết
 * hiện thực:
 *
 *  1. Khi trần tuần đã chạm, app PHẢI NÓI RA "chơi thêm không cộng thêm". Cơ chế
 *     chống spam chỉ hoạt động nếu người chơi biết nó tồn tại — không nói thì họ
 *     vẫn cày, và ta mất cả dữ liệu sạch lẫn thiện chí.
 *  2. Nút điểm danh KHOÁ khi hôm nay đã điểm danh (trần 1 lần/ngày phải thấy
 *     được, không phải một lỗi 409 lúc bấm).
 *  3. Con số hiển thị là SỐ SERVER TRẢ (C4). Test đưa một trạng thái vô lý về mặt
 *     số học (chặng 7 nhưng Q = 0) và đòi UI hiện đúng thế — nếu UI tự suy Q từ
 *     chặng thì nó sẽ hiện 420 và test đỏ.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { routes } from '@/app/routes';
import { makeQueryClient, queryKeys } from '@/api/queries';

interface LoTrinhTest {
  mua_mo: boolean;
  tuan: number | null;
  so_tuan: number;
  chang: number;
  so_chang: number;
  quest_points: number;
  viec: Array<{ nv_id: string; ten: string; muc: number; da: number; xong: boolean }>;
  da_diem_danh_hom_nay: boolean;
  moc: Array<{
    chang_no: number; q: number; nhan: string | null; doc_ban: boolean;
    da_nhan: boolean; cho_art: boolean;
  }>;
}

const VIEC_MAU = [
  { nv_id: 'co_mat', ten: 'Điểm danh 4 ngày trong tuần', muc: 4, da: 2, xong: false },
  { nv_id: 'xem_xet', ten: 'Xem xét ít nhất 1 câu hỏi dự báo', muc: 1, da: 1, xong: true },
  { nv_id: 'mot_tran', ten: 'Chơi xong 1 phiên Đấu trường', muc: 1, da: 0, xong: false },
  { nv_id: 'doc_lai', ten: 'Mở lại 1 câu hỏi đã chốt', muc: 1, da: 0, xong: false },
  { nv_id: 'phu_ba_nhom', ten: 'Ghé cả 3 nhóm câu hỏi', muc: 3, da: 1, xong: false },
];

function duLieu(over: Partial<LoTrinhTest> = {}): LoTrinhTest {
  return {
    mua_mo: true, tuan: 2, so_tuan: 8, chang: 7, so_chang: 30, quest_points: 0,
    viec: VIEC_MAU, da_diem_danh_hom_nay: false,
    moc: [
      { chang_no: 7, q: 60, nhan: null, doc_ban: false, da_nhan: true, cho_art: false },
      { chang_no: 8, q: 0, nhan: 'Khung móc neo', doc_ban: false, da_nhan: false, cho_art: false },
    ],
    ...over,
  };
}

/**
 * ⚠ 22/08 — BỘ BÀI NÀY DỜI TỪ HUB SANG TRANG /hanh-trinh, KHÔNG XOÁ MỘT BÀI NÀO.
 *
 * Founder gỡ khối lộ trình khỏi đầu Hub (*"để ở đầu trang bất hợp lý về UI-UX
 * quá… làm 1 phần riêng như phần nhiệm vụ ngày trong TFT"*). Nhưng thứ các bài
 * này canh — hiện ĐÚNG số server trả, tiến độ "đã/mức", nút điểm danh khoá khi
 * đã điểm danh, mốc CHỜ ART nói thật, HẾT VIỆC nói rõ trần — không hề mất hiệu
 * lực: nó chuyển chỗ sang trang riêng. Xoá bài theo component là mất luôn phần
 * bảo vệ, và đó là cách một luật im lặng biến mất.
 */
function dungTrangMua(lt: LoTrinhTest, path = '/hanh-trinh') {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.me, {
    email: 'a@b.c', email_verified: true, onboarded: true,
    user: {
      user_id: 'u1', handle: 'toi', age_band: '18-22', region: 'bac',
      occupation_band: 'hs_sv', bankroll: 1000, role: 'user',
      research_consent: false, created_at: '2026-07-01T00:00:00Z', season_id: '2026Q3',
    },
  });
  qc.setQueryData(['nhiem-vu'], lt);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Trang MÙA (/hanh-trinh) · lộ trình mùa 0.0', () => {
  it('hiện chặng, tuần và Q ĐÚNG SỐ SERVER TRẢ (không tự suy)', async () => {
    dungTrangMua(duLieu({ quest_points: 0 }));
    expect(await screen.findByText('CHẶNG 7/30')).toBeTruthy();
    expect(screen.getByText('TUẦN 2/8')).toBeTruthy();
    // Chặng 7 mà 0 Q là vô lý về số học — và UI vẫn phải hiện 0, vì nó không
    // được phép tính tiền (C4).
    expect(screen.getByText(/^0 Q$/)).toBeTruthy();
  });

  it('mỗi việc hiện tiến độ dạng "đã/mức", không phải dấu tích suông', async () => {
    dungTrangMua(duLieu());
    expect(await screen.findByText('Điểm danh 4 ngày trong tuần')).toBeTruthy();
    expect(screen.getByText('2/4')).toBeTruthy();
    expect(screen.getByText('1/3')).toBeTruthy();
  });

  it('CHƯA hết việc thì KHÔNG nói câu "cày thêm không có thêm"', async () => {
    dungTrangMua(duLieu());
    expect(await screen.findByText('CHẶNG 7/30')).toBeTruthy();
    expect(screen.queryByText(/cày thêm không có thêm/)).toBeNull();
  });

  it('HẾT việc tuần này thì NÓI RÕ trần — cơ chế tự giải thích mình', async () => {
    dungTrangMua(duLieu({ viec: VIEC_MAU.map((v) => ({ ...v, da: v.muc, xong: true })) }));
    expect(await screen.findByText(/cày thêm không có thêm/)).toBeTruthy();
  });

  it('đã điểm danh hôm nay ⟹ nút KHOÁ và nói rõ, không để bấm rồi mới lỗi', async () => {
    dungTrangMua(duLieu({ da_diem_danh_hom_nay: true }));
    const nut = await screen.findByRole('button', { name: 'ĐÃ ĐIỂM DANH HÔM NAY' });
    expect((nut as HTMLButtonElement).disabled).toBe(true);
  });

  it('mốc kế hiện TRƯỚC khi đạt (trả lời "chơi để làm gì")', async () => {
    dungTrangMua(duLieu());
    expect(await screen.findByText(/mốc kế: chặng 8/)).toBeTruthy();
    expect(screen.getByText(/Khung móc neo/)).toBeTruthy();
  });

  it('mốc CHỜ ART nói rõ là chờ, không giả vờ là phần thưởng đã có', async () => {
    dungTrangMua(duLieu({
      moc: [{
        chang_no: 10, q: 0, nhan: 'Nhãn dán #3', doc_ban: true,
        da_nhan: false, cho_art: true,
      }],
    }));
    expect(await screen.findByText(/chờ art/)).toBeTruthy();
    expect(screen.getByText('ĐỘC BẢN')).toBeTruthy();
  });

  it('mùa chưa mở ⟹ nói thẳng, không hiện khối rỗng gây hỏi', async () => {
    dungTrangMua(duLieu({ mua_mo: false }));
    expect(await screen.findByText(/Mùa chưa mở/)).toBeTruthy();
    expect(screen.queryByText(/CHẶNG/)).toBeNull();
  });

  /*
   * ⭐ HUB PHẢI SẠCH (founder 22/08). Bài này là thứ giữ cho khối lộ trình không
   * "bò về" đầu Hub trong một lần refactor nào đó: Hub chỉ còn CỬA (bốn module),
   * mọi số liệu mùa nằm ở trang riêng.
   *
   * ⚠ 11/10 (SPEC `ui-tang-khong-gian`, Hub bento): Hub nay CÓ MỘT ô Mùa gọn — "việc tuần x/y" + chip điểm danh, đọc từ ĐÚNG khoá cache
   * này (không thêm request); chạm ô = lớp trượt. Bài này vẫn đúng và vẫn canh thứ nó sinh ra để canh: KHỐI lộ trình cũ (tiêu đề · chặng ·
   * nút điểm danh) KHÔNG bò về mặt Hub. Phần ô Mùa mới có bài riêng ở `hub_bento.test.tsx`.
   */
  it('⭐ HUB không còn khối lộ trình — dữ liệu mùa chỉ ở trang riêng (§XIX)', async () => {
    dungTrangMua(duLieu(), '/');
    // Hub vẫn dựng bình thường (bốn module).
    expect(await screen.findByText(/Token T không có giá trị thật/)).toBeTruthy();
    expect(screen.queryByText(/LỘ TRÌNH MÙA/)).toBeNull();
    expect(screen.queryByText('CHẶNG 7/30')).toBeNull();
    expect(screen.queryByRole('button', { name: /ĐIỂM DANH/ })).toBeNull();
  });

  it('bấm điểm danh gọi ĐÚNG một POST và lấy trạng thái mới từ server', async () => {
    const goi: Array<{ url: string; method: string }> = [];
    const qc = makeQueryClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      goi.push({ url, method: init?.method ?? 'GET' });
      /*
       * ⚠ TRẢ THEO URL, không trả một hình dạng cho MỌI đường. Trang MÙA còn gọi
       * `/me/qua-beta`; nhét payload lộ trình vào đó thì khối quà đọc `q.qua.t`
       * trên một object không có trường ấy và ném ngay lúc render — bài đỏ với
       * một cái error boundary, không liên quan gì tới thứ đang được canh.
       */
      if (!url.includes('/me/nhiem-vu')) {
        return new Response(JSON.stringify({ error: 'not_found' }),
          { status: 404, headers: { 'content-type': 'application/json' } });
      }
      return new Response(
        JSON.stringify({ moi: true, ...duLieu({ chang: 8, quest_points: 60, tuan: 2 }) }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };
    qc.setQueryData(queryKeys.me, {
      email: 'a@b.c', email_verified: true, onboarded: true,
      user: {
        user_id: 'u1', handle: 'toi', age_band: '18-22', region: 'bac',
        occupation_band: 'hs_sv', bankroll: 1000, role: 'user',
        research_consent: false, created_at: '2026-07-01T00:00:00Z', season_id: '2026Q3',
      },
    });
    qc.setQueryData(['nhiem-vu'], duLieu());
    const router = createMemoryRouter(routes, { initialEntries: ['/hanh-trinh'] });
    render(
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'ĐIỂM DANH' }));
    expect(await screen.findByText('CHẶNG 8/30')).toBeTruthy();
    /*
     * Lọc lô đo lường (A9) ra khỏi phép đếm: nó bắn ở `AppShell` nên có mặt ở
     * mọi màn được render, còn câu đang khẳng định là về lệnh NGHIỆP VỤ — "bấm
     * điểm danh gọi ĐÚNG MỘT POST". Đếm cả telemetry là đổi câu hỏi thành
     * "trang này gửi bao nhiêu request", làm yếu đúng thứ test này canh.
     */
    const post = goi.filter((g) => g.method === 'POST' && !g.url.includes('/telemetry'));
    expect(post.length).toBe(1);
    expect(post[0]!.url).toContain('/me/nhiem-vu/diem-danh');
  });
});
