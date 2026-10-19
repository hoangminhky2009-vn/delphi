/**
 * ĐO SỨC MẠNH TỪNG LÁ CHIẾN THUẬT — phép đo CẶP SONG SINH.
 *
 * ⚠ VÌ SAO CẦN, VÀ VÌ SAO BÂY GIỜ: D58 đo ra hai bot chơi được (Đuổi đà 35%,
 * Khắc chế 33%) vượt mốc 30% của D21, còn Bắt đáy chỉ 7%. Tắt thiên vị gu
 * (`HOLDEM_BOT_THIEN_VI_GU_BP=0`) thì chênh lệch KHÔNG giảm — mà với gu = 0
 * mọi bot chơi được dùng chung một hàm chấm điểm nên chúng mua CÙNG một mã.
 * Cùng mã, cùng tiền, khác thứ hạng gấp đôi ⇒ chênh lệch chỉ có thể đến từ
 * LÁ CHIẾN THUẬT. Đây là dụng cụ tách chuyện đó ra khỏi mọi thứ khác.
 *
 * PHƯƠNG PHÁP — CẶP SONG SINH TRÊN NAV, không phải trên thứ hạng.
 * Cùng một seed chạy HAI lần, khác đúng một thứ: ghế 0 có cầm lá hay không.
 * Đo hiệu NAV của ghế 0 giữa hai lần. Mọi thứ khác — map, đối thủ, lệnh mua,
 * dư âm — giống hệt, nên hiệu ấy CHỈ có thể là do lá.
 *
 * ⚠ BẢN ĐẦU ĐO THỨ HẠNG TRONG MỘT BÀN VÀ ĐÓ LÀ SAI PHƯƠNG PHÁP — ghi lại để
 * không ai đi lại. Năm ghế dùng chung một chính sách thì chúng mua cùng mã,
 * cùng số tiền, ra CÙNG một NAV; lúc đó thứ hạng do LUẬT PHÁ HOÀ quyết chứ
 * không do lá. Bằng chứng: ghế đối chứng (không cầm gì) ra hạng 1,70 và nhất
 * 57,8% trong khi mốc trung tính phải là 3,00 và 20%; hai lá không đổi gì
 * (Khớp Nhanh, Chia Lệnh) ra NHẤT 100%. Bảng ấy đo luật phá hoà, và nó vẫn
 * ra số trông rất thuyết phục.
 *
 * ⚠ CÁCH ĐỌC SAI PHẢI TRÁNH: "thắng nhiều" ≠ "mạnh". Một lá đổi phương sai
 * lấy kỳ vọng (Đòn Bẩy, D37) sẽ vừa nhất nhiều vừa bét nhiều — hạng trung
 * bình mới nói nó có bữa trưa miễn phí hay không. Đọc CẢ HAI cột.
 *
 * Chạy: npx tsx scripts/holdem_la.ts [số_seed] [cỡ_map] [phiên_bản]
 */
import {
  CHIEN_THUAT, HOLDEM_BALANCE_VERSION, luatCua, type ChienThuatId,
} from '../config/holdem.js';
import {
  apLenhVongNav, daKetThuc, echoCua, giaiQuyetVong, maxTaiSanCua, taoTran,
  type GheMoi,
} from '../server/holdem/engine.js';
import { lenhBotNav, timBot } from '../server/holdem/bots.js';
import { boiCanhLenhVong } from '../server/holdem/nhip_lenh_bot.js';
import { navCua } from '../server/holdem/nav.js';

const SO_SEED = Math.max(50, Number(process.argv[2] ?? 3000) | 0);
const CO_MAP = Math.max(4, Number(process.argv[3] ?? 8) | 0);
const PHIEN_BAN = process.argv[4] ?? HOLDEM_BALANCE_VERSION;
const LUAT = luatCua(PHIEN_BAN);

/*
 * ⚠ MỘT CHÍNH SÁCH DUY NHẤT CHO CẢ NĂM GHẾ, và nó phải là con KHÔNG CÓ GU
 * (`uu_tien` rỗng) — nếu không thì lá đang đo bị trộn với thiên vị tài sản,
 * đúng thứ vừa loại trừ được. "Hoài nghi hiệu chỉnh" hợp vai: chiết khấu tin
 * giả đúng về mặt toán, không tính cách.
 */
const BOT = timBot('hoai_nghi')!;

