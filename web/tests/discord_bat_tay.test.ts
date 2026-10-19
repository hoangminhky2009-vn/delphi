/**
 * BẮT TAY DISCORD — MỘT BƯỚC TREO KHÔNG ĐƯỢC ĂN CẢ MÀN HÌNH ĐẦU TIÊN.
 *
 * ⚠⚠ LỖI CÓ THẬT, đo được 04/08: `main.tsx` CHỜ bắt tay xong rồi mới render, và
 * nó bắt `throw` — nhưng **`try/catch` không bắt được TREO**. Nạp app với
 * `frame_id` mà không có Discord client thật thì `sdk.ready()` chờ một thông điệp
 * không bao giờ tới, và `#root` RỖNG VĨNH VIỄN: không lỗi, không chữ, không nút,
 * không một dòng telemetry nào.
 *
 * Đúng lớp lỗi D57 đã đặt tên ở `fetch` ("trận trông như chết"), nhưng ở chỗ tệ
 * hơn — nó ăn màn hình ĐẦU TIÊN, tức người mới không bao giờ thấy app.
 *
 * ⚠ Hai hạn giờ, và chênh lệch là CÓ CHỦ Ý (xem `config/discord.ts`): bước
 * máy-với-máy kẹp ngắn, còn `authorize` DỪNG CHỜ NGƯỜI bấm Phê duyệt nên kẹp dài.
 * Bài cuối khoá đúng chỗ đó — kẹp `authorize` bằng hạn của máy là tự tay giết hộp
 * cấp quyền, tức giết đúng cái cửa vừa mở ra được sáng 04/08.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DISCORD } from '@config/discord';
import { MAU_MA, MA_TOI_DA } from '@config/telemetry';

const ghiDo = vi.fn();
vi.mock('../src/lib/telemetry', () => ({ ghiDo: (...a: unknown[]) => ghiDo(...a) }));

/** Nạp lại module để `TRONG_DISCORD` (chốt một lần lúc nạp) đọc lại URL. */
async function napTrongDiscord() {
  window.history.replaceState({}, '', '/?frame_id=test&instance_id=test&platform=desktop');
  vi.resetModules();
  return import('../src/lib/discord');
}

/** SDK giả: mỗi lệnh trả về đúng thứ ta bảo, kể cả "không bao giờ trả lời". */
function sdkGia(opts: {
  ready?: () => Promise<unknown>;
  authorize?: () => Promise<unknown>;
}) {
  const treo = () => new Promise<never>(() => {});
  return () =>
    Promise.resolve({
      DiscordSDK: class {
        instanceId = 'i';
        channelId = 'c';
        guildId = 'g';
        ready = opts.ready ?? (async () => undefined);
        commands = {
          authorize: opts.authorize ?? (async () => ({ code: 'ma-that' })),
          authenticate: async () => undefined,
        };
        constructor(public id: string) {}
      },
      treo,
    });
}

beforeEach(() => {
  ghiDo.mockClear();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Bắt tay Discord — hạn giờ', () => {
  it('⭐ `ready()` treo → NÉM sau hạn máy, không treo mãi', async () => {
    const { batTayDiscord } = await napTrongDiscord();
    const chay = batTayDiscord({
      clientId: 'x',
      doiMa: async () => ({ accessToken: 'a', token: 't', moi: true }),
      napSdk: sdkGia({ ready: () => new Promise<never>(() => {}) }),
    });
    const bat = expect(chay).rejects.toThrow(/qua han ready/);
    await vi.advanceTimersByTimeAsync(DISCORD.HAN_BUOC_MAY_MS + 50);
    await bat;
  });

  it('…và nó KHAI RA mình chết vì im lặng, không chỉ chết ở bước nào', async () => {
    const { batTayDiscord } = await napTrongDiscord();
    const chay = batTayDiscord({
      clientId: 'x',
      doiMa: async () => ({ accessToken: 'a', token: 't', moi: true }),
      napSdk: sdkGia({ ready: () => new Promise<never>(() => {}) }),
    }).catch(() => {});
    await vi.advanceTimersByTimeAsync(DISCORD.HAN_BUOC_MAY_MS + 50);
    await chay;

    const ma = ghiDo.mock.calls.map((c) => (c[1] as any)?.chi_tiet?.ma).filter(Boolean);
    expect(ma.some((m: string) => m.includes(':ready:'))).toBe(true);
    /*
     * "chết vì bị từ chối" và "chết vì không ai trả lời" là hai bệnh khác nhau và
     * chữa khác nhau. Đọc dashboard phải phân biệt được — nếu không thì bốn dòng
     * `discord:authorize` của 04/08 lại thành bốn dòng không nói gì.
     */
    expect(ma.some((m: string) => m.includes('qua-han'))).toBe(true);
  });

  it('⚠ `authorize` KHÔNG bị kẹp bằng hạn máy — nó đang chờ NGƯỜI bấm', async () => {
    const { batTayDiscord } = await napTrongDiscord();
    let xong: ((v: { code: string }) => void) | null = null;
    const chay = batTayDiscord({
      clientId: 'x',
      doiMa: async () => ({ accessToken: 'a', token: 't', moi: true }),
      napSdk: sdkGia({ authorize: () => new Promise((r) => { xong = r as any; }) }),
    });

    // Người đọc hộp cấp quyền lâu hơn hạn của máy rất nhiều — vẫn phải sống.
    await vi.advanceTimersByTimeAsync(DISCORD.HAN_BUOC_MAY_MS * 3);
    expect(xong, 'chưa tới bước authorize').not.toBeNull();
    xong!({ code: 'ma-that' });

    await vi.advanceTimersByTimeAsync(10);
    const phien = await chay;
    expect(phien?.token).toBe('t');
  });

  it('ngoài Discord thì không bắt tay, và không ghi dòng nào', async () => {
    window.history.replaceState({}, '', '/');
    vi.resetModules();
    const { batTayDiscord } = await import('../src/lib/discord');
    expect(await batTayDiscord({ clientId: 'x', doiMa: async () => ({ accessToken: '', token: '', moi: false }) }))
      .toBeNull();
    expect(ghiDo).not.toHaveBeenCalled();
  });
});

