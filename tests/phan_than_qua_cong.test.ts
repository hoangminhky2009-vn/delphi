/**
 * PHẢN THÂN QUA CỔNG BALANCE (D155) — chuẩn hoá D147-Q3, việc không-hối-tiếc
 * founder duyệt trong gói "Làm đi": trước đây phản thân D4 gác bằng ENV
 * `HOLDEM_PHAN_THAN_BAT` (lệch A11.3 — hai máy có thể chạy hai bộ luật cho cùng
 * một trận); nay đi bằng cờ `phanThan` trong `BO_LUAT_THEO_PHIEN_BAN` như mọi
 * luật engine khác.
 *
 * ⚠⚠ ĐIỀU DUY NHẤT LÀM CÚ CHUYỂN NÀY AN TOÀN VỚI REPLAY — và bài §I khoá nó:
 * ENV cũ mặc định 1, và override chỉ có tác dụng khi HOLDEM_SWEEP=1 (chế độ đo,
 * prod không bao giờ bật) ⇒ MỌI trận từng chạy đều CÓ phản thân. Vậy cờ phải
 * TRUE ở mọi phiên bản lịch sử — kể cả entry rỗng (trận trước mọi cổng) — và
 * mặc định của `taoTran` khi VẮNG cờ phải là BẬT (ngược với mọi cờ khác, có
 * chủ đích). Đặt false ở bất kỳ chỗ nào trong số đó là đổi replay trận đã lưu.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BO_LUAT_THEO_PHIEN_BAN, luatCua } from '../config/holdem.js';
import { huongDonCuaLobby, taoTran, type GheMoi } from '../server/holdem/engine.js';

const ghe = (n: number): GheMoi[] => Array.from({ length: n }, (_, i) => ({
  id: `g${i}`, loai: 'bot' as const, bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
}));

/** Dựng trạng thái ĐANG DỒN: mọi ghế ôm btc hai vòng liên tiếp. */
function dungDon(phanThan?: boolean) {
  const st = taoTran(1, ghe(4),
    phanThan === undefined ? {} : { phanThan }, 8);
  const gheOm = st.ghe.map((g) => ({
    ...g, vi_the: { btc: 1000 }, danh_muc: { ...g.danh_muc, tai_san: ['btc'] },
  }));
  return {
    ...st, ghe: gheOm,
    dong_truoc: { btc: 4, cp_cn: 0, vn30: 0, vang: 0, usd: 0, tpcp: 0 },
  };
}

describe('I. Mọi phiên bản lịch sử giữ phản thân BẬT — không thì replay đổi', () => {
  it('⭐⭐ cờ `phanThan` = true ở TỪNG entry TRƯỚC v54, kể cả entry rỗng', () => {
    /*
     * D389 — v54 CẮT cụm đám đông đổi lá (phản thân · bẻ chuỗi bằng vốn · áp lực bàn): bản đồ chỉ
     * do seed quyết. Đó là luật của KHOÁ MỚI (chưa trận nào lưu), không phải đổi hồi tố — nên thước
     * vẫn là "mọi khoá CŨ giữ phản thân"; từ v54 thì phải TẮT, bật lại là quyết định có D-số.
     */
    const soCua = (t: string) => Number(/balance-v(\d+)/.exec(t)?.[1] ?? 0);
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      expect(luat.phanThan,
        `phiên bản "${ten}" — trước v54 phải BẬT (trận đã lưu replay), từ v54 phải TẮT (D389)`)
        .toBe(soCua(ten) < 54);
    }
    expect(luatCua('phien-ban-khong-ton-tai').phanThan, 'fallback version-lạ cũng phải BẬT')
      .toBe(true);
    expect(luatCua(null).phanThan).toBe(true);
  });

  it('⭐⭐ taoTran KHÔNG nhận cờ ⇒ phản thân vẫn sống (mặc định NGƯỢC, có chủ đích)', () => {
    /*
     * Mọi cờ khác vắng = TẮT. Cờ này vắng = BẬT — vì ENV cũ mặc định bật nên
     * "vắng" phải nghĩa là "như xưa" thì hàng trăm call site cũ (test, probe,
     * script) mới giữ nguyên hành vi. Bài này canh đúng cái ngược đời đó.
     */
    const st = dungDon(undefined);
    expect(huongDonCuaLobby(st), 'mặc định thành TẮT ⇒ mọi trận cũ mất phản thân')
      .toBe('don');
  });
});

