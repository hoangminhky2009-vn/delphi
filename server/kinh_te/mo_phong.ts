/**
 * MÔ PHỎNG KINH TẾ — HÀM THUẦN (tầng T0 của `docs/thiet-ke-de-xuat/kinh-te/
 * kien-truc-ky-thuat.md` §2). Không I/O, không DB, không đọc `now()`.
 *
 * ─── ĐÂY LÀ MÓN NỢ D16, TRẢ SAU 50 NGÀY ─────────────────────────────────────
 * D16 (17/07) quy định: đổi tham số kinh tế phải chạy lại `economy_sim` TRƯỚC
 * deploy. Sim đó **chưa bao giờ vào repo** (nợ ghi ở `docs/dac-ta/05-kinh-te-
 * token.md` §F), nên từ đó tới nay mọi con số kinh tế đề xuất đều là ước lượng
 * không tái lập được. File này trả nợ đó.
 *
 * ─── VIẾT BẰNG TS VÀ IMPORT CÔNG THỨC THẬT, KHÔNG CHÉP LẠI (founder chốt) ────
 * D16 ghi `economy_sim.py`. Một bản Python là **cài đặt thứ hai của cùng công
 * thức**, và bản thứ hai SẼ trôi im lặng đúng vào lúc cần tin nó nhất (D61/
 * A11.5). Nên: TS là bản chính, import thẳng `config/economy.ts`; bản Python
 * chỉ chạy MỘT lượt đối chứng rồi đóng băng, có ngày chết ghi tại chỗ (A8.9).
 *
 * ─── SIM NÀY *KHÔNG* TÁI LẬP MÔ HÌNH TÁC NHÂN CỦA D16, VÀ NÓI THẲNG VÌ SAO ───
 * Bảng số D16 §5 ra từ một mô phỏng theo từng người (10% tryhard / 30% regular
 * / 60% casual, w = 1,15 vs 0,92). Nhưng **các giả định hành vi sinh ra nó chưa
 * bao giờ được ghi ra**: số kèo/ngày, cỡ cược, số lượt gacha, tỷ lệ xong quest
 * đều không có trong tài liệu. Dựng lại chúng là BỊA, rồi trình bày như "tái
 * lập D16" là bịa có dấu má.
 *
 * Nên sim này chia đôi dứt khoát:
 *   · **Phần ĐẲNG THỨC** (dưới đây) — kiểm tay được TỪNG SỐ với D16, vì nó chỉ
 *     là số học trên chính bốn con số D16 đã công bố. Đây là phần có test vector.
 *   · **Phần QUÉT** (`quetTroCap`) — không cần biết hành vi: nó hỏi ngược
 *     "mỗi ngày chi bao nhiêu thì Kho bạc còn sống được bao lâu", và đó đúng là
 *     câu hỏi sau D86.
 * Muốn có lại mô hình tác nhân thì phải ĐO từ `wallet_ledger` thật (đó là việc
 * của `bao_cao.ts`), không phải đoán lại.
 */
import { ECONOMY, MUA } from '../../config/economy.js';
import { GUARDRAIL, GR_BP } from '../../config/guardrail.js';

// ───────────────────────────────── số học ─────────────────────────────────

/** Căn bậc hai nguyên (floor). Newton trên BigInt — tất định, không float (C5). */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error(`isqrt của số âm: ${n}`);
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * Bước 1 của reset mùa — NÉN (D16 mục 4).
 * `ví > NEN_MOC → NEN_MOC + isqrt(ví − NEN_MOC) × NEN_HE_SO`; phần dôi về Kho bạc.
 * Ví ≤ mốc thì không đụng tới.
 */
export function nenVi(vi: bigint): { sau: bigint; veKhoBac: bigint } {
  if (vi < 0n) throw new Error(`ví âm: ${vi}`);
  const moc = BigInt(MUA.NEN_MOC);
  if (vi <= moc) return { sau: vi, veKhoBac: 0n };
  const sau = moc + isqrt(vi - moc) * BigInt(MUA.NEN_HE_SO);
  return { sau, veKhoBac: vi - sau };
}

