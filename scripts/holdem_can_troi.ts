/**
 * ĐO TRÔI KỲ VỌNG THEO MÃ — đường tái lập bảng `CAN_TROI_BP` của D54.
 *
 * ⚠ VÌ SAO SCRIPT NÀY PHẢI TỒN TẠI: `config/holdem.ts` đã trỏ tới nó từ D54
 * ("đo lại bằng scripts/holdem_can_troi.ts sau mỗi lần đổi ma trận") nhưng
 * file chưa bao giờ được viết — tức chỉ dẫn duy nhất để lặp lại một bảng SỐ
 * KINH TẾ là một đường dẫn chết. Bảng ấy sai NGAY và sai IM LẶNG mỗi lần ai
 * chạm `MT_TAI_SAN_GIAI_DOAN` / `MT_TAI_SAN_SU_KIEN`, nên không có đường đo
 * lại thì nó chỉ đúng đúng một ngày duy nhất trong đời.
 *
 * CÁCH ĐO — cố ý THÔ VÀ THUẦN, đúng như D54 đã làm:
 * mỗi ghế ôm 100% một mã suốt trận, KHÔNG giao dịch thêm, không thẻ, không
 * đối thủ tranh chấp. Đo đúng một thứ: cầm mã này từ đầu tới cuối thì tài sản
 * nhân lên bao nhiêu lần. Thêm bất cứ thứ gì khác vào là trộn trôi của MÃ với
 * trôi của CHÍNH SÁCH — mà chính sách thì vừa đổi ở D56.
 *
 * Chạy:
 *   npx tsx scripts/holdem_can_troi.ts [số_seed] [cỡ_map] [phiên_bản]
 *   npx tsx scripts/holdem_can_troi.ts 400 8 balance-v20-conghuong   ← đo TRƯỚC cân
 *   npx tsx scripts/holdem_can_troi.ts 400 8                          ← đo bộ đang ship
 *
 * ĐỌC KẾT QUẢ:
 *   · cột `tâm` (trung vị) là thứ `CAN_TROI_BP` nhắm về 1,00. Lệch > ±0,10 là
 *     mã đó đang tự giàu/tự nghèo mà người chơi không cần đọc gì.
 *   · cột `p05`/`p95` là ĐUÔI — KHÔNG được ép về gần nhau. D54 giữ nguyên
 *     chúng có chủ ý (founder: "may mắn liên tục thì vẫn phải lãi khủng lồ").
 *     Cân đúng là tâm về 1 mà đuôi vẫn rộng.
 *   · cột `bp gợi ý` là mức hiệu chỉnh CỘNG THÊM cho vòng đo kế tiếp.
 *
 * ⚠ ĐỪNG DÁN THẲNG `bp gợi ý` VÀO CONFIG. Nó suy từ công thức
 * `(1/tâm^(1/số_vòng) − 1) × 10.000`, mà bp nền còn bị nhân bởi sức căng và
 * chu kỳ nên vòng đo đầu luôn CÂN QUÁ TAY (D54 đã dính: usd vọt lên ×1,91).
 * Quy trình đúng là hai bước: áp thử, đo lại, rồi NỘI SUY trên thang log giữa
 * hai điểm đo. Script in sẵn cả hai điểm để làm việc đó.
 */
import { CAN_TROI_BP, CAN_TROI_BP_V23, HOLDEM_BALANCE_VERSION, TAI_SAN, luatCua } from '../config/holdem.js';
import { apLenhVongNav, daKetThuc, giaiQuyetVong, taoTran, type GheMoi } from '../server/holdem/engine.js';

const SO_SEED = Math.max(20, Number(process.argv[2] ?? 400) | 0);
const CO_MAP = Math.max(4, Number(process.argv[3] ?? 8) | 0);
const PHIEN_BAN = process.argv[4] ?? HOLDEM_BALANCE_VERSION;
const LUAT = luatCua(PHIEN_BAN);

/*
 * ⚠ ĐỌC ĐÚNG BẢNG CỦA PHIÊN BẢN ĐANG ĐO. Bảng cân trôi có hai đời (v21 và
 * v23), và một script đo lấy nhầm bảng thì nó in ra "bp hiện" của một bộ luật
 * khác — nội suy suy từ đó sai toàn bộ mà vẫn ra số trông hợp lý.
 */
