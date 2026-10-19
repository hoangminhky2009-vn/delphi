/**
 * economy_sim — VỎ CLI. Logic thật ở `server/kinh_te/` (deploy chỉ đóng gói
 * api/server/config; import từ `scripts/` lúc chạy là crash function — đã dính
 * 18/07, ghi ở đầu `scripts/audit_supply.ts`).
 *
 * Đây là món nợ D16 ("đổi tham số kinh tế phải chạy lại economy_sim TRƯỚC
 * deploy") — treo từ 17/07, trả 05/09. Xem `docs/dac-ta/05-kinh-te-token.md` §F.
 *
 * CHẠY:
 *   npm run kinh-te:sim              — đẳng thức D16 + đọc lại sau D86 + quét trợ cấp
 *   npm run kinh-te:sim -- --that    — thêm SỐ THẬT từ DB (cần DATABASE_URL)
 *
 * ⚠ Sim này KHÔNG dựng lại mô hình tác nhân của D16 và nói rõ vì sao — xem khối
 * chú thích đầu `server/kinh_te/mo_phong.ts`. Muốn có mô hình hành vi thì phải
 * ĐO từ sổ thật (`--that`), không phải đoán lại.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ECONOMY } from '../config/economy.js';
import { createPool } from '../server/db.js';
import { docBaoCaoKinhTe } from '../server/kinh_te/bao_cao.js';
import {
  canDoiMuaDocQuyen, chiPhiBattlePass, chuKyKhoBac, chuKyMuaMoi,
  nghiaVuMuaLai, phiThuVe, quetTroCap, soLanDoiTayCanCo, tongCungDuKien,
  tyLeQuyenDoiTrenCung, vongQuayChoCanCo,
} from '../server/kinh_te/mo_phong.js';
import { CHANG_LO_TRINH, MUA_0_0 } from '../config/progression.js';
import { BATTLE_PASS, HE_THONG_MUA_LAI_DOC_BAN } from '../config/battle_pass.js';
import { CHO, PHI } from '../config/cho.js';
import { giaSan } from '../server/kinh_te/gia.js';

const DO = '\x1b[31m';
const XANH = '\x1b[32m';
const VANG = '\x1b[33m';
const MO = '\x1b[2m';
const HET = '\x1b[0m';

/** Bốn con số D16 §5 công bố cho 1.000 user × 90 ngày. Chép, không tính lại. */
const D16 = {
  rake: 37_457n, nen: 52_156n, troCap: 14_250n, sanHoa: 25_716n, bonus: 38_000n,
} as const;

const t = (v: bigint) => `${v.toLocaleString('vi-VN')} T`;

function inChuKy(): void {
  const dauMua = BigInt(ECONOMY.TREASURY_GENESIS);
  const goc = chuKyKhoBac({ dauMua, ...D16 });
  const sauD86 = chuKyKhoBac({ dauMua, ...D16, rake: 0n });
  const dayDu = chuKyKhoBac({ dauMua, ...D16, rake: 0n, nen: 0n });

  console.log('\n=== CHU KỲ KHO BẠC MỘT MÙA (1.000 user × 90 ngày, số D16 §5) ===\n');
  console.log(`  D16 nguyên bản                  ${t(goc.cuoiMua)}  ${XANH}✔ tuần hoàn được${HET}`);
  console.log(`  ${MO}20.000 +37.457 rake +52.156 nén −14.250 trợ cấp −25.716 sàn −38.000 bonus${HET}`);
  console.log();
  console.log(`  Sau D86 — rake = 0              ${DO}${t(sauD86.cuoiMua)}${HET}  ${DO}✖ reset mùa KHÔNG CHẠY NỔI${HET}`);
  console.log(`  ${MO}rake là 42% thu nhập; mất nó là mất đúng vế giữ Kho bạc dương${HET}`);
  console.log();
  console.log(`  Đọc đủ hai vế — nén cũng → 0    ${DO}${t(dayDu.cuoiMua)}${HET}  ${DO}✖${HET}`);
  console.log(`  ${MO}không có chợ cược thì không ai giàu lên ⇒ không có gì để nén${HET}`);
  console.log();
  console.log(`  ⇒ Phí chợ vật phẩm phải gánh ${t(D16.rake)}/mùa mới hoà được D16.`);
  console.log(`    Với phí 2% vào Kho bạc, vòng quay chợ cần ≈ ${t(D16.rake * 50n)}/mùa.`);
}