/** Bước 2 — SÀN: kéo ví dưới sàn lên, chi từ Kho bạc. */
export function sanHoaVi(vi: bigint): { sau: bigint; khoBacChi: bigint } {
  if (vi < 0n) throw new Error(`ví âm: ${vi}`);
  const san = BigInt(MUA.SAN);
  if (vi >= san) return { sau: vi, khoBacChi: 0n };
  return { sau: san, khoBacChi: san - vi };
}

/** Bước 3 — TIER BONUS theo RANK CƯỢC (D16: 80/50/25; hạng khác = 0). */
export function tierBonus(hang: 'vang' | 'bac' | 'dong' | 'khac'): bigint {
  switch (hang) {
    case 'vang': return BigInt(MUA.BONUS_VANG);
    case 'bac': return BigInt(MUA.BONUS_BAC);
    case 'dong': return BigInt(MUA.BONUS_DONG);
    default: return 0n;
  }
}

// ───────────────────────── chu kỳ Kho bạc một mùa ─────────────────────────

export interface DongKhoBac {
  /** Số dư đầu mùa. Mùa đầu = `ECONOMY.TREASURY_GENESIS`. */
  dauMua: bigint;
  /** VÀO: 2% rake của chợ dự báo. Sau D86 (đóng băng) thì đây là 0. */
  rake: bigint;
  /** VÀO: phần nén cuối mùa. Chỉ có nếu có người ví > NEN_MOC. */
  nen: bigint;
  /** VÀO: phí giao dịch chợ vật phẩm (2%). Chưa tồn tại tới bước B7. */
  phiCho?: bigint;
  /** RA: trợ cấp ngày cả mùa. */
  troCap: bigint;
  /** RA: sàn hoá cuối mùa. */
  sanHoa: bigint;
  /** RA: tier bonus cuối mùa. */
  bonus: bigint;
}

export interface KetQuaKhoBac {
  cuoiMua: bigint;
  tongVao: bigint;
  tongRa: bigint;
  /** Kho bạc có `CHECK balance_after >= 0` ở DB ⇒ âm nghĩa là reset mùa KHÔNG CHẠY NỔI. */
  amKhongChayNoi: boolean;
}

/**
 * Đẳng thức chu kỳ Kho bạc một mùa (D16 §5 dòng cuối). Không có gì hơn một phép
 * cộng trừ — và đó chính là lý do nó kiểm tay được từng số.
 */
export function chuKyKhoBac(d: DongKhoBac): KetQuaKhoBac {
  for (const [ten, v] of Object.entries(d)) {
    if (typeof v === 'bigint' && v < 0n) throw new Error(`${ten} âm: ${v}`);
  }
  const tongVao = d.rake + d.nen + (d.phiCho ?? 0n);
  const tongRa = d.troCap + d.sanHoa + d.bonus;
  const cuoiMua = d.dauMua + tongVao - tongRa;
  return { cuoiMua, tongVao, tongRa, amKhongChayNoi: cuoiMua < 0n };
}

// ──────────────────────────────── runway ──────────────────────────────────

/**
 * Kho bạc còn sống được bao nhiêu NGÀY với nhịp chi hiện tại.
 * `null` = không chi gì ⇒ runway vô hạn. **null chứ không phải một số to**
 * (A11.2/D62: thiếu mẫu là null, không phải 0 — ở đây là "không xác định", và
 * một con số giả sẽ bị đọc như một phép đo thật).
 */
export function runwayNgay(soDu: bigint, chiMoiNgay: bigint): number | null {
  if (soDu < 0n) throw new Error(`số dư âm: ${soDu}`);
  if (chiMoiNgay < 0n) throw new Error(`chi mỗi ngày âm: ${chiMoiNgay}`);
  if (chiMoiNgay === 0n) return null;
  return Number(soDu / chiMoiNgay);
}

