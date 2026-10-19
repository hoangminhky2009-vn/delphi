/**
 * TÍNH CÁCH TÀI CHÍNH — catalog BA GIỌNG + radar (trang Tài chính cá nhân, D106).
 *
 * Radar là BIẾN HÌNH của các chỉ số: bài ở đây khoá phép chuẩn hoá bằng số chép
 * tay (đổi công thức mà quên đổi bài là đỏ), và khoá luật "null = mờ ở giữa
 * thang" — chưa đo được không được vẽ thành 0 (bài học D62).
 * Catalog: đủ 10 id × 3 giọng; giọng trẻ phải THẬT SỰ trẻ (có "bro"/meme) và
 * giọng chững không được lẫn "bro"; KHÔNG một giọng nào kê đơn (A10).
 */
import { describe, expect, it } from 'vitest';
import type { SauChiSo, TinhCachId } from '@server/holdem/insight';
import {
  BAC_DOC_NHAN, KHAU_VI_NHAN, NET_NHAN, NHAN_DONG_TOKEN, THE_TINH_CACH, giongCua,
  theCua, trucRadar, type Giong,
} from '@/lib/tinh_cach';
import { TU_KE_DON } from '@/lib/khoanh_khac';

const RONG: SauChiSo = {
  hieu_chinh: null, duoi_gia: null, theo_tin: null,
  chot_non: null, don_von: null, mua_tin: null, khau_vi: null,
};

const IDS: TinhCachId[] = [
  'dang_dinh_hinh',
  'de_danh_lanh', 'de_danh_ket_qua', 'de_danh_ben_ngoai',
  'don_lanh', 'don_ket_qua', 'don_ben_ngoai',
  'rai_lanh', 'rai_ket_qua', 'rai_ben_ngoai',
];
const GIONG: Giong[] = ['tre', 'vua', 'chung'];

describe('trucRadar — chuẩn hoá 0..100, cao = đẹp', () => {
  it('chỉ số null ⇒ 50 điểm + cờ mờ (chưa đo ≠ bằng không)', () => {
    for (const t of trucRadar(RONG)) {
      expect(t.diem).toBe(50);
      expect(t.mo).toBe(true);
    }
  });

  it('số chép tay: brier 0,5 ⇒ CHUẨN 75 · đuổi giá lệch +0,6 ⇒ KỶ LUẬT 40 · lệch âm ⇒ 100', () => {
    const truc = trucRadar({
      ...RONG,
      hieu_chinh: { brier_tb: 0.5, xu_huong: null, n: 10 },
      duoi_gia: { ty_le: 0.8, nen: 0.2, lech: 0.6, n: 8 },
    });
    expect(truc.find((t) => t.ten === 'CHUẨN')).toMatchObject({ diem: 75, mo: false }); // (2−0,5)/2
    expect(truc.find((t) => t.ten === 'KỶ LUẬT GIÁ')).toMatchObject({ diem: 40, mo: false }); // 1−0,6
    const am = trucRadar({ ...RONG, duoi_gia: { ty_le: 0.1, nen: 0.5, lech: -0.4, n: 8 } });
    expect(am.find((t) => t.ten === 'KỶ LUẬT GIÁ')!.diem).toBe(100); // không bị kéo = đẹp tối đa
  });

  it('ĐIỀM TĨNH đo độ lệch khỏi ×1 — ga sau thua ×1,5 ⇒ 50 điểm', () => {
    const truc = trucRadar({
      ...RONG,
      don_von: { nen_bp: 3000, sau_thang_x: 1.0, sau_thua_x: 1.5, n: 8 },
    });
    expect(truc.find((t) => t.ten === 'ĐIỀM TĨNH')!.diem).toBe(50);
  });

  it('kẹp 0..100 — brier tệ hết thang không âm điểm', () => {
    const truc = trucRadar({ ...RONG, hieu_chinh: { brier_tb: 2, xu_huong: null, n: 5 } });
    expect(truc.find((t) => t.ten === 'CHUẨN')!.diem).toBe(0);
  });
});