/*
 * ══════════════════════════════════════════════════════════════════════════════
 * MÃ LỖI PHẢI ĐỌC RA ĐƯỢC LÝ DO — và phải LỌT QUA CỬA `chi_tiet`
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠⚠ Prod 04/08 ghi đúng ba dòng vô nghĩa: `discord:authorize:-object-object-`.
 * Bản vá sáng hôm đó viết `e instanceof Error ? … : String(e)` — mà SDK Discord
 * **từ chối bằng một OBJECT THUẦN**, nên `String(e)` ra `[object Object]`. Tức
 * vẫn không ai biết `authorize` chết vì sao; cái mù chỉ lùi thêm một lớp.
 *
 * ⚠ Và cửa `chi_tiet` có TRẦN 40 KÝ TỰ, máy chủ bỏ IM LẶNG khi vượt (A9). Mã dài
 * hơn thế thì mất TRỌN lý do — đúng lúc lý do dài mới là lúc nó đáng giá.
 */
describe('Mã lỗi bắt tay', () => {
  it('⭐ object thuần của SDK → đọc ra code + message, KHÔNG phải [object Object]', async () => {
    const { maLoiDiscord } = await napTrongDiscord();
    const ma = maLoiDiscord('authorize', { code: 4006, message: 'Invalid scope' });
    expect(ma).not.toContain('object');
    expect(ma).toContain('4006');
  });

  it('mọi hình dạng ném đều lọt qua cửa `chi_tiet` (MAU_MA, trần 40)', async () => {
    const { maLoiDiscord } = await napTrongDiscord();
    const nem: unknown[] = [
      { code: 4006, message: 'Invalid scope' },
      { error: 'Người dùng đã TỪ CHỐI cấp quyền cho ứng dụng này' },
      new Error('RPC_CLOSE: the connection was closed unexpectedly and at length'),
      'chuỗi trần',
      { la: 1, chua: 2, tung: 3 },
      null,
      undefined,
    ];
    for (const e of nem) {
      for (const buoc of ['nap-sdk', 'khoi-tao', 'ready', 'authorize', 'doi-ma', 'authenticate']) {
        const ma = maLoiDiscord(buoc, e);
        expect(ma.length, `quá trần ⇒ máy chủ bỏ im lặng: ${ma}`).toBeLessThanOrEqual(MA_TOI_DA);
        expect(MAU_MA.test(ma), `sai hình dạng ⇒ bỏ im lặng: ${ma}`).toBe(true);
      }
    }
  });

  /*
   * Founder hỏi *"sao không mở được trên discord mobile"* và telemetry hôm đó
   * KHÔNG trả lời được: mọi dòng giống hệt nhau dù từ máy tính hay điện thoại.
   */
  it('mã mang theo NỀN TẢNG — nếu không thì câu hỏi mobile không hỏi được', async () => {
    window.history.replaceState({}, '', '/?frame_id=t&instance_id=t&platform=android');
    vi.resetModules();
    const mb = (await import('../src/lib/discord')).maLoiDiscord('ready', new Error('x'));
    expect(mb.startsWith('dc.mb:')).toBe(true);

    window.history.replaceState({}, '', '/?frame_id=t&instance_id=t&platform=desktop');
    vi.resetModules();
    const pc = (await import('../src/lib/discord')).maLoiDiscord('ready', new Error('x'));
    expect(pc.startsWith('dc.pc:')).toBe(true);
  });
});