const BANG = LUAT.canTroi2 ? CAN_TROI_BP_V23 : CAN_TROI_BP;

const MA = TAI_SAN.map((t) => t.id);
const VON_DAU = 10000;

const gheMoi = (id: string): GheMoi => ({
  id, loai: 'bot', bac_rank: 'Đồng',
  danh_muc: { tai_san: [], chien_thuat: [] },
});

/** Phân vị theo cách "nearest-rank" — không nội suy, không đẻ số không tồn tại. */
function phanVi(xs: readonly number[], p: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(p * s.length) - 1))]!;
}

interface DoDuoc { tam: Record<string, number>; p05: Record<string, number>;
  p95: Record<string, number>; tren: Record<string, number>; soVong: number; }

function doMot(luat: ReturnType<typeof luatCua>): DoDuoc {
  const boi: Record<string, number[]> = Object.fromEntries(MA.map((m) => [m, []]));
  let soVongTb = 0;

  for (let i = 0; i < SO_SEED; i += 1) {
    const seed = 5_000_000 + i;
    let st = taoTran(seed, MA.map((m) => gheMoi(`g_${m}`)), luat, CO_MAP);

    // Vòng 1: mỗi ghế dồn toàn bộ tiền mặt vào ĐÚNG mã của nó.
    MA.forEach((m) => {
      const r = apLenhVongNav(st, `g_${m}`, [{ ma: m, tien: VON_DAU }]);
      if (r.ok) st = r.st;
    });

    let vong = 0;
    while (!daKetThuc(st) && vong < CO_MAP) {
      /*
       * Không ai ra lệnh gì thêm — đây chính là phép đo "ôm và ngồi". Vòng
       * cược luôn THEO: bỏ bài là ghế rời trận và phép đo mất một mã giữa
       * chừng, còn tố thì đó lại là một chính sách chứ không phải phép đo.
       */
      st = giaiQuyetVong(st, () => ({ loai: 'theo' as const })).trangThai;
      vong += 1;
    }
    soVongTb += vong;

    for (const m of MA) {
      const g = st.ghe.find((x) => x.id === `g_${m}`);
      /*
       * ⚠ ĐO GIÁ TRỊ VỊ THẾ, KHÔNG ĐO NAV — bản đầu của script này đo NAV và
       * đó là sai lầm phương pháp: NAV gồm cả tiền thưởng Quỹ vòng, mà quỹ
       * chia theo THỨ HẠNG giữa các ghế. Ghế ôm mã tốt vừa lãi theo giá vừa
       * được chia quỹ nhiều hơn ⇒ phép đo tự KHUẾCH ĐẠI khoảng cách giữa các
       * mã, rồi bảng hiệu chỉnh suy từ nó sẽ cân quá tay theo đúng hướng đó.
       * Vị thế thì chỉ chịu giá — đúng thứ `CAN_TROI_BP` sinh ra để chỉnh.
       */
      if (g) boi[m]!.push(Object.values(g.vi_the).reduce((a, b) => a + b, 0) / VON_DAU);
    }
  }

  const soVong = Math.max(1, Math.round(soVongTb / SO_SEED));
  const lay = (f: (xs: number[]) => number): Record<string, number> =>
    Object.fromEntries(MA.map((m) => [m, f(boi[m]!)]));
  return {
    tam: lay((xs) => phanVi(xs, 0.5)),
    p05: lay((xs) => phanVi(xs, 0.05)),
    p95: lay((xs) => phanVi(xs, 0.95)),
    tren: lay((xs) => xs.filter((x) => x >= 1).length / Math.max(1, xs.length)),
    soVong,
  };
}

const doTrai = (t: Record<string, number>): number =>
  Math.max(...MA.map((m) => t[m]!)) / Math.min(...MA.map((m) => t[m]!));