/**
 * Runway tính THẲNG từ cửa sổ quan sát, không qua "chi mỗi ngày" trung gian.
 *
 * ⚠ VÌ SAO KHÔNG DÙNG `runwayNgay(soDu, chi/soNgay)`: chia số nguyên làm tròn
 * xuống, nên chi 6 T trong 7 ngày ra "0 T/ngày" ⇒ runway thành `null` ("không
 * chi gì") trong khi thực tế CÓ chi. Một phép đo im lặng đúng lúc nó nên kêu là
 * lỗi tệ hơn một phép đo sai số. Nhân trước, chia sau — cùng nếp A5.1.
 */
export function runwayTuCuaSo(
  soDu: bigint, chiTrongCuaSo: bigint, soNgayCuaSo: number,
): number | null {
  if (soDu < 0n) throw new Error(`số dư âm: ${soDu}`);
  if (chiTrongCuaSo < 0n) throw new Error(`chi trong cửa sổ âm: ${chiTrongCuaSo}`);
  if (!Number.isInteger(soNgayCuaSo) || soNgayCuaSo <= 0) {
    throw new Error(`soNgayCuaSo không hợp lệ: ${soNgayCuaSo}`);
  }
  if (chiTrongCuaSo === 0n) return null;
  return Number((soDu * BigInt(soNgayCuaSo)) / chiTrongCuaSo);
}

/**
 * QUÉT TRỢ CẤP — câu hỏi thật sau D86, và nó không cần một giả định hành vi nào.
 *
 * "Với `soNguoi` người nhận trợ cấp mỗi ngày, Kho bạc `soDu` sống được mấy ngày,
 * và mức trợ cấp nào thì đủ sống hết `soNgayMucTieu`?"
 */
export function quetTroCap(
  soDu: bigint, soNguoiMoiNgay: number, soNgayMucTieu: number,
  cacMuc: readonly number[] = [50, 40, 30, 20, 10],
): Array<{ mucMoiNgay: number; chiMoiNgay: bigint; runway: number | null; du: boolean }> {
  if (!Number.isInteger(soNguoiMoiNgay) || soNguoiMoiNgay < 0) {
    throw new Error(`soNguoiMoiNgay không hợp lệ: ${soNguoiMoiNgay}`);
  }
  if (!Number.isInteger(soNgayMucTieu) || soNgayMucTieu <= 0) {
    throw new Error(`soNgayMucTieu không hợp lệ: ${soNgayMucTieu}`);
  }
  return cacMuc.map((mucMoiNgay) => {
    const chiMoiNgay = BigInt(mucMoiNgay) * BigInt(soNguoiMoiNgay);
    const runway = runwayNgay(soDu, chiMoiNgay);
    return {
      mucMoiNgay,
      chiMoiNgay,
      runway,
      du: runway === null || runway >= soNgayMucTieu,
    };
  });
}

// ─────────────────── KHO BẠC LÀM NGÂN HÀNG TRUNG ƯƠNG ─────────────────────

/**
 * "Kho bạc thành ngân hàng trung ương điều tiết T" (founder 05/09).
 *
 * ⚠ MỘT NGÂN HÀNG TRUNG ƯƠNG KHÔNG CÓ MÁY IN. A3.4 cấm mint T tuyệt đối (ngoại
 * lệ duy nhất: genesis). Nên công cụ của nó không phải cung tiền mà là **bảng
 * cân đối**: nó phải THU trước khi CHI, và ba đòn bẩy thật của nó là
 *   · phí giao dịch (2% vào Kho bạc — hút T về)
 *   · giá/sink (gacha đốt — rút T khỏi lưu thông vĩnh viễn)
 *   · **nghiệp vụ thị trường mở**: mua vật phẩm ⇒ BƠM T ra lưu thông; bán vật
 *     phẩm ⇒ HÚT T về. Đây đúng là cách một ngân hàng trung ương đổi cung tiền
 *     mà không in: đổi tài sản lấy tiền.
 *
 * Ràng buộc bảng cân đối là thứ làm nó thành **giáo cụ**, không phải giới hạn kỹ
 * thuật: người chơi nhìn thấy một nhà điều tiết KHÔNG in được tiền, và tự thấy
 * vì sao mọi khoản chi phải có nguồn.
 */
