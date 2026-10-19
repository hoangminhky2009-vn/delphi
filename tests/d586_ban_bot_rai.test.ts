/**
 * D586 — BÁN BỚT BÁN HẾT ĐƯỢC khoản giữ (khoá balance-v69-banbot; founder 11/10: *"Lõi bắt đáy bị lỗi khi ko bán hết được"* · *"Ko cần thêm bán hết
 * đâu cu. Chỉ cần cho bán bớt có khả năng bán hết là được mà, quy định số lần để bán và % được phép bán dựa trên trait rải lệnh"* · chọn "2 / 3 / 4 lần"
 * và "Bắt Đáy · Mua Đuổi · màn không lõi").
 * Canh: mỗi cú = khoản ban đầu ÷ số lần (không trait 2 · Rải 2 → 3 · Rải 3 → 4 · Rải 5 → 4), cú cuối bán nốt, bấm thừa không làm gì · khoá cũ nửa phần
 * còn (không bao giờ về 0) · Mua Đuổi bán hết rồi ĐUỔI được bằng cả vốn · màn KHÔNG lõi có BÁN BỚT (không bấm ⇒ y như giữ suốt) · Lướt Sóng / Đòn Bẩy /
 * Bán Khống không đổi.
 */
import { describe, expect, it } from 'vitest';
import { BAN_BOT_LAN, K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import { luatCua } from '../config/holdem.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, luongBanBot, nutLoiCua, soLanBanBot, NUT_BAN_BOT, type LenhMan } from '../server/holdem/minigame/khop.js';

function dong(gia: (k: number) => number): NenMin[] {
  const ra: NenMin[] = [];
  for (let i = 0; i < NEN_LS * K_MIN; i++) ra.push({ o: 100, c: 100, h: 100, l: 100, tick: Array(8).fill(100), v: 0, iSong: i, rut: 0, quet: null });
  let truoc = 100;
  for (let j = 0; j < SO_NHIP / 8; j++) {
    const tick = Array.from({ length: 8 }, (_, t) => gia(j * 8 + t));
    ra.push({ o: truoc, c: tick[7]!, h: Math.max(truoc, ...tick), l: Math.min(truoc, ...tick), tick, v: 0, iSong: j, rut: 0, quet: null });
    truoc = tick[7]!;
  }
  return ra;
}
let seq = 0;
const L = (nhip: number, nut: string): LenhMan => ({ seq: ++seq, nhip, nut });
const bot = (...nhip: number[]) => nhip.map((n) => L(n, NUT_BAN_BOT));
// 100 tới nhịp 100 · rơi đều về 70 ở cuối màn.
const roi = dong((k) => (k <= 100 ? 100 : 100 - (k - 100) * (30 / (SO_NHIP - 101))));
const chay = (la: string | null, lenh: LenhMan[], o: { moi?: boolean; rai?: number } = {}) =>
  ketQuaMan({ min: roi, von: 1000, ma: 'cp_cn', la, lenh, banBot: true, khoanTheoDuong: true, ...(o.moi !== false ? { banBotRai: true } : {}), ...(o.rai ? { rai: o.rai } : {}) } as never);
/** Từng cú BÁN BỚT người chơi đã bán (không tính phần tự quyết toán cuối màn — `tuDongCuoi`). */
const cuBan = (kq: ReturnType<typeof ketQuaMan>) => kq.ra.filter((x) => x.giu && x.lyDo === 'ban_bot').map((x) => x.tien);
const tong = (a: number[]) => a.reduce((x, y) => x + y, 0);

describe('D586 — khoá v69 = v68 + đúng một cờ', () => {
  it('khác v68 đúng `banBotRai`', () => {
    const a = luatCua('balance-v68-giaixu') as unknown as Record<string, unknown>, b = luatCua('balance-v69-banbot') as unknown as Record<string, unknown>;
    expect(Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k])).toEqual(['banBotRai']);
  });
});

