/**
 * D589 — VÀO 3 PHẦN · NÚT ×2 · CHỐT GỘP (khoá balance-v70-baphan; founder 11/10: Mua Đuổi 3 : 2 : 1 "lệnh sau nhỏ hơn lệnh trước", Bắt Đáy
 * 1 : 2 : 3 "ngược lại"; "sau khi bấm hết 3 nút nhồi lệnh thì thay nút nhồi lệnh thành ×2"; ×2 chỉ khi đủ 3 phần và CHƯA chốt, một lần mỗi
 * màn, vay bằng vốn màn, lãi vay · thanh lý theo Đòn Bẩy ×2, chốt trả phần vay trước; "cho bán hết gộp vào bán nửa … lần 1 bán nửa lần 2 bán hết").
 * Số chép tay (A8.3): vốn 1.000 ⇒ Mua Đuổi 500 · 333 · 167 · Bắt Đáy 166 · 333 · 501 · lãi vay ẢM ĐẠM 9 %/9 = 1 % số vay mỗi màn giữ trọn ⇒ giữ nửa
 * màn: 1.000 × (1,01^0,5 − 1) = 4,98 ⇒ floor 4.
 */
import { describe, expect, it } from 'vitest';
import { K_MIN, NEN_LS, SO_NHIP } from '../config/minigame.js';
import { luatCua } from '../config/holdem.js';
import type { NenMin } from '../server/holdem/minigame/dong_gia.js';
import { ketQuaMan, nutLoiCua, tienPhanVao, NUT_BAN_BOT, NUT_VAY_X2, type LenhMan } from '../server/holdem/minigame/khop.js';

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
const phang = dong(() => 100);
const chay = (la: 'mua_duoi' | 'bat_day', lenh: LenhMan[], o: { moi?: boolean; min?: NenMin[] } = {}) =>
  ketQuaMan({ min: o.min ?? phang, von: 1000, ma: 'cp_cn', la, lenh, banBot: true, banBotRai: true, khoanTheoDuong: true, laiVayPct: 9,
    ...(o.moi !== false ? { baPhan: true } : {}) } as never);
/** Bán hết khoản giữ (2 cú, không trait) ⇒ cả 1.000 thành tiền mặt để VÀO (khoản theo đường, D561). */
const banHet = () => [L(2, NUT_BAN_BOT), L(3, NUT_BAN_BOT)];
const vao3 = () => [L(10, 'vao'), L(11, 'vao'), L(12, 'vao')];
const tienVao = (kq: ReturnType<typeof ketQuaMan>) => kq.vao.map((x) => x.tien);

describe('D589 — khoá v70 = v69 + đúng một cờ', () => {
  it('khác v69 đúng `baPhan`', () => {
    const a = luatCua('balance-v69-banbot') as unknown as Record<string, unknown>, b = luatCua('balance-v70-baphan') as unknown as Record<string, unknown>;
    expect(Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k])).toEqual(['baPhan']);
  });
});

describe('D589 — VÀO 3 phần', () => {
  it('⭐ Mua Đuổi 3 : 2 : 1 ⇒ 500 · 333 · 167 (phần cuối = tiền còn); Bắt Đáy 1 : 2 : 3 ⇒ 166 · 333 · 501; khoá cũ Mua Đuổi 333 · 333 · 334', () => {
    expect(tienVao(chay('mua_duoi', [...banHet(), ...vao3()]))).toEqual([500, 333, 167]);
    expect(tienVao(chay('bat_day', [...banHet(), ...vao3()]))).toEqual([166, 333, 501]);
    expect(tienVao(chay('mua_duoi', [...banHet(), ...vao3()], { moi: false }))).toEqual([333, 333, 334]);
  });
  it('một nguồn với API: `tienPhanVao` cho đúng số của từng phần (0 khi đã đủ 3)', () => {
    expect([0, 1, 2, 3].map((n) => tienPhanVao('mua_duoi', 1000, n, 1000 - [0, 500, 833, 1000][n]!))).toEqual([500, 333, 167, 0]);
    expect([0, 1, 2, 3].map((n) => tienPhanVao('bat_day', 1000, n, 1000 - [0, 166, 499, 1000][n]!))).toEqual([166, 333, 501, 0]);
  });
});

describe('D589 — nút', () => {
  it('⭐ Mua Đuổi: VÀO · ×2 · CHỐT (+ BÁN BỚT) — CHỐT NỬA / CHỐT HẾT gộp; Bắt Đáy: VÀO · THOÁT (+ BÁN BỚT) — VÀO NỬA / VÀO HẾT bỏ; khoá cũ như cũ', () => {
    expect(nutLoiCua('mua_duoi', true, true, true, true)).toEqual(['vao', NUT_VAY_X2, 'chot', NUT_BAN_BOT]);
    expect(nutLoiCua('bat_day', true, true, true, true)).toEqual(['vao', 'thoat', NUT_BAN_BOT]);
    expect(nutLoiCua('mua_duoi', true, true, true, false)).toEqual(['vao', 'chot_nua', 'chot_het', NUT_BAN_BOT]);
    expect(nutLoiCua('bat_day', true, true, true, false)).toEqual(['vao_nua', 'vao_het', 'thoat', NUT_BAN_BOT]);
    for (const la of ['luot_song', 'don_bay', 'ban_khong']) expect(nutLoiCua(la, true, true, true, true)).toEqual(nutLoiCua(la, true, true, true, false));
  });
});