export interface DongMuaMoi {
  dauMua: bigint;
  /** VÀO: 2% phí chợ vật phẩm — nguồn thu thay rake sau D86. */
  phiCho: bigint;
  /** VÀO: phần nén cuối mùa. */
  nen: bigint;
  /** RA: trợ cấp cả mùa. */
  troCap: bigint;
  /** RA: sàn hoá cuối mùa. */
  sanHoa: bigint;
  /** RA: tier bonus cuối mùa. */
  bonus: bigint;
  /** RA: **battle pass game trả bằng T** (founder 05/09) — vòi MỚI, rút Kho bạc. */
  battlePass: bigint;
}

/** Chu kỳ mùa theo cấu trúc SAU 05/09 (Q gộp về T, battle pass trả T). */
export function chuKyMuaMoi(d: DongMuaMoi): KetQuaKhoBac {
  return chuKyKhoBac({
    dauMua: d.dauMua, rake: 0n, nen: d.nen, phiCho: d.phiCho,
    troCap: d.troCap, sanHoa: d.sanHoa,
    bonus: d.bonus + d.battlePass,
  });
}

/**
 * VÒNG QUAY CHỢ TỐI THIỂU để Kho bạc hoà vốn.
 *
 * Đây là câu hỏi thật của "cân bằng lại nền kinh tế": Kho bạc không in được, nên
 * mọi đồng chi ra phải có một đồng thu vào, và nguồn thu duy nhất còn lại là phí
 * chợ. `dongRa` T chi ra ⇒ cần `dongRa / phí` T đổi tay.
 *
 * Trả `null` khi `phiBp = 0` — không có phí thì không có vòng quay nào đủ, và đó
 * là "vô nghiệm", không phải "bằng 0".
 */
export function vongQuayChoCanCo(dongRa: bigint, phiBp: number): bigint | null {
  if (dongRa < 0n) throw new Error(`dòng ra âm: ${dongRa}`);
  if (!Number.isInteger(phiBp) || phiBp < 0) throw new Error(`phí không hợp lệ: ${phiBp}`);
  if (phiBp === 0) return null;
  // Nhân trước, chia sau — làm TRÒN LÊN, vì đây là mức tối thiểu phải đạt.
  const mau = BigInt(phiBp);
  const tu = dongRa * 10_000n;
  return (tu + mau - 1n) / mau;
}

/**
 * Battle pass trả T thì một mùa tốn bao nhiêu, và cần vòng quay chợ bao nhiêu.
 * `mucMoiChang` là con số founder chốt (A8.2) — hàm này chỉ tính hệ quả.
 */
export function chiPhiBattlePass(
  mucMoiChang: number, soChang: number, soNguoi: number,
): bigint {
  for (const [ten, v] of Object.entries({ mucMoiChang, soChang, soNguoi })) {
    if (!Number.isInteger(v) || v < 0) throw new Error(`${ten} không hợp lệ: ${v}`);
  }
  return BigInt(mucMoiChang) * BigInt(soChang) * BigInt(soNguoi);
}

// ────────── VẬT PHẨM ĐỘC QUYỀN MÙA — TÀI SẢN, KHÔNG PHẢI TIỀN ──────────────