function inQuet(): void {
  const soDu = BigInt(ECONOMY.TREASURY_GENESIS);
  console.log('\n=== QUÉT TRỢ CẤP — Kho bạc gánh được bao lâu (không cần giả định hành vi) ===\n');
  for (const soNguoi of [1, 10, 100, 1_000]) {
    // Quét ĐÚNG mức trợ cấp đang cấu hình. Bản đầu tìm mức đó trong dải mặc
    // định rồi `!` — tức là sẽ nổ ngay khi founder đổi `SUBSIDY_AMOUNT` sang
    // một số không nằm trong dải. Truyền thẳng thì không có gì để tìm hụt.
    const hang = quetTroCap(soDu, soNguoi, 90, [ECONOMY.SUBSIDY_AMOUNT]);
    const m = hang[0]!;
    const nhan = m.du ? `${XANH}đủ 90 ngày${HET}` : `${DO}chỉ ${m.runway} ngày${HET}`;
    console.log(`  ${String(soNguoi).padStart(5)} người nhận/ngày × ${ECONOMY.SUBSIDY_AMOUNT} T`
      + `  ⇒ chi ${String(m.chiMoiNgay).padStart(7)} T/ngày  ${nhan}`);
  }
  console.log(`\n  ${MO}Mốc C2 là 5.000 user. Ở đó trợ cấp là một vòi không có nguồn bù.${HET}`);
}

/**
 * CẤU TRÚC MỚI 05/09: Q gộp về T, battle pass game trả T, lộ trình PFM trả Q-mới.
 * In ra CÁI GIÁ của quyết định đó — không đặt số nào, chỉ tính hệ quả (A8.2).
 */
function inNganHangTrungUong(): void {
  const soNguoi = 1_000;
  const soChang = MUA_0_0.SO_CHANG;
  const qMoiMua = CHANG_LO_TRINH.reduce((t, c) => t + c.q, 0);

  console.log('');
  console.log('=== KHO BẠC LÀM NGÂN HÀNG TRUNG ƯƠNG — bảng cân đối, KHÔNG máy in ===');
  console.log('');
  console.log('  A3.4 cấm mint T. Mọi đồng battle pass trả ra phải THU vào trước;');
  console.log('  nguồn thu duy nhất còn lại sau D86 là phí chợ 2%.');
  console.log('');
  console.log(`  Lộ trình hiện có ${soChang} chặng, tổng ${qMoiMua} Q/mùa/người.`);
  console.log('  Nếu battle pass trả T ở đúng thang cũ của Q:');
  console.log('');
  console.log('   T/chặng   chi cả mùa (1.000 người)   vòng quay chợ PHẢI đạt');
  console.log('   ' + '─'.repeat(64));
  for (const muc of [60, 20, 10, 5, 2, 1]) {
    const chi = chiPhiBattlePass(muc, soChang, soNguoi);
    const vong = vongQuayChoCanCo(chi, ECONOMY.RAKE_TREASURY_BP)!;
    const canh = muc >= 20 ? DO : muc >= 5 ? VANG : XANH;
    console.log(`   ${canh}${String(muc).padStart(6)}${HET}   ${t(chi).padStart(22)}`
      + `   ${canh}${t(vong).padStart(20)}${HET}`);
  }
  console.log('');
  console.log(`  ${MO}Để so: TOÀN BỘ rake chợ dự báo của sim D16 là ${t(D16.rake)}/mùa,${HET}`);
  console.log(`  ${MO}tương ứng vòng quay ${t(D16.rake * 50n)}/mùa.${HET}`);

  const chiCu = chiPhiBattlePass(60, soChang, soNguoi);
  const canCu = vongQuayChoCanCo(chiCu, ECONOMY.RAKE_TREASURY_BP)!;
  console.log(`  ${DO}⇒ Giữ nguyên thang cũ (60/chặng) đòi vòng quay gấp `
    + `${canCu / (D16.rake * 50n)} LẦN mức D16 từng cần.${HET}`);

  console.log('');
  console.log('  Chu kỳ mùa nếu battle pass 5 T/chặng và phí chợ đạt đúng mức rake cũ:');
  const kq = chuKyMuaMoi({
    dauMua: BigInt(ECONOMY.TREASURY_GENESIS),
    phiCho: D16.rake, nen: D16.nen,
    troCap: D16.troCap, sanHoa: D16.sanHoa, bonus: D16.bonus,
    battlePass: chiPhiBattlePass(5, soChang, soNguoi),
  });
  const mau = kq.amKhongChayNoi ? DO : XANH;
  console.log(`    ${mau}${t(kq.cuoiMua)}${HET}`
    + `  ${kq.amKhongChayNoi ? `${DO}✖ vẫn âm${HET}` : `${XANH}✔ sống${HET}`}`);
}