describe('II. Cửa cô lập để đo — chuyển khuôn, không mất', () => {
  it('⭐ `phanThan: false` tường minh ⇒ phản thân câm hoàn toàn', () => {
    expect(huongDonCuaLobby(dungDon(false))).toBeNull();
  });

  it('`phanThan: true` tường minh ⇒ sống', () => {
    expect(huongDonCuaLobby(dungDon(true))).toBe('don');
  });

  it('⚠ ENV cũ hết đường sống — không còn ai đọc HOLDEM_PHAN_THAN_BAT', () => {
    // Grep mã nguồn: một nhánh đọc ENV còn sót là hai máy lại chạy hai bộ luật.
    for (const f of ['server/holdem/engine.ts', 'config/holdem.ts',
      'scripts/holdem_phanthan_gate.ts', 'scripts/holdem_domohinh.ts']) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
        .replace(/^\s*\*.*$/gm, '');
      expect(src, `${f} vẫn đọc ENV phản thân`).not.toContain('PHAN_THAN_BAT');
    }
  });
});

describe('III. Bàn đo dùng ĐÚNG luật và ĐÚNG nhịp lệnh (bẫy D83/D127/D155)', () => {
  it('⭐⭐ nhịp lệnh NAV là MỘT hàm chung — không bản sao, không bàn đo rỗng', () => {
    /*
     * D155 chẩn: gate có tái-cơ-cấu + cược nhưng KHÔNG đặt lệnh NAV ⇒ ghế
     * không ôm mã, ô thay không chạm ai, "vốn giống hệt từng chữ số giữa
     * bật/tắt". D156 trả nợ bằng `apNhipLenhBotNav` dùng chung với montecarlo
     * (byte-hệt trước/sau refactor, đã so 300 trận). Bài này khoá cả hai vế:
     * hai bàn đo cùng gọi MỘT hàm, và không bàn nào giữ bản chép tay.
     */
    const gate = readFileSync(resolve(process.cwd(), 'scripts/holdem_phanthan_gate.ts'), 'utf8');
    const mc = readFileSync(resolve(process.cwd(), 'scripts/holdem_montecarlo.ts'), 'utf8');
    expect(gate, 'gate mất nhịp lệnh ⇒ quay về bàn đo rỗng D155').toMatch(/apNhipLenhBotNav\(/);
    expect(mc, 'montecarlo rời hàm chung ⇒ hai bản sẽ trôi').toMatch(/apNhipLenhBotNav\(/);
    // Không ai được giữ bản chép tay của nhịp này ngoài chính module chung.
    for (const [ten, src] of [['gate', gate], ['montecarlo', mc]] as const) {
      expect(src, `${ten} gọi lenhBotNav trực tiếp — bản sao thứ ba đang mọc lại`)
        .not.toMatch(/[^.]lenhBotNav\(/);
    }
  });

  it('⭐ cả hai script truyền LUẬT THẬT vào taoTran, không gọi trần', () => {
    for (const f of ['scripts/holdem_phanthan_gate.ts', 'scripts/holdem_domohinh.ts']) {
      const src = readFileSync(resolve(process.cwd(), f), 'utf8');
      expect(src, `${f} không đi qua luatCua ⇒ đo bộ luật toàn-tắt`)
        .toMatch(/luatCua\(/);
      // Không còn lời gọi taoTran hai-tham-số (seed, ghe) — dạng gọi trần cũ.
      expect(src, `${f} vẫn còn taoTran gọi trần`)
        .not.toMatch(/taoTran\(seed,\s*ghe\);/);
    }
  });
});