/**
 * "Battle pass cho T và vật phẩm độc quyền mỗi mùa" (founder 05/09).
 *
 * ⚠ PHÁT MỘT VẬT PHẨM KHÔNG PHẢI LÀ MINT T. A3.4 cấm mint T; phát một bản thể
 * vào sổ vật không tạo ra một đồng T nào, nên món độc quyền KHÔNG chạm A3.4.
 *
 * ⚠⚠ NHƯNG NÓ TẠO RA MỘT **QUYỀN ĐÒI T**, VÀ ĐÓ MỚI LÀ CHỖ NGUY HIỂM.
 * Vật phẩm gacha có T ĐI VÀO trước khi nó tồn tại (người mua trả giá lượt quay),
 * nên khi Hệ thống mua lại nó ở `gia_san`, tiền trả ra là tiền đã thu. Vật phẩm
 * battle pass phát MIỄN PHÍ thì **không có đồng nào đi vào**, mà quyền bán lại
 * cho Hệ thống thì y hệt. Phát miễn phí ⇒ nghĩa vụ mua vào tăng, quỹ thì không.
 *
 * Con số ép ra quyết định: 3.000 bản ở giá epic 600 T = **1.800.000 T quyền đòi**,
 * trên một nền kinh tế 1.000 người chỉ có **1.020.000 T tồn tại** (vốn khởi điểm
 * + genesis). Quyền đòi lớn hơn TOÀN BỘ cung tiền — không phải "quỹ mỏng", mà là
 * **không thể trả về mặt số học**. Xem `HE_THONG_MUA_LAI_DOC_BAN` (E24).
 *
 * ⚠ "ĐỔI TAY" Ở ĐÂY LÀ **QUA CỬA CHỢ**, KHÔNG PHẢI P2P. Bản nháp đầu của hàm này
 * viết "đổi tay giữa người chơi" và tính phí 2% trên đó — sai, vì §7.15 xếp
 * đường tiền người-sang-người vào KÝ GỬI (Điều 57 K5) và cờ `P2P_TRUC_TIEP` đang
 * **không có code**. Đường hợp lệ là đi qua Hệ thống, và phí vẫn thu đúng ở đó
 * (`chiaPhi` — 3% đốt + 2% Kho bạc), nên phép đo không đổi, chỉ tên cửa đổi.
 *
 * Bốn hàm dưới trả lời đúng bốn câu, không hơn:
 *   1. qua cửa bấy nhiêu lượt thì chợ quay bao nhiêu T (`vongQuayDocQuyen`)
 *   2. vòng quay đó nộp về Kho bạc bao nhiêu           (`phiThuVe`)
 *   3. để nuôi nổi `dongRa`, MỖI BẢN phải qua cửa mấy lượt (`soLanDoiTayCanCo`)
 *   4. quyền đòi tạo ra có vượt cung tiền không (`tyLeQuyenDoiTrenCung`)
 * Câu 3 là câu đáng hỏi nhất: "vòng quay phải đạt 90 triệu T" không ai thẩm định
 * được bằng trực giác, còn "mỗi bản phải qua chợ 50 lượt trong 8 tuần" thì ai
 * cũng thấy ngay là vô lý.
 */
export interface DongDocQuyen {
  /** Tổng số BẢN đang lưu hành (số mẫu × số người đạt mốc). */
  soBan: number;
  /** Giá trung bình một lần đổi tay. */
  giaMoiLan: bigint;
  /** Số lần một bản đổi tay trong mùa. */
  soLanDoiTayMoiBan: number;
}

function kiemDuong(ten: string, v: number): void {
  if (!Number.isInteger(v) || v < 0) throw new Error(`${ten} không hợp lệ: ${v}`);
}

/** Tổng T đổi tay trong mùa nhờ vật phẩm độc quyền. */
export function vongQuayDocQuyen(d: DongDocQuyen): bigint {
  kiemDuong('soBan', d.soBan);
  kiemDuong('soLanDoiTayMoiBan', d.soLanDoiTayMoiBan);
  if (d.giaMoiLan < 0n) throw new Error(`giaMoiLan âm: ${d.giaMoiLan}`);
  return BigInt(d.soBan) * BigInt(d.soLanDoiTayMoiBan) * d.giaMoiLan;
}

/**
 * Phí Kho bạc thu được trên một vòng quay. LÀM TRÒN XUỐNG — đây là thu, và
 * làm tròn lên một khoản thu là nói dối theo hướng dễ chịu (ngược chiều với
 * `vongQuayChoCanCo`, chỗ đó là mức tối thiểu phải đạt nên tròn LÊN).
 */
export function phiThuVe(vongQuay: bigint, phiBp: number): bigint {
  if (vongQuay < 0n) throw new Error(`vòng quay âm: ${vongQuay}`);
  kiemDuong('phiBp', phiBp);
  return (vongQuay * BigInt(phiBp)) / 10_000n;
}

/**
 * MỖI BẢN phải đổi tay bao nhiêu lần trong mùa thì phí đủ bù `dongRa`.
 *
 * Trả `null` = **VÔ NGHIỆM**, không phải 0 (A11.2). Vô nghiệm khi không có phí,
 * không có bản nào lưu hành, hoặc giá bằng 0 — cả ba đều nghĩa là "không có số
 * lần nào đủ", mà một số 0 ở đây sẽ bị đọc thành "không cần đổi tay lần nào".
 */