/**
 * VẬT PHẨM ĐỘC QUYỀN — chỗ battle pass tìm được nguồn nuôi, hoặc không.
 * Không đặt số nào; chỉ tính hệ quả của các mức để founder chốt (A8.2).
 */
function inVatPhamDocQuyen(): void {
  const soNguoi = 1_000;
  const soChang = MUA_0_0.SO_CHANG;
  const soNgayMua = MUA_0_0.SO_TUAN * 7;
  const soBan = BATTLE_PASS.SO_MAU_DOC_BAN * soNguoi;
  const gia = giaSan('epic', 0, CHO.HS_QUY_BP_MAC_DINH);
  const phiBp = PHI.KHO_BAC_BP;

  console.log('');
  console.log('=== VẬT PHẨM ĐỘC QUYỀN MÙA — phát miễn phí tạo QUYỀN ĐÒI, không tạo tiền ===');
  console.log('');
  console.log(`  ${BATTLE_PASS.SO_MAU_DOC_BAN} mẫu độc bản × ${soNguoi.toLocaleString('vi-VN')} người`
    + ` = ${soBan.toLocaleString('vi-VN')} bản lưu hành.`);
  console.log(`  Giá bậc epic ở kho rỗng, quỹ đầy: ${t(gia)}/bản.`);
  console.log('');

  const quyenDoi = nghiaVuMuaLai(soBan, gia);
  const cung = tongCungDuKien(soNguoi);
  const tyLe = tyLeQuyenDoiTrenCung(quyenDoi, cung)!;
  const thuMotLuot = phiThuVe(gia, phiBp);
  console.log('  Phát MIỄN PHÍ ⇒ không đồng T nào đi vào, mà quyền bán lại cho Hệ thống');
  console.log('  thì y hệt món đã trả tiền (gacha có giá lượt quay đi vào trước).');
  console.log('');
  console.log(`  Quyền đòi tạo ra  : ${DO}${t(quyenDoi)}${HET}`);
  console.log(`  Cung tiền tồn tại : ${t(cung)}   ${MO}(${soNguoi.toLocaleString('vi-VN')} × vốn khởi điểm + genesis)${HET}`);
  console.log(`  ${DO}⇒ ${Math.round(tyLe / 100)}% cung tiền. A3.4 cấm mint`
    + ` ⇒ KHÔNG TRẢ NỔI về mặt số học, dù gom hết tiền của tất cả mọi người.${HET}`);
  console.log(`  ${VANG}⚠ Và audit:supply vẫn CÂN suốt quá trình đó — sổ không đếm lời hứa,`
    + ` nó đếm tiền. Vì thế E24 phải là một bất biến RIÊNG.${HET}`);
  console.log(`  ${MO}(HE_THONG_MUA_LAI_DOC_BAN = ${HE_THONG_MUA_LAI_DOC_BAN})${HET}`);
  console.log('');
  console.log(`  Đường hợp lệ là đi QUA CỬA CHỢ, không phải người-sang-người: §7.15 xếp`);
  console.log(`  đường tiền P2P vào KÝ GỬI (Điều 57 K5) và cờ P2P_TRUC_TIEP chưa có code.`);
  console.log(`  Mỗi lượt qua cửa vẫn nộp ${XANH}+${t(thuMotLuot)}${HET} về Kho bạc — phép đo không đổi.`);

  console.log('');
  console.log('  Battle pass trả T phải sống bằng phí đó. MỖI BẢN phải qua cửa chợ mấy lượt:');
  console.log('');
  console.log('   T/chặng   chi cả mùa      lượt qua chợ/bản/mùa   ≈ cách nhau');
  console.log('   ' + '─'.repeat(64));
  for (const muc of [60, 20, 10, 5, 2, 1]) {
    const chi = chiPhiBattlePass(muc, soChang, soNguoi);
    const lan = soLanDoiTayCanCo(chi, soBan, gia, phiBp);
    const cach = lan === null || lan === 0
      ? '—' : `${(soNgayMua / lan).toFixed(1).replace('.', ',')} ngày`;
    const canh = lan === null ? MO : lan >= 9 ? DO : lan >= 4 ? VANG : XANH;
    console.log(`   ${canh}${String(muc).padStart(6)}${HET}   ${t(chi).padStart(14)}`
      + `   ${canh}${String(lan ?? 'vô nghiệm').padStart(17)}${HET}   ${canh}${cach}${HET}`);
  }
  console.log('');
  console.log(`  ${MO}Mùa 0.0 dài ${MUA_0_0.SO_TUAN} tuần = ${soNgayMua} ngày.`
    + ` Một bản qua chợ 50 lượt trong ${soNgayMua} ngày là vô lý;${HET}`);
  console.log(`  ${MO}1–2 lần thì bình thường. Đó là cùng một phép đo với bảng vòng quay`
    + ` ở trên, chỉ đổi sang đơn vị thẩm định được.${HET}`);

  // Chiều ngược lại: cho trước một nhịp đổi tay NGHE ĐƯỢC, mức T nào nuôi nổi?
  const nhip = 2;
  console.log('');
  console.log(`  Chiều ngược lại — GIẢ SỬ mỗi bản qua chợ ${nhip} lượt/mùa`
    + ` (${MO}giả định, chưa đo${HET}):`);
  for (const muc of [5, 2, 1]) {
    const cd = canDoiMuaDocQuyen(
      chiPhiBattlePass(muc, soChang, soNguoi),
      { soBan, giaMoiLan: gia, soLanDoiTayMoiBan: nhip },
      phiBp,
    );
    const dau = cd.tuNuoiDuoc ? `${XANH}✔ tự nuôi được` : `${DO}✖ phải bù`;
    console.log(`    ${String(muc).padStart(2)} T/chặng: phí thu ${t(cd.phiThu)}`
      + `  ·  chi ${t(cd.chiT)}  ·  ${dau} ${t(cd.chenhLech < 0n ? -cd.chenhLech : cd.chenhLech)}${HET}`);
  }

  const choArt = CHANG_LO_TRINH.filter((c) => c.nhan !== undefined && c.mon_id === null).length;
  const giaoDuoc = CHANG_LO_TRINH.filter((c) => c.mon_id !== null).length;
  console.log('');
  console.log(`  ${DO}⚠ NỢ ART (A11.14) — cái giá đứng trước cái lợi:${HET}`);
  console.log(`     Mùa 0.0 đã hứa ${choArt + giaoDuoc} phần thưởng cosmetic;`
    + ` giao được hôm nay: ${XANH}${giaoDuoc}${HET}, chờ art: ${DO}${choArt}${HET}.`);
  console.log(`  ${MO}   "Vật phẩm độc quyền MỖI MÙA" nhân món nợ đó lên theo số mùa.`
    + ` Nợ art là nợ đắt nhất repo (D68).${HET}`);
}