describe('giongCua — tuổi quyết giọng, Cài đặt đè tuổi', () => {
  it('tự động: 16–22 trẻ · 23–30 vừa · 31+ chững · chưa khai ⇒ vừa', () => {
    expect(giongCua('16-17', 'tu_dong')).toBe('tre');
    expect(giongCua('18-22', undefined)).toBe('tre');
    expect(giongCua('23-30', 'tu_dong')).toBe('vua');
    expect(giongCua('31-45', null)).toBe('chung');
    expect(giongCua('46+', 'tu_dong')).toBe('chung');
    expect(giongCua(null, 'tu_dong')).toBe('vua');
  });
  it('chọn tay thắng tuổi', () => {
    expect(giongCua('16-17', 'chung')).toBe('chung');
    expect(giongCua('46+', 'tre')).toBe('tre');
  });
});

describe('catalog — đủ mặt cho mọi id × mọi giọng', () => {
  it('10 thẻ × 3 giọng đều có emoji + tên + đọc vị + gợi ý', () => {
    for (const id of IDS) for (const g of GIONG) {
      const the = theCua(id, g);
      expect(the.emoji.length, `${id}/${g}`).toBeGreaterThan(0);
      expect(the.ten.length, `${id}/${g}`).toBeGreaterThan(3);
      expect(the.doc_vi.length, `${id}/${g}`).toBeGreaterThan(10);
      expect(the.goi_y.length, `${id}/${g}`).toBeGreaterThan(10);
    }
  });

  it('giọng TRẺ thật sự trẻ (bro/meme ở mọi thẻ có dữ liệu); giọng CHỮNG không "bro"', () => {
    const meme = /bro|🗿|💀|🙏|🤡|🫡|anh bạn thật sự/i;
    for (const id of IDS) {
      const tre = theCua(id, 'tre');
      expect(meme.test(`${tre.doc_vi} ${tre.goi_y}`), `${id}/tre không có bro/meme`).toBe(true);
      const chung = theCua(id, 'chung');
      expect(/bro\b/i.test(`${chung.ten} ${chung.doc_vi} ${chung.goi_y}`), `${id}/chung có "bro"`).toBe(false);
    }
  });

  it('⭐ A10: KHÔNG kê đơn ở bất kỳ giọng nào — quét cùng bộ từ với khoảnh khắc/dấu mốc', () => {
    const chu: string[] = [];
    for (const id of IDS) for (const g of GIONG) {
      const t = theCua(id, g);
      chu.push(t.ten, t.doc_vi, t.goi_y);
    }
    for (const b of Object.values(KHAU_VI_NHAN)) for (const g of GIONG) chu.push(b[g].ten, b[g].giai);
    for (const b of Object.values(NET_NHAN)) for (const g of GIONG) chu.push(b[g].ten, b[g].giai);
    for (const b of Object.values(BAC_DOC_NHAN)) for (const g of GIONG) chu.push(b[g].ten, b[g].giai);
    for (const c of chu) {
      const th = ` ${c.toLowerCase()} `;
      for (const tu of TU_KE_DON) {
        expect(th.includes(tu), `"${c}" chứa từ kê đơn "${tu.trim()}"`).toBe(false);
      }
    }
  });

  it('thẻ = khẩu vị × nét: id ghép đúng hai nhãn có thật', () => {
    for (const id of IDS) {
      if (id === 'dang_dinh_hinh') continue;
      const [kv, ...net] = id.split('_') as [string, ...string[]];
      const kvId = kv === 'de' ? 'de_danh' : kv;
      const netId = net.join('_').replace(/^danh_/, '');
      expect(KHAU_VI_NHAN[kvId as keyof typeof KHAU_VI_NHAN], id).toBeDefined();
      expect(NET_NHAN[netId as keyof typeof NET_NHAN], id).toBeDefined();
    }
    expect(Object.keys(THE_TINH_CACH).length).toBe(10);
  });

  it('nhãn dòng token phủ đủ các lý do sổ cái đang dùng', () => {
    for (const reason of ['signup_grant', 'bet_place', 'payout', 'refund', 'subsidy']) {
      expect(NHAN_DONG_TOKEN[reason], reason).toBeDefined();
    }
  });
});