export function soLanDoiTayCanCo(
  dongRa: bigint, soBan: number, giaMoiLan: bigint, phiBp: number,
): number | null {
  if (dongRa < 0n) throw new Error(`dòng ra âm: ${dongRa}`);
  kiemDuong('soBan', soBan);
  kiemDuong('phiBp', phiBp);
  if (giaMoiLan < 0n) throw new Error(`giaMoiLan âm: ${giaMoiLan}`);
  if (dongRa === 0n) return 0;
  const mau = BigInt(soBan) * giaMoiLan * BigInt(phiBp);
  if (mau === 0n) return null;
  // Nhân trước chia sau, làm TRÒN LÊN: đây là mức tối thiểu phải đạt.
  const tu = dongRa * 10_000n;
  return Number((tu + mau - 1n) / mau);
}

/**
 * QUYỀN ĐÒI T mà việc phát miễn phí tạo ra, nếu Hệ thống mua lại ở `gia_san`.
 * Không phải một dòng tiền dự kiến; là một dòng tiền SẼ CÓ nếu cửa mua vào nhận
 * món phát miễn phí ngang giá món đã trả tiền.
 */
export function nghiaVuMuaLai(soBan: number, giaSanMoiBan: bigint): bigint {
  kiemDuong('soBan', soBan);
  if (giaSanMoiBan < 0n) throw new Error(`giá sàn âm: ${giaSanMoiBan}`);
  return BigInt(soBan) * giaSanMoiBan;
}

/**
 * Cung tiền T dự kiến của một nền kinh tế `soNguoi` người — **suy ra từ A4, không
 * phải số mới**: mỗi người một vốn khởi điểm, cộng đúng một lần genesis Kho bạc.
 * Đây là trần tuyệt đối của mọi nghĩa vụ, vì A3.4 cấm mint thêm.
 */
export function tongCungDuKien(soNguoi: number): bigint {
  kiemDuong('soNguoi', soNguoi);
  return BigInt(soNguoi) * BigInt(ECONOMY.STARTING_BANKROLL)
    + BigInt(ECONOMY.TREASURY_GENESIS);
}

/**
 * Quyền đòi ÷ cung tiền, tính bằng bp. **> 10.000 bp nghĩa là quyền đòi lớn hơn
 * toàn bộ số T tồn tại** — không phải "quỹ mỏng", mà là không trả nổi về mặt số
 * học, dù có gom hết tiền của tất cả mọi người lại.
 *
 * `null` khi cung tiền bằng 0 — vô nghiệm, không phải 0 (A11.2).
 */
export function tyLeQuyenDoiTrenCung(quyenDoi: bigint, tongCung: bigint): number | null {
  if (quyenDoi < 0n) throw new Error(`quyền đòi âm: ${quyenDoi}`);
  if (tongCung < 0n) throw new Error(`cung âm: ${tongCung}`);
  if (tongCung === 0n) return null;
  return Number((quyenDoi * 10_000n) / tongCung);
}

export interface CanDoiMua {
  /** T battle pass chi ra cả mùa. */
  chiT: bigint;
  /** T đổi tay nhờ vật phẩm độc quyền. */
  vongQuay: bigint;
  /** Phí Kho bạc thu về từ vòng quay đó. */
  phiThu: bigint;
  /** phiThu − chiT. Âm = battle pass đang được trợ giá bằng vốn genesis. */
  chenhLech: bigint;
  /** Battle pass tự nuôi được bằng chính vòng quay nó tạo ra? */
  tuNuoiDuoc: boolean;
  /** Mỗi bản phải đổi tay mấy lần thì hoà. `null` = vô nghiệm. */
  soLanCanCo: number | null;
}

/**
 * Cân đối một mùa: battle pass trả T, vật phẩm độc quyền làm chợ quay, phí trên
 * vòng quay đó trả cho T. Đây là vòng khép kín mà founder chốt 05/09 — và hàm
 * này chỉ nói nó khép được hay không, không đặt một con số nào (A8.2).
 */