function bang(nhan: string, d: DoDuoc): void {
  console.log(`
${nhan}`);
  console.log('MÃ      tâm(p50)   p05     p95   %≥1     bp');
  for (const m of MA) {
    console.log(`${m.padEnd(7)} ${d.tam[m]!.toFixed(3).padStart(7)}`
      + ` ${d.p05[m]!.toFixed(2).padStart(7)} ${d.p95[m]!.toFixed(2).padStart(7)}`
      + ` ${(d.tren[m]! * 100).toFixed(1).padStart(5)}% ${String(BANG[m] ?? 0).padStart(6)}`);
  }
  console.log(`độ trải (tốt nhất / tệ nhất): ${doTrai(d.tam).toFixed(2)}×`);
}

function main(): void {
  console.log(`ĐO TRÔI KỲ VỌNG — ${SO_SEED} seed · map ${CO_MAP} ô · ${PHIEN_BAN}`);
  console.log('(mỗi ghế ôm 100% một mã suốt trận, không giao dịch thêm)');

  const nay = doMot(LUAT);
  bang(`■ ĐANG ĐO — ${PHIEN_BAN} (cân trôi: ${LUAT.canTroi ? 'BẬT' : 'TẮT'})`, nay);

  if (!LUAT.canTroi) {
    console.log('\ncân trôi đang TẮT ⇒ đây là mốc gốc, không có gì để nội suy.');
    return;
  }

  /*
   * ─── NỘI SUY HAI ĐIỂM, TỰ ĐỘNG ─────────────────────────────────────────
   * D54 phải làm tay và đã cân QUÁ TAY ở vòng đầu (usd vọt ×1,91), vì bp nền
   * còn bị nhân bởi sức căng/chu kỳ nên "bp cần bù" KHÔNG bằng công thức
   * trung vị thô. Cách chắc chắn là đo HAI điểm rồi nội suy độ dốc THẬT của
   * từng mã trên thang log:
   *     điểm A: bp = 0        (cùng bộ luật, chỉ tắt cân trôi)
   *     điểm B: bp = hiện tại
   *     độ dốc = (ln tâm_B − ln tâm_A) / bp_hiện_tại
   * Rồi giải ngược cho mức bp đưa tâm về ĐÍCH.
   */
  const goc = doMot({ ...LUAT, canTroi: false });
  bang('■ MỐC GỐC — cùng bộ luật, TẮT cân trôi', goc);

  /*
   * ⚠ ĐÍCH LÀ TRUNG BÌNH NHÂN CỦA CHÍNH CÁC MÃ, KHÔNG PHẢI 1,00.
   * Mọi mã đều < 1 vì TRƯỢT GIÁ một lần lúc vào lệnh all-in — chi phí đó
   * đồng đều nên nó KHÔNG phải trôi, và kéo mọi mã lên 1,00 chính là trả
   * tiền cho người chơi vì tội giao dịch. Thứ cần triệt là ĐỘ TRẢI giữa các
   * mã, tức đưa mọi mã về cùng một mức — mức nào không quan trọng.
   */
  const dich = Math.exp(MA.reduce((a, m) => a + Math.log(nay.tam[m]!), 0) / MA.length);
  console.log(`
■ ĐỀ XUẤT — đích = trung bình nhân = ${dich.toFixed(3)}`);
  console.log('MÃ      độ dốc/bp   bp hiện   bp đề xuất   (đổi)');
  for (const m of MA) {
    const bpHien = BANG[m] ?? 0;
    const doDoc = bpHien === 0 ? 0
      : (Math.log(nay.tam[m]!) - Math.log(goc.tam[m]!)) / bpHien;
    const them = doDoc === 0 ? 0
      : Math.round((Math.log(dich) - Math.log(nay.tam[m]!)) / doDoc / 10) * 10;
    console.log(`${m.padEnd(7)} ${doDoc.toFixed(6).padStart(10)} ${String(bpHien).padStart(9)}`
      + ` ${String(bpHien + them).padStart(12)}   ${them >= 0 ? '+' : ''}${them}`);
  }
  console.log('\n⚠ ÁP XONG PHẢI ĐO LẠI: nội suy tuyến tính trên thang log là XẤP XỈ,');
  console.log('  và mọi mã cùng đổi thì bối cảnh chung cũng đổi theo một chút.');
  console.log('⚠ RỒI CHẠY LẠI G1–G4 — đây là tham số kinh tế, nó dịch cả bàn.');
}

main();