const gheMoi = (id: string, the: readonly ChienThuatId[]): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: the },
});

/** Một trận; trả NAV cuối của ghế 0. */
function chayTran(seed: number, la: ChienThuatId | null): number {
  let st = taoTran(seed, [
    gheMoi('g0', la ? [la] : []),
    gheMoi('g1', []), gheMoi('g2', []), gheMoi('g3', []), gheMoi('g4', []),
  ], LUAT, CO_MAP);

  while (!daKetThuc(st)) {
    /*
     * D386 — bối cảnh từ hàm CHUNG. Bản gõ tay cũ ở đây chỉ có `{ o, echo }`:
     * không `can_troi`, không `lop_vn`, không ba cờ v42, không `ty_le_gia_bp`,
     * không `nen` — tức bảng giá trị lá của D59 đo trên một con bot chấm mã bằng
     * mô hình đời v20. Số cũ trong D59 phải coi là ĐO LẠI, không phải kết luận.
     */
    const bc = boiCanhLenhVong(st);
    if (bc) {
      for (const g of st.ghe) {
        if (g.da_chay) continue;
        const lenh = lenhBotNav(BOT, g, st.vong, maxTaiSanCua(st, g), bc);
        if (lenh.length === 0) continue;
        const r = apLenhVongNav(st, g.id, lenh);
        if (r.ok) st = r.st;
      }
    }
    st = giaiQuyetVong(st, () => ({ loai: 'theo' as const })).trangThai;
    if (st.vong > CO_MAP + 1) break;
  }
  const g = st.ghe.find((x) => x.id === 'g0');
  return g ? navCua(g) : 0;
}

interface KetQua { label: string; trungVi: number; tot: number; p05: number; p95: number; }

const phanVi = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))] ?? 0;
};

function do1(la: ChienThuatId, label: string, moc: readonly number[]): KetQua {
  const d: number[] = [];
  for (let i = 0; i < SO_SEED; i += 1) {
    d.push(chayTran(9_000_000 + i, la) - moc[i]!);
  }
  return {
    label,
    trungVi: phanVi(d, 0.5),
    tot: (d.filter((x) => x > 0).length / d.length) * 100,
    p05: phanVi(d, 0.05), p95: phanVi(d, 0.95),
  };
}

function main(): void {
  console.log(`SỨC MẠNH TỪNG LÁ — ${SO_SEED} seed · map ${CO_MAP} ô · ${PHIEN_BAN}`);
  console.log('cặp song sinh: cùng seed, khác đúng một thứ — ghế 0 có cầm lá hay không\n');

  const moc: number[] = [];
  for (let i = 0; i < SO_SEED; i += 1) moc.push(chayTran(9_000_000 + i, null));
  const navMoc = phanVi(moc, 0.5);
  console.log(`NAV trung vị của ghế KHÔNG cầm lá: ${navMoc}\n`);

  const kq = CHIEN_THUAT.map((c) => do1(c.id, c.label, moc));
  console.log('LÁ                   ΔNAV trung vị    %seed lãi     Δp05     Δp95');
  for (const r of [...kq].sort((a, b) => b.trungVi - a.trungVi)) {
    const pct = ((r.trungVi / navMoc) * 100).toFixed(1);
    console.log(`${r.label.padEnd(20)} ${String(r.trungVi).padStart(8)} (${pct.padStart(5)}%)`
      + ` ${r.tot.toFixed(1).padStart(9)}% ${String(r.p05).padStart(8)} ${String(r.p95).padStart(8)}`);
  }
  console.log('\nCÁCH ĐỌC:');
  console.log('  ΔNAV ~0 và %seed lãi ~0  = lá KHÔNG tác dụng VỚI BOT NÀY. Có thể đúng');
  console.log('    (Khớp Nhanh/Chia Lệnh là đặc quyền cần NGƯỜI thao tác — D45), nhưng');
  console.log('    cũng có thể là cơ chế trang trí. Phân biệt trước khi kết luận.');
  console.log('  ΔNAV dương đậm + %seed lãi cao   = bữa trưa miễn phí, phải sửa.');
  console.log('  ΔNAV ~0 nhưng p05/p95 doãng rộng = lá đổi phương sai (lành, D37 Đòn Bẩy).');
  console.log('  ΔNAV âm                           = lá bẫy, không ai nên chọn.');
}

main();