export function canDoiMuaDocQuyen(
  chiT: bigint, dq: DongDocQuyen, phiBp: number,
): CanDoiMua {
  if (chiT < 0n) throw new Error(`chi T âm: ${chiT}`);
  const vongQuay = vongQuayDocQuyen(dq);
  const phiThu = phiThuVe(vongQuay, phiBp);
  return {
    chiT,
    vongQuay,
    phiThu,
    chenhLech: phiThu - chiT,
    tuNuoiDuoc: phiThu >= chiT,
    soLanCanCo: soLanDoiTayCanCo(chiT, dq.soBan, dq.giaMoiLan, phiBp),
  };
}

// ─────────────────────────────── guardrail ────────────────────────────────

export type MucBaoDong = 'do' | 'vang';

export interface DongBaoDong {
  ma: string;
  muc: MucBaoDong;
  /** Số đo được (đã làm tròn kiểu hiển thị) và ngưỡng đã vượt — để nhật ký đọc lại được. */
  do: string;
  nguong: string;
}

/**
 * Số đo đầu vào cho guardrail. **`null` = CHƯA CÓ NGUỒN, không phải 0** — chỉ số
 * nào null thì bỏ qua, không kêu (A11.2/D62/D67: thiếu mẫu là null; báo động dựa
 * trên một số 0 giả là báo động sai, và báo động sai thì người ta tắt chuông).
 */
export interface SoDoKinhTe {
  medianVi: bigint | null;
  /**
   * ⚠ `null` = CHƯA ĐO ĐƯỢC (cần bảng cuộn median theo tuần, chưa có nguồn).
   * Trước đây chỗ này là `number` và báo cáo truyền 0 — tức là lặng lẽ khẳng
   * định "đã đo, và chuỗi dài 0 tuần". Đó đúng là kiểu nói dối mà A11.2/D62 cấm,
   * và nó lọt qua vì 0 trông vô hại.
   */
  soTuanMedianDuoiSan: number | null;
  giniBp: number | null;
  khoBacSoDu: bigint | null;
  khoBacRunwayNgay: number | null;
  troCapTuanDuKien: bigint | null;
  /**
   * Đốt ÷ phát, đo TRONG MỘT CỬA SỔ và KHÔNG tính vốn genesis. Đo trên tổng
   * tích luỹ thì genesis (một lần, 20.000 T) làm mẫu số phình vĩnh viễn ⇒ chỉ
   * số luôn thấp ⇒ chuông `t_lam_phat` kêu mãi mãi. Chuông kêu mãi là chuông bị
   * tắt.
   */
  tSinkFaucetBp: number | null;
  troCapVaoLoDotBp: number | null;
  qTonBinhQuan: number | null;
  qTranPhatMua: number;
  qSinkPhatBp: number | null;
}