describe('D586 — số lần bán theo Rải lệnh', () => {
  it('bảng founder chốt: không trait 2 · Rải 2 → 3 · Rải 3 → 4 · Rải 5 → 4 (trần 4); cấp lạ rơi về không trait', () => {
    expect(soLanBanBot()).toBe(2);
    expect(soLanBanBot(2)).toBe(3);
    expect(soLanBanBot(3)).toBe(4);
    expect(soLanBanBot(5)).toBe(4);
    expect(soLanBanBot(4)).toBe(BAN_BOT_LAN.KHONG_RAI);
  });
  it('mỗi cú = khoản ban đầu ÷ số lần (floor), cú cuối bán NỐT phần lẻ, hết rồi thì 0', () => {
    expect(luongBanBot(1000, 1000, 0, 2)).toBe(333);
    expect(luongBanBot(1000, 334, 2, 2)).toBe(334);
    expect(luongBanBot(1000, 0, 3, 2)).toBe(0);
  });
});

describe('D586 — nút', () => {
  it('⭐ Bắt Đáy · Mua Đuổi có BÁN BỚT; màn không lõi có BÁN BỚT (chỉ khoá mới); Lướt Sóng · Đòn Bẩy · Bán Khống không đổi', () => {
    for (const la of ['bat_day', 'mua_duoi']) expect(nutLoiCua(la, true, false, true)).toContain(NUT_BAN_BOT);
    expect(nutLoiCua(null, true, true, true)).toEqual([NUT_BAN_BOT]);
    expect(nutLoiCua(null, true, true, false)).toBeUndefined();
    for (const la of ['luot_song', 'don_bay', 'ban_khong']) expect(nutLoiCua(la, true, true, true)).toEqual(nutLoiCua(la, true, true, false));
  });
});

describe('D586 — Bắt Đáy: BÁN BỚT bán hết được', () => {
  it('⭐ không trait: 2 cú 500 + 500 về 0, cú thứ ba không làm gì — khoá cũ 2 cú chỉ 500 + 250 (lỗi founder báo: không bao giờ về 0)', () => {
    expect(cuBan(chay('bat_day', bot(50, 60, 70)))).toEqual([500, 500]);
    const cu = cuBan(chay('bat_day', bot(50, 60, 70, 80, 90), { moi: false }));
    expect(cu.slice(0, 2)).toEqual([500, 250]);
    expect(tong(cu)).toBeLessThan(1000);
  });
  it('⭐ Rải lệnh chia nhỏ: Rải 2 ⇒ 333 · 333 · 334 · Rải 3 · Rải 5 ⇒ 4 × 250 — đủ số lần là về 0', () => {
    expect(cuBan(chay('bat_day', bot(50, 55, 60, 65), { rai: 2 }))).toEqual([333, 333, 334]);
    expect(cuBan(chay('bat_day', bot(50, 55, 60, 65, 70), { rai: 3 }))).toEqual([250, 250, 250, 250]);
    expect(cuBan(chay('bat_day', bot(40, 45, 50, 55, 60, 65, 70), { rai: 5 }))).toEqual([250, 250, 250, 250]);
  });
  it('bán hết trước cú rơi 30 % ⇒ hơn giữ suốt ~300 (`loi` so với giữ suốt; giữ suốt = 0)', () => {
    expect(chay('bat_day', []).loi).toBe(0);
    expect(chay('bat_day', bot(50, 60)).loi).toBeGreaterThan(250);
  });
});

describe('D586 — Mua Đuổi: bán hết rồi đuổi bằng cả vốn (founder 11/10 A — BÁN BỚT là cửa lấy tiền để đuổi)', () => {
  it('⭐ 2 cú BÁN BỚT rồi VÀO ba phần ⇒ cả 1000 vào lại; khoá cũ chỉ được phần đã bán (< 1000)', () => {
    const vaoLai = (moi: boolean) => tong(chay('mua_duoi', [...bot(20, 21), L(150, 'vao'), L(151, 'vao'), L(152, 'vao')], { moi }).vao.map((x) => x.tien));
    expect(vaoLai(true)).toBe(1000);
    expect(vaoLai(false)).toBeLessThan(1000);
  });
});

describe('D586 — màn không lõi (mặc định nắm giữ)', () => {
  it('⭐ không bấm ⇒ lãi lỗ y như giữ suốt (khoá cũ); 2 cú ⇒ khoản về 0, tránh cú rơi; khoá cũ nút không tác dụng', () => {
    expect(chay(null, []).loi).toBe(chay(null, [], { moi: false }).loi);
    const het = chay(null, bot(50, 60));
    expect(cuBan(het)).toEqual([500, 500]);
    expect(het.loi).toBeGreaterThan(250);
    expect(cuBan(chay(null, bot(50, 60), { moi: false }))).toEqual([]);
  });
});