async function inSoThat(): Promise<void> {
  const pool = createPool();
  try {
    const b = await docBaoCaoKinhTe(pool);
    console.log('\n=== SỐ THẬT TỪ SỔ ===\n');
    console.log(`  Mẫu số: ${b.mauSo.that} người thật `
      + `(${b.mauSo.tongTaiKhoan} tài khoản · ${b.mauSo.tester} tester · ${b.mauSo.khach} khách)`);
    if (b.mauSo.canhBaoMauSo) {
      console.log(`  ${VANG}⚠ Dưới ${'30'} người thật — mọi TỶ LỆ dưới đây là giai thoại, `
        + `không phải phép đo (A11.1/D223).${HET}`);
    }
    console.log(`\n  Tổng cung ${t(BigInt(b.cung.tongCung))}  ·  ví ${t(BigInt(b.cung.sigmaVi))}`
      + `  ·  Kho bạc ${t(BigInt(b.cung.khoBac))}  ·  đã đốt ${t(BigInt(b.cung.daDot))}`);
    console.log(`  Sổ CÂN: ${b.cung.can ? `${XANH}✔${HET}` : `${DO}✖ ${b.cung.vanDe.join(' · ')}${HET}`}`);
    console.log(`\n  Kho bạc chi ${t(BigInt(b.khoBacDong.chiMoiNgay7Ngay))}/ngày (7 ngày gần nhất)`);
    console.log(`  Runway: ${b.khoBacDong.runwayNgay === null
      ? `${MO}không xác định — chưa chi đồng nào trong cửa sổ${HET}`
      : `${b.khoBacDong.runwayNgay} ngày`}`);
    console.log(`\n  Q: phát ${b.q.phat} · tiêu ${b.q.tieu} · tồn ${b.q.ton}`
      + ` · trần phát/mùa ${b.q.tranPhatMua}`);
    console.log(`  Q sink/phát: ${b.q.sinkPhatBp === null
      ? `${MO}null — chưa phát Q nào, KHÔNG phải 0${HET}` : `${b.q.sinkPhatBp} bp`}`);
    console.log(`
  CHỢ VẬT PHẨM (${b.cho.cuaSoNgay} ngày): ${b.cho.soLuotMua} lượt mua`
      + `  ·  vòng quay ${t(BigInt(b.cho.vongQuayT))}`
      + `  ·  quỹ chợ ${b.cho.quyCho === null
        ? `${MO}null — chưa chạy 0058${HET}` : t(BigInt(b.cho.quyCho))}`);
    console.log(`  Phí thu: đốt ${t(BigInt(b.cho.phiDot))} · Kho bạc ${t(BigInt(b.cho.phiKhoBac))}`
      + `  ·  ${b.cho.soLuotPhiBang0 > 0 ? VANG : ''}${b.cho.soLuotPhiBang0} lượt đóng 0 phí`
      + `${b.cho.soLuotPhiBang0 > 0 ? HET : ''}`
      + ` ${MO}(3%/2% làm tròn về 0 dưới 34/50 T — sàn phí còn treo)${HET}`);
    console.log(`  Chỉ số giá THỰC HIỆN: ${b.cho.chiSoThucHienBp === null
      ? `${MO}null — chưa đủ giao dịch ở đủ ba bậc, KHÔNG phải 0${HET}`
      : `${b.cho.chiSoThucHienBp} bp  ·  sức mua ${b.cho.sucMuaBp} bp`}`);
    console.log(`  ${MO}   mẫu theo bậc: ${Object.entries(b.cho.soGiaoDichTheoBac)
      .map(([k, v]) => `${k} ${v}`).join(' · ')}${HET}`);
    console.log(`\n  Median ví: ${b.phanPhoi.medianVi ?? `${MO}null${HET}`}`
      + `  ·  Gini: ${b.phanPhoi.giniBp === null ? `${MO}null${HET}` : `${b.phanPhoi.giniBp} bp`}`);

    console.log('\n  BÁO ĐỘNG:');
    if (b.baoDong.length === 0) {
      console.log(`    ${XANH}✔ không có dòng nào nổ${HET} ${MO}(chỉ số null thì im — đúng thiết kế)${HET}`);
    } else {
      for (const d of b.baoDong) {
        const mau = d.muc === 'do' ? DO : VANG;
        console.log(`    ${mau}${d.muc === 'do' ? '✖' : '⚠'} ${d.ma}${HET}  đo ${d.do}  ·  ngưỡng ${d.nguong}`);
      }
    }
  } finally {
    await pool.end();
  }
}

const laMain = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (laMain) {
  inChuKy();
  inQuet();
  inNganHangTrungUong();
  inVatPhamDocQuyen();
  if (process.argv.includes('--that')) await inSoThat();
  console.log(`\n${MO}Mọi số PLAYTEST-TUNE. Agent không đặt tham số kinh tế (A8.2) —`
    + ` đo, trình, founder chốt.${HET}\n`);
}
