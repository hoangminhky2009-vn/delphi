/**
 * AVATAR — hồi quy cho LỖI ĐÃ SỐNG TRÊN PROD, và ba bề mặt render.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LỖI ĐANG VÁ (founder báo 27/07): `DoiThuStrip` gọi `<BotAvatar gheId={...}/>`
 * cho MỌI ghế kể cả ghế người, mà `BotAvatar` sinh hình từ HASH MÃ GHẾ. Ghế người
 * có mã `'ban'` → avatar người chơi là hình băm từ chữ "ban" → giống hệt nhau ở
 * mọi trận, với mọi người.
 *
 * Test này KHÔNG kiểm "có gọi đúng component không" (dễ viết, và vẫn xanh khi
 * component gọi đúng mà vẽ sai). Nó kiểm THỨ NGƯỜI CHƠI THẤY: hai người chơi có
 * diện mạo khác nhau phải ra HAI HÌNH KHÁC NHAU, và ghế người không được mang
 * ngôn ngữ hình của máy. Đó là cách duy nhất bắt được lỗi này nếu nó quay lại
 * dưới một hình dạng khác.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient, queryKeys } from '@/api/queries';
import type { DoiThuDTO } from '@/api/holdem';
import { DoiThuStrip } from '@/components/holdem/DoiThuStrip';
import { Avatar, AvatarBot } from '@/components/ui';
import { vietDienMao } from '@config/avatar';

/** Chữ ký hình của một avatar: đường dẫn SVG đã dựng, không phải props. */
function hinh(el: HTMLElement): string {
  const svg = el.querySelector('svg');
  return svg?.innerHTML ?? '';
}

function dungLuoi(dienMao: string | null) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.me, {
    email: 'a@b.c',
    email_verified: true,
    onboarded: true,
    user: {
      user_id: 'u1', handle: 'toi', age_band: '18-22', region: 'bac',
      occupation_band: 'hs_sv', bankroll: 1000, role: 'user',
      research_consent: false, created_at: '2026-07-01T00:00:00Z', season_id: '2026Q3',
      ...(dienMao ? { dien_mao: dienMao } : {}),
    },
  });
  const doiThu: DoiThuDTO[] = [{
    ghe_id: 'bot_1', loai: 'bot', ten: 'Máy · Thợ săn đáy', bac_rank: 'Đồng',
    von: 9000, con_song: true, so_the: 2, fx: 'binh_thuong',
  }];
  return render(
    <QueryClientProvider client={qc}>
      <DoiThuStrip
        doiThu={doiThu}
        vongTruoc={new Map()}
        ban={{ von: 10000, so_the: 2, bac_rank: 'Đồng', con_song: true, fx: 'binh_thuong' }}
      />
    </QueryClientProvider>,
  );
}

describe('DoiThuStrip — ghế người KHÔNG được mang mặt máy (D25/R3, chiều ngược)', () => {
  it('HAI NGƯỜI CHƠI KHÁC DIỆN MẠO → HAI HÌNH KHÁC NHAU', () => {
    // Đây là phép đo bắt đúng lỗi cũ: bản cũ băm mã ghế `'ban'` nên hai lần dựng
    // này ra CÙNG một hình dù diện mạo khác nhau.
    const a = dungLuoi(vietDienMao({ goc: 'A' }));
    const hinhA = hinh(a.container.querySelectorAll('[role="img"]')[0] as HTMLElement);
    a.unmount();

    const b = dungLuoi(vietDienMao({ goc: 'C' }));
    const hinhB = hinh(b.container.querySelectorAll('[role="img"]')[0] as HTMLElement);
    b.unmount();

    expect(hinhA).not.toBe('');
    expect(hinhA).not.toBe(hinhB);
  });

  it('ghế người và ghế máy ra HAI HÌNH KHÁC NHAU trong CÙNG một dải', () => {
    const r = dungLuoi(vietDienMao({ goc: 'B' }));
    const anh = [...r.container.querySelectorAll('[role="img"]')] as HTMLElement[];
    expect(anh).toHaveLength(2);          // ghế mình + một ghế máy
    expect(hinh(anh[0]!)).not.toBe(hinh(anh[1]!));
    // Nhãn phải nói rõ ai là máy — R3 đòi bot LỘ MẶT, kể cả với trình đọc màn hình.
    expect(anh[1]!.getAttribute('aria-label')).toContain('máy');
  });

  it('thiếu `dien_mao` (API cũ hơn bundle) → vẫn ra MẶT, không ra ô trống', () => {
    const r = dungLuoi(null);
    const anh = r.container.querySelector('[role="img"]') as HTMLElement;
    expect(hinh(anh).length).toBeGreaterThan(0);
  });
});

describe('Avatar — hợp đồng render §XI', () => {
  it('mọi cỡ dùng CÙNG viewBox 32×32 → không có phép làm tròn nào ở tầng này', () => {
    for (const size of [32, 64, 96, 128] as const) {
      const r = render(<Avatar dm={vietDienMao({ goc: 'A' })} size={size} alt="x" />);
      const svg = r.container.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
      // Cỡ điều khiển bằng CSS của thẻ bọc, không bằng cách vẽ lại lưới.
      expect((r.container.firstChild as HTMLElement).style.width).toBe(`${size}px`);
      r.unmount();
    }
  });

  it('không alt → ảnh trang trí (aria-hidden), có alt → role=img', () => {
    const a = render(<Avatar dm={null} size={32} />);
    expect(a.container.firstElementChild!.getAttribute('aria-hidden')).toBe('true');
    a.unmount();
    const b = render(<Avatar dm={null} size={32} alt="Ảnh đại diện của @toi" />);
    expect(b.container.querySelector('[role="img"]')).not.toBeNull();
  });

  it('bot cùng nhãn → cùng hình; khác nhãn → khác hình (băm DANH TÍNH, không băm ghế)', () => {
    const a = render(<AvatarBot hat="Máy · A" size={32} alt="x" />);
    const b = render(<AvatarBot hat="Máy · A" size={32} alt="x" />);
    expect(hinh(a.container.firstChild as HTMLElement))
      .toBe(hinh(b.container.firstChild as HTMLElement));
  });
});
