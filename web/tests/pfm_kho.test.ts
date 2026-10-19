/**
 * PFM — KHO Ở MÁY USER (nhóm C, tầng nền). D194.
 *
 * ⭐⭐ HÌNH DẠNG CỦA FILE NÀY LÀ CHÍNH LUẬN ĐIỂM: §I chạy **ĐÚNG MỘT BỘ KHẲNG ĐỊNH TRÊN
 * CẢ HAI NỀN** (bộ nhớ + IndexedDB thật qua `fake-indexeddb`). Viết hai bộ test song
 * song cho hai bản cài đặt là cách chắc chắn nhất để chúng trôi khỏi nhau mà vẫn xanh —
 * đúng bệnh D61, và ở đây cú trôi im lặng tuyệt đối vì người dùng không biết đáng lẽ sổ
 * phải có bao nhiêu dòng.
 *
 *   §I   HỢP ĐỒNG — một bộ, hai nền.
 *   §II  MỘT NGUỒN LỌC — quét mã nguồn, cấm bản IndexedDB tự lọc.
 *   §III THÁNG là đơn vị của két (K10) + bẫy ngày địa phương.
 *   §IV  BIA MỘ ≠ XOÁ SẠCH (P9 🔒).
 */
import 'fake-indexeddb/auto';
import { describe, expect, it, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  KhoTrongBoNho, locSo, thangCua, kiemBanGhi, LoiKho, NGAN, PHIEN_BAN_KHO,
  type BanGhi, type KhoPfm,
} from '../src/pfm/kho.js';
import { moKho } from '../src/pfm/kho_idb.js';

const b = (id: string, thang: string, suaLuc: string, d: unknown = { x: 1 }):
BanGhi<unknown> => ({ id, thang, suaLuc, d });

/* ══════════════════════════════════════════════════════════════════════════════
 * §I — HỢP ĐỒNG: một bộ khẳng định, hai nền
 * ════════════════════════════════════════════════════════════════════════════ */

const NEN: [string, () => Promise<KhoPfm>][] = [
  ['bộ nhớ', async () => new KhoTrongBoNho()],
  ['IndexedDB', async () => {
    // Kho mới mỗi bài: fake-indexeddb giữ state giữa các lượt mở trong cùng file.
    await new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase('delphi_pfm_u1');
      r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
    });
    return moKho('u1');
  }],
];

