/**
 * ỨNG VIÊN HỘP GACHA — test THUẦN, không dựng Postgres.
 *
 * Đây là phép lọc quyết định "người này quay ra được gì", tức nó đứng ngay trước
 * một cú trừ tiền. A8.3 đòi test trước ở chỗ đụng tiền, và luật lọc lại là thứ
 * kiểm bằng DB thì chậm mà bằng mắt thì không kiểm được — nên nó phải thuần.
 *
 * ⚠ Mỗi bài dưới đây khoá một BẤT BIẾN, không khoá một con số. Số món mỗi bậc sẽ
 * đổi khi mùa sau thêm đồ; thứ không được phép đổi là: hộp không bao giờ trao thứ
 * người ta đã có (nếu món đó độc bản), và không bao giờ im lặng trao rỗng.
 */
import { describe, expect, it } from 'vitest';
import { AVATAR_NEN, NHAN_DAN } from '../config/avatar.js';
import {
  BAC_TAT_CA, HOP_GACHA, bacConHang, conMonNao, traoDuoc, ungVienBac,
  type BoiCanhUngVien, type MonTrongHop,
} from '../server/sandbox/ung_vien.js';

/** Bối cảnh "mọi thứ còn hàng, chưa sở hữu gì" — mốc trung tính của mọi bài. */
const SACH: BoiCanhUngVien = { ton: new Map(), nenDaCo: new Set() };

function coNen(...ma: string[]): BoiCanhUngVien {
  return { ton: new Map(), nenDaCo: new Set(ma) };
}

describe('Bảng rơi của hộp', () => {
  it('CHỨA hai lá trader — nếu không thì art đã vẽ mà hộp không trả ra được', () => {
    const ids = HOP_GACHA.map((m) => m.id);
    expect(ids).toContain('av_trader_1');
    expect(ids).toContain('av_trader_2');
  });

  it('KHÔNG chứa Dấu niêm Beta — nó là quà beta từ 04/08, không quay ra được', () => {
    expect(HOP_GACHA.map((m) => m.id)).not.toContain('st_niem_beta');
  });

  it('Dấu niêm Beta vẫn Ở LẠI catalog nhãn dán — gỡ khỏi hộp ≠ xoá khỏi hệ', () => {
    // Người đã sở hữu vẫn phải dán được, và kho vẫn phải hiển thị được món này.
    expect(NHAN_DAN.map((n) => n.id)).toContain('st_niem_beta');
  });

  it('MỌI bậc đều có ít nhất một món — bậc rỗng là pity vỡ', () => {
    for (const bac of BAC_TAT_CA) {
      expect(ungVienBac(bac, SACH).length, `bậc ${bac} rỗng`).toBeGreaterThan(0);
    }
  });

  it('hai lá trader nằm đúng bậc đã khai trong config (không lệch nguồn chân lý)', () => {
    const t1 = HOP_GACHA.find((m) => m.id === 'av_trader_1')!;
    const t2 = HOP_GACHA.find((m) => m.id === 'av_trader_2')!;
    expect(t1.hiem).toBe(AVATAR_NEN.find((n) => n.id === 'av_trader_1')!.hiem);
    expect(t2.hiem).toBe(AVATAR_NEN.find((n) => n.id === 'av_trader_2')!.hiem);
    expect(t1.loai).toBe('nen');
    expect(t1.docBan).toBe(true);
    expect(t2.docBan).toBe(true);
  });

  it('mọi món `nen` đều có mã — `taoAvatarNen` nhận mã, không nhận id', () => {
    for (const m of HOP_GACHA.filter((x) => x.loai === 'nen')) {
      expect(m.ma, `${m.id} thiếu mã`).toMatch(/^[A-Z]$/);
    }
  });
});

describe('Lọc theo SỞ HỮU — luật độc bản (founder 04/08)', () => {
  it('người đã có trader #1 thì KHÔNG bao giờ bốc lại lá đó', () => {
    const bc = coNen('E');
    expect(ungVienBac('hiem', bc).map((m) => m.id)).not.toContain('av_trader_1');
  });

  it('nhưng bậc `hiem` vẫn còn nhãn dán — không được rỗng theo (đó là bậc chung)', () => {
    expect(ungVienBac('hiem', coNen('E')).length).toBeGreaterThan(0);
  });

  it('⚠ có trader #2 ⇒ bậc `epic` RỖNG THẬT — app phải nói ra, không được im', () => {
    /*
     * Đây là hệ quả cấu trúc, không phải lỗi: sau khi `st_niem_beta` rời hộp thì
     * `epic` chỉ còn ĐÚNG MỘT món và nó độc bản. Bài này tồn tại để khi mùa sau
     * có người "sửa cho hết rỗng" thì họ đọc được vì sao nó rỗng, và để
     * `bacConHang` — thứ nuôi dòng chữ trên màn — không bao giờ bị bỏ quên.
     */
    expect(ungVienBac('epic', coNen('F'))).toHaveLength(0);
    expect(bacConHang(coNen('F')).epic).toBe(false);
    expect(bacConHang(SACH).epic).toBe(true);
  });

  it('có đủ CẢ HAI lá vẫn còn hộp để mở (sticker không độc bản)', () => {
    const bc = coNen('E', 'F');
    expect(conMonNao(bc)).toBe(true);
    expect(bacConHang(bc)).toEqual({ thuong: true, hiem: true, epic: false });
  });

  it('sticker KHÔNG bị luật độc bản chạm tới — bản thứ hai là +1 vào kho (D36)', () => {
    // Giả định người này "đã có" mọi mã nền; sticker phải trơ với điều đó.
    const bc: BoiCanhUngVien = {
      ton: new Map(), nenDaCo: new Set(['A', 'B', 'C', 'D', 'E', 'F']),
    };
    const st = HOP_GACHA.filter((m) => m.loai === 'sticker');
    for (const m of st) expect(traoDuoc(m, bc), m.id).toBe(true);
  });
});

describe('Tồn kho toàn hệ vẫn còn hiệu lực', () => {
  const mon: MonTrongHop = HOP_GACHA[0]!;

  it('món bị ẩn (công tắc vận hành) thì không trao', () => {
    const ton = new Map([[mon.id, { conLai: null, song: false }]]);
    expect(traoDuoc(mon, { ton, nenDaCo: new Set() })).toBe(false);
  });

  it('món hết bản phát hành thì không trao', () => {
    const ton = new Map([[mon.id, { conLai: 0, song: true }]]);
    expect(traoDuoc(mon, { ton, nenDaCo: new Set() })).toBe(false);
  });

  it('món CHƯA có hàng trong DB vẫn trao được — vắng mặt ≠ hết hàng', () => {
    /*
     * Bài này khoá đúng cái bẫy hai lá trader vừa dính: catalog ở config, DB chỉ
     * gắn công tắc. Nếu "không có hàng cosmetic_items" bị đọc thành "hết hàng"
     * thì thêm món mới vào config sẽ im lặng không rơi, và không ai thấy.
     */
    expect(traoDuoc(mon, SACH)).toBe(true);
  });

  it('hết sạch mọi món ⇒ `conMonNao` false ⇒ route phải chặn TRƯỚC khi chạm ví', () => {
    const ton = new Map(HOP_GACHA.map((m) => [m.id, { conLai: 0, song: true }]));
    expect(conMonNao({ ton, nenDaCo: new Set() })).toBe(false);
  });
});