/** Đánh giá toàn bộ guardrail. Thuần: cùng đầu vào ⇒ cùng danh sách, cùng thứ tự. */
export function danhGiaGuardrail(s: SoDoKinhTe): DongBaoDong[] {
  const ra: DongBaoDong[] = [];
  const them = (ma: string, muc: MucBaoDong, d: string, n: string) =>
    ra.push({ ma, muc, do: d, nguong: n });

  if (s.medianVi !== null) {
    if (s.soTuanMedianDuoiSan !== null
      && s.medianVi < BigInt(GUARDRAIL.MEDIAN_SAN)
      && s.soTuanMedianDuoiSan >= GUARDRAIL.MEDIAN_SO_TUAN) {
      them('median_thap', 'do', `${s.medianVi} T · ${s.soTuanMedianDuoiSan} tuần`,
        `< ${GUARDRAIL.MEDIAN_SAN} T trong ${GUARDRAIL.MEDIAN_SO_TUAN} tuần`);
    }
    if (s.medianVi > BigInt(GUARDRAIL.MEDIAN_TRAN)) {
      them('median_cao', 'vang', `${s.medianVi} T`, `> ${GUARDRAIL.MEDIAN_TRAN} T`);
    }
  }
  if (s.giniBp !== null && s.giniBp > GUARDRAIL.GINI_TRAN_BP) {
    them('gini_cao', 'vang', `${s.giniBp} bp`, `> ${GUARDRAIL.GINI_TRAN_BP} bp`);
  }

  if (s.khoBacSoDu !== null && s.troCapTuanDuKien !== null
    && s.khoBacSoDu < BigInt(GUARDRAIL.KHO_BAC_BOI_TRO_CAP_TUAN) * s.troCapTuanDuKien) {
    them('kho_bac_mong', 'do', `${s.khoBacSoDu} T`,
      `< ${GUARDRAIL.KHO_BAC_BOI_TRO_CAP_TUAN}× trợ cấp tuần (${s.troCapTuanDuKien} T)`);
  }
  if (s.khoBacRunwayNgay !== null && s.khoBacRunwayNgay < GUARDRAIL.KHO_BAC_RUNWAY_NGAY) {
    them('runway_ngan', 'do', `${s.khoBacRunwayNgay} ngày`,
      `< ${GUARDRAIL.KHO_BAC_RUNWAY_NGAY} ngày`);
  }

  if (s.tSinkFaucetBp !== null && s.tSinkFaucetBp < GUARDRAIL.T_SINK_FAUCET_SAN_BP) {
    them('t_lam_phat', 'vang', `${s.tSinkFaucetBp} bp`,
      `< ${GUARDRAIL.T_SINK_FAUCET_SAN_BP} bp`);
  }
  if (s.troCapVaoLoDotBp !== null
    && s.troCapVaoLoDotBp > GUARDRAIL.TRO_CAP_VAO_LO_DOT_TRAN_BP) {
    them('tro_cap_vao_lo_dot', 'do', `${s.troCapVaoLoDotBp} bp`,
      `> ${GUARDRAIL.TRO_CAP_VAO_LO_DOT_TRAN_BP} bp trong ${GUARDRAIL.TRO_CAP_VAO_LO_DOT_SO_NGAY} ngày`);
  }

  // Q — hai dòng đã sửa (xem đầu `config/guardrail.ts`).
  if (s.qTonBinhQuan !== null) {
    const nguongTon = Math.floor(s.qTranPhatMua * GUARDRAIL.Q_TON_TY_LE_BP / GR_BP);
    if (s.qTonBinhQuan > nguongTon) {
      them('q_ton_dong', 'vang', `${s.qTonBinhQuan} Q/user`,
        `> ${nguongTon} Q (= ${GUARDRAIL.Q_TON_TY_LE_BP / 100}% × trần phát ${s.qTranPhatMua})`);
    }
  }
  if (s.qSinkPhatBp !== null) {
    if (s.qSinkPhatBp > GUARDRAIL.Q_SINK_PHAT_TRAN_BP) {
      them('q_ngop', 'vang', `${s.qSinkPhatBp} bp`, `> ${GUARDRAIL.Q_SINK_PHAT_TRAN_BP} bp`);
    }
    if (s.qSinkPhatBp < GUARDRAIL.Q_SINK_PHAT_SAN_BP) {
      them('q_thieu_mon', 'do', `${s.qSinkPhatBp} bp`,
        `< ${GUARDRAIL.Q_SINK_PHAT_SAN_BP} bp — có Q mà không có gì đáng tiêu`);
    }
  }
  return ra;
}

/** Số đo rỗng — mọi chỉ số `null`. Dùng làm nền khi chỉ đo được vài thứ. */
export function soDoRong(qTranPhatMua: number): SoDoKinhTe {
  return {
    medianVi: null, soTuanMedianDuoiSan: null, giniBp: null,
    khoBacSoDu: null, khoBacRunwayNgay: null, troCapTuanDuKien: null,
    tSinkFaucetBp: null, troCapVaoLoDotBp: null,
    qTonBinhQuan: null, qTranPhatMua, qSinkPhatBp: null,
  };
}

/** Hằng số A4 dùng lại cho CLI/báo cáo — không chép giá trị, chỉ tái xuất. */
export const NGUONG_TRO_CAP = ECONOMY.SUBSIDY_THRESHOLD;
