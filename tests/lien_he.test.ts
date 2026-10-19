/**
 * SỔ LIÊN HỆ (12/09, Q3) — `soLienHe` là hàm thuần trên seed + cỡ bàn + luật.
 *
 * Vector CHÉP TAY từ bàn demo seed 2716001849 (12 ô, `balance-v45-duongcong`),
 * quét ngày 12/09: ô2 hack_san · ô4 ha_lai_suat · ô6 tang_lai_suat · ô8 cam_van ·
 * ô9 ha_lai_suat · ô11 bong_bong — sáu mặt THẬT, không tin giả. Bàn tập
 * `MAN_TAP_SEED_THUC_TE` (20417769): ô2 hack_san GIẢ · ô4 ha_lai_suat · ô7 bong_bong
 * · ô9 tang_lai_suat.
 * Tiêm lỗi 12/09: đổi `if (o.la_tin_gia)` thành `if (!o.la_tin_gia)` ⇒ bài II đỏ
 * (sập sàn giả bị đếm là thật); bỏ `Math.sign` ⇒ bài III đỏ. Hoàn nguyên bằng
 * thay-chuỗi, không `git checkout`.
 */
import { describe, expect, it } from 'vitest';
import { HOLDEM_DECISIONS } from '../config/holdem.js';
import { bacCua, soLienHe } from '../server/holdem/lien_he.js';

/*
 * D406 — vector CHÉP TAY là của một bộ luật cụ thể, nên ghim khoá chứ không đọc mặc định: tới 0.0.44 hai bàn này
 * chạy qua khoá mặc định v53 (cùng bản đồ với v45 cho hai seed này); lật v54 (bộ luật từng lá D399 · tin theo mùa)
 * là đổi bản đồ ⇒ vector không còn là của bàn đó. Bàn tập vẫn chạy v53 (`khoaBanTap`) nên TAP ghim v53 là đúng đời thật.
 */
const KHOA_VECTOR = 'balance-v53-upo';
const DEMO = { seed: 2716001849, so_o: 12, balance_version: KHOA_VECTOR };
const TAP = { seed: HOLDEM_DECISIONS.MAN_TAP_SEED_THUC_TE, so_o: 12, balance_version: KHOA_VECTOR };

describe('I. bàn demo — sáu mặt thật, lần đầu = mốc trận', () => {
  const luc = new Date('2026-09-12T09:00:00Z');
  const so = soLienHe([{ luc, ...DEMO }]);
  const cua = (id: string) => so.find((x) => x.id === id);

  it('đếm đúng từng mặt, không mặt lạ', () => {
    expect(so.map((x) => [x.id, x.so_lan, x.so_lan_gia])).toEqual([
      ['ha_lai_suat', 2, 0],
      ['tang_lai_suat', 1, 0],
      ['bong_bong', 1, 0],
      ['cam_van', 1, 0],
      ['hack_san', 1, 0],
    ]);
  });

  it('lần đầu = mốc trận; tính chất theo TINH_CHAT_NEN', () => {
    expect(cua('cam_van')?.lan_dau).toBe(luc.toISOString());
    expect(cua('cam_van')?.tinh_chat).toBe('hoang_loan');
    expect(cua('hack_san')?.tinh_chat).toBe('lech_ma');
    expect(cua('ha_lai_suat')?.tinh_chat).toBe('van_tien');
  });
});

describe('II. bàn tập — tin giả đếm riêng, không thành lần gặp thật', () => {
  it('sập sàn GIẢ ở ô 2: so_lan 0, so_lan_gia 1, chưa có lần đầu', () => {
    const so = soLienHe([{ luc: new Date('2026-09-01T00:00:00Z'), ...TAP }]);
    const hack = so.find((x) => x.id === 'hack_san');
    expect(hack).toMatchObject({ so_lan: 0, so_lan_gia: 1, lan_dau: null });
    expect(so.map((x) => x.id).sort()).toEqual(['bong_bong', 'ha_lai_suat', 'hack_san', 'tang_lai_suat']);
  });

  it('hai trận cộng dồn: hạ lãi 3 lần = QUEN, lần đầu là trận SỚM hơn', () => {
    const som = new Date('2026-09-01T00:00:00Z');
    const so = soLienHe([{ luc: som, ...TAP }, { luc: new Date('2026-09-12T09:00:00Z'), ...DEMO }]);
    const ha = so.find((x) => x.id === 'ha_lai_suat');
    expect(ha?.so_lan).toBe(3);
    expect(bacCua(ha!.so_lan)).toBe(3);
    expect(ha?.lan_dau).toBe(som.toISOString());
    expect(so[0]?.id).toBe('ha_lai_suat');
  });
});

describe('III. dấu sáu mã — từ ma trận trôi của luật, không chép tay', () => {
  it('cấm vận: rủi ro rơi · vàng, USD lên · trái phiếu rơi (v42)', () => {
    const so = soLienHe([{ luc: null, ...DEMO }]);
    const cv = so.find((x) => x.id === 'cam_van')!;
    expect(cv.dau.map((d) => `${d.ma}${d.dau > 0 ? '+' : d.dau < 0 ? '-' : '0'}`))
      .toEqual(['btc-', 'cp_cn-', 'vn30-', 'vang+', 'usd+', 'tpcp-']);
    const bb = so.find((x) => x.id === 'bong_bong')!;
    expect(bb.dau.map((d) => d.dau)).toEqual([1, 1, 1, -1, -1, -1]);
    const hs = so.find((x) => x.id === 'hack_san')!;
    expect(hs.dau.map((d) => d.dau)).toEqual([-1, -1, 0, 1, -1, 1]);
  });

  it('bậc: 0 · GẶP 1 · GẶP LẠI 2 · QUEN từ 3', () => {
    expect([0, 1, 2, 3, 7].map(bacCua)).toEqual([0, 1, 2, 3, 3]);
  });

  it('không trận nào ⇒ sổ rỗng, không bịa', () => {
    expect(soLienHe([])).toEqual([]);
  });
});