describe('D589 — ×2 của Mua Đuổi', () => {
  const vay = (kq: ReturnType<typeof ketQuaMan>) => kq.vao.filter((x) => x.vay);
  it('⭐ đủ 3 phần ⇒ ×2 vay đúng bằng vốn màn (1.000), một lần mỗi màn', () => {
    const kq = chay('mua_duoi', [...banHet(), ...vao3(), L(13, NUT_VAY_X2), L(14, NUT_VAY_X2)]);
    expect(vay(kq).map((x) => x.tien)).toEqual([1000]);
  });
  it('chưa đủ 3 phần · đã CHỐT · Bắt Đáy · khoá cũ ⇒ ×2 không có tác dụng', () => {
    expect(vay(chay('mua_duoi', [...banHet(), L(10, 'vao'), L(11, 'vao'), L(13, NUT_VAY_X2)]))).toHaveLength(0);
    expect(vay(chay('mua_duoi', [...banHet(), ...vao3(), L(13, 'chot'), L(14, NUT_VAY_X2)]))).toHaveLength(0);
    expect(vay(chay('bat_day', [...banHet(), ...vao3(), L(13, NUT_VAY_X2)]))).toHaveLength(0);
    expect(vay(chay('mua_duoi', [...banHet(), ...vao3(), L(13, NUT_VAY_X2)], { moi: false }))).toHaveLength(0);
  });
  it('⭐ lãi vay trừ theo thời gian giữ phần vay: giữ nửa màn ⇒ 1.000 × (1,01^0,5 − 1) = 4,98 ⇒ 4 (giá phẳng: mọi thứ khác bằng nhau)', () => {
    const k0 = 13, nua = SO_NHIP / 2;
    const ngay = chay('mua_duoi', [...banHet(), ...vao3(), L(k0, NUT_VAY_X2), L(k0 + 1, 'chot')]);
    const sau = chay('mua_duoi', [...banHet(), ...vao3(), L(k0, NUT_VAY_X2), L(k0 + nua, 'chot')]);
    const chot1 = (kq: ReturnType<typeof ketQuaMan>) => kq.ra.find((x) => !x.giu && !x.tuDongCuoi)!;
    expect(chot1(ngay).tien, 'CHỐT lần 1 = nửa phần đang cầm (2.000) = đúng phần vay').toBe(1000);
    expect(chot1(ngay).lai - chot1(sau).lai).toBe(4);
  });
  it('⭐ thanh lý: giá rơi sâu khi đang ×2 ⇒ bị bán cưỡng bức (lý do `thanh_ly`), hết vị thế, không mất quá vốn màn; không vay thì không thanh lý', () => {
    const roi = dong((k) => (k <= 50 ? 100 : Math.max(30, 100 - (k - 50) * (70 / (SO_NHIP - 200)))));
    const kq = chay('mua_duoi', [...banHet(), ...vao3(), L(20, NUT_VAY_X2)], { min: roi });
    expect(kq.ra.some((x) => x.lyDo === 'thanh_ly')).toBe(true);
    expect(kq.theoLenh).toBeGreaterThanOrEqual(-1000);
    expect(chay('mua_duoi', [...banHet(), ...vao3()], { min: roi }).ra.some((x) => x.lyDo === 'thanh_ly')).toBe(false);
  });
});

describe('D589 — CHỐT gộp', () => {
  const chot = (kq: ReturnType<typeof ketQuaMan>) => kq.ra.filter((x) => !x.giu && !x.tuDongCuoi).map((x) => x.tien);
  it('⭐ lần 1 bán NỬA phần đang cầm, lần 2 bán HẾT; bấm thêm không làm gì', () => {
    expect(chot(chay('mua_duoi', [...banHet(), ...vao3(), L(20, 'chot'), L(21, 'chot'), L(22, 'chot')]))).toEqual([500, 500]);
  });
  it('VÀO thêm sau lần 1 ⇒ đếm lại: lần kế lại là NỬA', () => {
    // 500 + 333 vào, chốt nửa (416), vào phần ba (167) ⇒ đang cầm 417 + 167 = 584 ⇒ chốt nửa 292, rồi hết 292.
    expect(chot(chay('mua_duoi', [...banHet(), L(10, 'vao'), L(11, 'vao'), L(20, 'chot'), L(21, 'vao'), L(30, 'chot'), L(31, 'chot')]))).toEqual([416, 292, 292]);
  });
});

describe('D589 — nhãn Bắt Đáy "trung bình giá xuống"', () => {
  it('⭐ ba phần vào ở giá thấp dần ⇒ nhãn `tb_gia_xuong`; giá đứng ⇒ không', () => {
    const xuong = dong((k) => 100 - k * 0.05);
    expect(chay('bat_day', [...banHet(), L(40, 'vao'), L(80, 'vao'), L(120, 'vao')], { min: xuong }).nhan).toContain('tb_gia_xuong');
    expect(chay('bat_day', [...banHet(), ...vao3()]).nhan).not.toContain('tb_gia_xuong');
  });
});