describe.each(NEN)('§I — HỢP ĐỒNG KHO trên nền %s', (_ten, dung) => {
  let k: KhoPfm;
  beforeEach(async () => { k = await dung(); });

  it('ghi rồi đọc lại ra ĐÚNG bản ghi', async () => {
    await k.ghi('khoan', b('k1', '2026-08', '2026-08-31T10:00:00.000Z', { ten: 'cà phê' }));
    const ra = await k.doc<{ ten: string }>('khoan', 'k1');
    expect(ra?.d.ten).toBe('cà phê');
    expect(await k.doc('khoan', 'khong-co')).toBeNull();
  });

  it('các ngăn KHÔNG nhìn thấy nhau (cùng id, khác ngăn)', async () => {
    // Nếu ngăn rò sang nhau thì một cái hũ có thể đè một khoản chi cùng id — và cú đè
    // đó im lặng vì cả hai đều là object hợp lệ.
    await k.ghi('khoan', b('trung', '2026-08', 'T1'));
    await k.ghi('hu', b('trung', '2026-08', 'T2'));
    expect((await k.doc('khoan', 'trung'))?.suaLuc).toBe('T1');
    expect((await k.doc('hu', 'trung'))?.suaLuc).toBe('T2');
  });

  it('⭐ lọc theo THÁNG — nền nào cũng ra cùng một tập', async () => {
    await k.ghiLo('khoan', [
      b('a', '2026-07', 'T1'), b('b', '2026-08', 'T2'), b('c', '2026-08', 'T3'),
    ]);
    expect((await k.liet('khoan', { thang: '2026-08' })).map((x) => x.id))
      .toEqual(['b', 'c']);
    expect((await k.liet('khoan')).length).toBe(3);
  });

  it('⭐ thứ tự là TẤT ĐỊNH kể cả khi trùng mốc sửa', async () => {
    // Trùng `suaLuc` xảy ra thật: một cú ghi lô đặt cùng một mốc cho cả lô. Không kẹp
    // thêm `id` thì thứ tự phụ thuộc cách nền duyệt, và khôi phục két hai lần ra hai
    // kết quả khác nhau.
    await k.ghiLo('khoan', [b('z', '2026-08', 'T5'), b('a', '2026-08', 'T5')]);
    expect((await k.liet('khoan')).map((x) => x.id)).toEqual(['a', 'z']);
  });

  it('`suaTu` chỉ lấy phần MỚI (nền của đồng bộ tăng dần)', async () => {
    await k.ghiLo('khoan', [
      b('cu', '2026-08', '2026-08-01T00:00:00.000Z'),
      b('moi', '2026-08', '2026-08-20T00:00:00.000Z'),
    ]);
    const ra = await k.liet('khoan', { suaTu: '2026-08-10T00:00:00.000Z' });
    expect(ra.map((x) => x.id)).toEqual(['moi']);
  });

  it('⭐ XOÁ để lại BIA MỘ — mặc định khuất, nhưng `ket/` phải thấy được', async () => {
    // Xoá thật ngay thì cú xoá KHÔNG lan được: khôi phục két trên máy khác sẽ thấy bản
    // ghi cũ "sống lại" vì không có gì nói rằng nó đã bị bỏ.
    await k.ghi('khoan', b('k1', '2026-08', 'T1'));
    await k.xoa('khoan', 'k1', 'T9');
    expect(await k.doc('khoan', 'k1')).toBeNull();
    expect(await k.liet('khoan')).toEqual([]);
    const cuc = await k.liet('khoan', { keCaDaXoa: true });
    expect(cuc.map((x) => x.id)).toEqual(['k1']);
    expect(cuc[0]!.daXoa).toBe(true);
    expect(cuc[0]!.suaLuc, 'bia mộ phải mang mốc MỚI, không thì nó không đồng bộ đi đâu')
      .toBe('T9');
  });

  it('xoá thứ không tồn tại là VÔ HẠI, không dựng bia mộ ma', async () => {
    await k.xoa('khoan', 'chua-tung-co', 'T9');
    expect(await k.liet('khoan', { keCaDaXoa: true })).toEqual([]);
  });

  it('⭐ `xoaHan` xoá SẠCH DẤU VẾT — không bia mộ, và chỉ dành cho hàng đợi', async () => {
    /*
     * Bia mộ tồn tại để cú xoá LAN ĐI sang máy khác qua két. Hàng đợi `outbox` thì cố ý
     * KHÔNG vào két, nên bia mộ ở đó chẳng lan đi đâu — nó chỉ để lại một đống xác
     * dòng-đã-gửi phình vô hạn trên máy user. Với ngăn có dữ liệu thật thì ngược lại:
     * xoá hẳn là làm cú xoá không lan được, và bản ghi "sống lại" khi khôi phục.
     */
    await k.ghi('outbox', b('o1', '2026-08', 'T1'));
    await k.xoaHan('outbox', 'o1');
    expect(await k.liet('outbox', { keCaDaXoa: true }), 'không còn một dấu vết nào')
      .toEqual([]);
    await k.xoaHan('outbox', 'khong-co');   // vô hại
  });

  it('`dem` đếm đúng thứ `liet` trả — không đếm cả bia mộ', async () => {
    await k.ghiLo('khoan', [b('a', '2026-08', 'T1'), b('b', '2026-08', 'T2')]);
    await k.xoa('khoan', 'a', 'T3');
    expect(await k.dem('khoan')).toBe(1);
    expect(await k.dem('khoan', { keCaDaXoa: true })).toBe(2);
  });

  it('⭐ lô là ALL-OR-NOTHING: một bản ghi hỏng ⇒ không dòng nào vào', async () => {
    await expect(k.ghiLo('khoan', [
      b('tot', '2026-08', 'T1'),
      { id: 'xau', thang: 'khong-phai-thang', suaLuc: 'T2', d: {} },
    ])).rejects.toThrow(LoiKho);
    expect(await k.liet('khoan'), 'bản hợp lệ cũng KHÔNG được vào').toEqual([]);
  });

  it('lô RỖNG không nổ', async () => {
    await k.ghiLo('khoan', []);
    expect(await k.liet('khoan')).toEqual([]);
  });

  it('⭐ `xoaSach` xoá THẬT, không để lại bia mộ (P9 🔒)', async () => {
    // Bia mộ ở đây chính là thứ user vừa bảo xoá. Đây là lối ra một chiều.
    for (const n of NGAN) await k.ghi(n, b(`${n}-1`, '2026-08', 'T1'));
    await k.xoaSach();
    for (const n of NGAN) {
      expect(await k.liet(n, { keCaDaXoa: true }), `ngăn ${n} còn sót`).toEqual([]);
    }
  });

  it('ghi thiếu tháng / thiếu mốc sửa bị chặn NGAY LÚC GHI', async () => {
    // Chặn lúc đọc thì lỗi nổ ở tuần sau, chỗ khác, và không lần ra ai đã ghi nó.
    await expect(k.ghi('khoan', { id: 'x', thang: '2026-13', suaLuc: 'T1', d: {} }))
      .rejects.toThrow(LoiKho);
    await expect(k.ghi('khoan', { id: 'x', thang: '2026-08', suaLuc: '', d: {} }))
      .rejects.toThrow(LoiKho);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §II — MỘT NGUỒN LỌC
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§II — bản IndexedDB không được tự nghĩ (D61)', () => {
  const nguon = fs.readFileSync(
    path.resolve(__dirname, '../src/pfm/kho_idb.ts'), 'utf8');
  /** Bỏ chú thích trước khi quét: chính đoạn giải thích vì-sao-cấm có chứa từ bị cấm. */
  const ma = nguon.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('⭐ không tự `.filter` / `.sort` / `.slice` — mọi phép lọc đi qua `locSo`', () => {
    for (const tu of ['.filter(', '.sort(', '.slice(']) {
      expect(ma.includes(tu), `kho_idb.ts tự lọc bằng "${tu}"`).toBe(false);
    }
    expect(ma).toContain('locSo(');
  });

  it('không dùng `store.count()` — nó không biết bia mộ, sẽ ra số khác `liet`', () => {
    expect(ma).not.toContain('.count(');
  });

  it('⭐ có xử lý `onblocked` và `onversionchange` (bẫy T6 — nâng cấp treo câm)', () => {
    // Không có hai cái này thì một tab cũ làm lượt nâng cấp TREO VÔ HẠN, không lỗi,
    // không log. Người dùng chỉ thấy màn hình đứng im.
    expect(ma).toContain('onblocked');
    expect(ma).toContain('onversionchange');
  });

  it('mọi ngăn khai trong `kho.ts` đều được tạo store (không sót ngăn câm)', () => {
    // Sót một ngăn thì mọi thao tác lên nó ném "NotFoundError" — ở đúng tính năng ít
    // dùng nhất, tức lộ muộn nhất.
    expect(ma).toContain('for (const n of NGAN)');
    expect(ma).toContain('createObjectStore');
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §III — THÁNG LÀ ĐƠN VỊ CỦA KÉT (K10)
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§III — tháng', () => {
  it('cắt đúng tháng từ ngày ĐỊA PHƯƠNG', () => {
    expect(thangCua('2026-08-31')).toBe('2026-08');
    expect(thangCua('2026-08-31T23:30:00+07:00')).toBe('2026-08');
    expect(thangCua('2026-01-01')).toBe('2026-01');
  });

  it('⭐ tháng vô lý là LỖI, không phải im lặng cắt bừa', () => {
    // Cắt bừa thì bản ghi rơi vào một lát SAI, và nếu lát đó đã niêm phong thì nó biến
    // mất khỏi mọi phép tính mà không ai báo.
    expect(() => thangCua('2026-13-01')).toThrow(LoiKho);
    expect(() => thangCua('hôm nay')).toThrow(LoiKho);
    expect(() => thangCua('2026-00-05')).toThrow(LoiKho);
  });

  it('phiên bản kho là số dương — đổi hình dạng ngăn phải tăng nó', () => {
    expect(PHIEN_BAN_KHO).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(PHIEN_BAN_KHO)).toBe(true);
  });

  it('`locSo` là hàm THUẦN — không đụng mảng gốc', () => {
    const tat = [b('z', '2026-08', 'T2'), b('a', '2026-08', 'T1')];
    const truoc = tat.map((x) => x.id);
    locSo(tat, {});
    expect(tat.map((x) => x.id), 'sort() tại chỗ sẽ xáo mảng của người gọi')
      .toEqual(truoc);
  });

  it('`tran` cắt SAU khi sắp, không phải trước', () => {
    // Cắt trước khi sắp là trả về "5 bản ghi bất kỳ", không phải "5 bản ghi cũ nhất".
    const tat = [b('c', '2026-08', 'T3'), b('a', '2026-08', 'T1'), b('b', '2026-08', 'T2')];
    expect(locSo(tat, { tran: 2 }).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('`kiemBanGhi` bắt đủ ba thiếu sót', () => {
    expect(() => kiemBanGhi({ id: '', thang: '2026-08', suaLuc: 'T', d: {} })).toThrow();
    expect(() => kiemBanGhi({ id: 'x', thang: '26-8', suaLuc: 'T', d: {} })).toThrow();
    expect(() => kiemBanGhi({ id: 'x', thang: '2026-08', suaLuc: '', d: {} })).toThrow();
    expect(() => kiemBanGhi(b('x', '2026-08', 'T'))).not.toThrow();
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
 * §V — NÂNG CẤP v1→v2 (GĐ5, thêm ngăn `luat`): KHÔNG MẤT DỮ LIỆU CŨ
 * ════════════════════════════════════════════════════════════════════════════ */

describe('§V — nâng cấp kho từ bản CŨ (v1, chưa có ngăn luat) không mất gì', () => {
  const TEN_DB = 'delphi_pfm_u1';   // D603: tên kho mang user_id — `tenKho('u1')`
  /** Đúng hình dạng v1 ĐÓNG BĂNG (KHÔNG đọc từ `NGAN` hiện tại — đó là cả điểm của bài này). */
  const NGAN_V1 = ['khoan', 'hu', 'mau_lap', 'nhip', 'outbox', 'meta'] as const;

  beforeEach(async () => {
    await new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase(TEN_DB);
      r.onsuccess = () => ok(); r.onerror = () => ok(); r.onblocked = () => ok();
    });
  });

  it('⭐ dựng DB ở v1 (như trước GĐ5), có dữ liệu thật trong `hu` — nâng cấp lên v2 vẫn còn nguyên', async () => {
    // Bước 1 — dựng thủ công một DB v1, ĐÚNG như code trước GĐ5 đã tạo (không có `luat`).
    await new Promise<void>((ok, loi) => {
      const yc = indexedDB.open(TEN_DB, 1);
      yc.onupgradeneeded = () => {
        const d = yc.result;
        for (const n of NGAN_V1) {
          const s = d.createObjectStore(n, { keyPath: 'id' });
          s.createIndex('thang', 'thang', { unique: false });
          s.createIndex('suaLuc', 'suaLuc', { unique: false });
        }
      };
      yc.onsuccess = () => {
        const tx = yc.result.transaction('hu', 'readwrite');
        tx.objectStore('hu').put(b('hu-cu', '2026-08', '2026-08-01T00:00:00.000Z', { ten: 'Du lịch' }));
        tx.oncomplete = () => { yc.result.close(); ok(); };
        tx.onerror = () => loi(tx.error);
      };
      yc.onerror = () => loi(yc.error);
    });

    // Bước 2 — mở bằng ĐÚNG hàm production (`moKho`, ở PHIEN_BAN_KHO hiện tại = 2).
    const k2 = await moKho('u1');

    // Ngăn CŨ còn nguyên dữ liệu — đây là thứ đắt nhất phải đúng của một cuộc nâng cấp.
    const cu = await k2.doc<{ ten: string }>('hu', 'hu-cu');
    expect(cu?.d.ten, 'nâng cấp không được đánh mất dữ liệu ngăn cũ').toBe('Du lịch');

    // Ngăn MỚI (`luat`) đã tồn tại và DÙNG ĐƯỢC ngay, không cần thao tác gì thêm.
    await k2.ghi('luat', b('luat-1', '2026-08', '2026-08-01T00:00:00.000Z', { neu: 'x' }));
    expect((await k2.doc('luat', 'luat-1'))?.d).toEqual({ neu: 'x' });

    k2.dong();
  });
});
