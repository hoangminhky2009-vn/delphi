/**
 * v53 (D373) — ÚP Ô ĐANG CHƠI: bài canh "ai biết gì lúc nào".
 *
 * ─── BÀI NÀY CANH GÌ, VÀ VÌ SAO NÓ PHẢI TỒN TẠI ────────────────────────────
 * v53 không đổi một phép tính tiền nào. Nó đổi ĐÚNG MỘT thứ: ô của vòng còn úp
 * lúc người chơi quyết định. Thứ hỏng khi làm sai không phải một con số sai —
 * mà là một CỬA RÒ: ô úp ló ra qua `xu_huong`, qua `lai_suat`, qua nấc thanh
 * khoản của bảng điện tử, hoặc qua chính con bot ngồi cạnh. Không cửa nào
 * trong số đó làm test cũ đỏ, vì test cũ hỏi "số có đúng không", còn ở đây câu
 * hỏi là "số ấy có được phép xuất hiện lúc này không".
 *
 * ⚠⚠ MỌI MỤC ĐỀU HAI CHIỀU, CỐ Ý. Mỗi khẳng định "v53 giấu X" đi kèm một
 * khẳng định "v52 vẫn lộ X". Bài một chiều ở đây sẽ XANH VĨNH VIỄN nếu ai đó
 * lỡ tay làm cả hai phiên bản cùng giấu (hoặc cùng lộ) — đúng lớp "bài canh
 * rỗng" đã bắt được ba lần trong hai ngày (D262 · D269 · D272). Vế v52 chính
 * là mũi tiêm lỗi ngược nằm sẵn trong bài.
 */
import { describe, expect, it } from 'vitest';
import {
  apMoTietKiem, boiCanhUpCua, laiSuatLuc, laiSuatThayDuoc, oVongUp, soVong, taoTran, vongDaLat,
  type CongLuatTran, type GheMoi, type TrangThaiTran,
} from '../server/holdem/engine.js';
import { apNhipLenhBotNav } from '../server/holdem/nhip_lenh_bot.js';
import { dungBangDienTu } from '../server/holdem/bang_dien_tu.js';
import { timBot } from '../server/holdem/bots.js';
import { LAI_SUAT_NEN, laiTietKiemBp, luatCua } from '../config/holdem.js';
import type { OThiTruong, TrangThaiO } from '../server/holdem/map.js';

// ---------------------------------------------------------------------------
// Đồ nghề — bàn dàn tay, ba ô, để cô lập ĐÚNG câu hỏi "được thấy ô nào".
// ---------------------------------------------------------------------------

const gd = (g: 'tang' | 'giam' | 'di_ngang' | 'bien_dong'): OThiTruong =>
  ({ kind: 'giai_doan', giai_doan: g });
/** Tin THẬT báo trước pha `bao`. `that=false` ⇒ tin bịa (telegraph không kéo gì). */
const tin = (
  bao: 'tang' | 'giam', that = true, id: 'ha_lai_suat' | 'tang_lai_suat' = 'ha_lai_suat',
): OThiTruong => ({
  kind: 'su_kien', su_kien: id, la_tin_gia: !that,
  boi_canh: 'don_doc', bao_truoc: bao,
});

const tt = (
  run: -1 | 0 | 1, lai: number = LAI_SUAT_NEN.KHOI_DIEM, oLich = false,
): TrangThaiO => ({
  giai_doan_nen: run === 1 ? 'tang' : run === -1 ? 'giam' : 'di_ngang',
  run_huong: run,
  run_dai: 1,
  face_prior_bp: 5000,
  suc_cang_bp: [0, 0, 0, 0, 0, 0],
  o_lich: oLich,
  lai_suat_diem: lai,
  tail_face: null,
});

/** Bộ cờ của v52/v53 THẬT — không gõ tay bảng cờ, để cờ mới tự chảy vào bài. */
const LUAT = (oUp: boolean): CongLuatTran => ({
  ...luatCua(oUp ? 'balance-v53-upo' : 'balance-v52-dadang'),
});

const GHE: readonly GheMoi[] = [
  { id: 'ban', loai: 'nguoi', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
  { id: 'b1', loai: 'bot', bac_rank: 'Đồng', danh_muc: { tai_san: [], chien_thuat: [] } },
];

/**
 * Bàn ba ô — `oNay` là ô CỦA VÒNG (lá quyết toán vòng đang chơi), `oTin` là lá đã lật ngay trước nó:
 *   ô 1 = tin đã lật (telegraph)   ô 2 = `oNay` (ô của vòng)   ô 3 = đệm
 * Ở v52 người chơi + bot thấy ô 2; ở v53 thì không.
 *
 * ⚠ VÒNG KHÁC NHAU THEO LUẬT, CỐ Ý (D382). Luật ngửa (v52): vòng N quyết toán bằng `o[N−1]` ⇒ ô 2 là ô của
 * VÒNG 2. Luật ô úp (v53, sửa tại chỗ ở D382 theo chỉ đạo founder): `o[0]` là lá mở màn, vòng N quyết toán bằng
 * `o[N]` ⇒ cùng ô 2 ấy là ô của VÒNG 1. Bản cũ ghim `vong: 2` cho cả hai ⇒ ở v53 nó hỏi về ô ĐỆM (đã lật cả
 * `oTin` lẫn `oNay`) — 6 bài đỏ từ `75cd2e0d` (D382) tới 10/10 vì fixture, không vì engine.
 */
function ban(oUp: boolean, oNay: OThiTruong, oTin: OThiTruong = tin('tang')): TrangThaiTran {
  const st = taoTran(4242, GHE, LUAT(oUp));
  return {
    ...st,
    map: {
      ...st.map,
      o: [oTin, oNay, gd('di_ngang')],
      trang_thai: [tt(0), tt(0), tt(0)],
    },
    vong: oUp ? 1 : 2,
  };
}

const BOTS = [timBot('tin_moi_tin')!, timBot('hoai_nghi')!];
/** Ảnh chụp "bot đã mua gì" — thứ duy nhất đáng so ở đây. */
const viThe = (st: TrangThaiTran): string => JSON.stringify(
  st.ghe.map((g) => [g.id, g.von, { ...g.vi_the }]),
);

// ---------------------------------------------------------------------------

describe('I. ⭐ BOT KHÔNG ĐƯỢC ĐỌC Ô ÚP', () => {
  /*
   * ĐÂY LÀ MỤC ĐẮT NHẤT CỦA CẢ BÀI. Úp ô với người mà không úp với bot thì mọi
   * số gate sau đó đo "ai nhiều thông tin hơn" chứ không đo kỹ năng — và điều
   * đó sẽ KHÔNG hiện ra ở bất kỳ test nào khác, vì bot vẫn chạy, vẫn mua, vẫn
   * ra số. Phép thử: đổi HẲN ô của vòng (tăng ↔ giảm) rồi hỏi bot có đổi ý không.
   */
  it('v53: thay ô của vòng TĂNG ↔ GIẢM mà lệnh bot KHÔNG đổi một chip', () => {
    const a = apNhipLenhBotNav(ban(true, gd('tang')), BOTS);
    const b = apNhipLenhBotNav(ban(true, gd('giam')), BOTS);
    expect(viThe(a)).toBe(viThe(b));
  });

  it('v52 (tiêm ngược): CÙNG phép thử đó PHẢI ra khác — nếu không, bài trên rỗng', () => {
    const a = apNhipLenhBotNav(ban(false, gd('tang')), BOTS);
    const b = apNhipLenhBotNav(ban(false, gd('giam')), BOTS);
    expect(viThe(a)).not.toBe(viThe(b));
  });

  it('v53: bot VẪN đọc lời báo của lá tin VỪA LẬT — không phải mù hẳn', () => {
    // Đổi telegraph của ô ĐÃ LẬT (tăng ↔ giảm) thì bot phải đổi ý. Không đổi ⇒
    // v53 đã biến bot thành con bấm bừa, và G4 ("đọc tin đẻ ra kỹ năng") chết theo.
    const a = apNhipLenhBotNav(ban(true, gd('di_ngang'), tin('tang')), BOTS);
    const b = apNhipLenhBotNav(ban(true, gd('di_ngang'), tin('giam')), BOTS);
    expect(viThe(a)).not.toBe(viThe(b));
  });
});

describe('I-b. ⭐⭐ D379 — ÚP ĐỀU MỌI LOẠI Ô, VÀ MỖI VÒNG LẬT ĐÚNG MỘT LÁ', () => {
  /*
   * ⚠ KHỐI NÀY TRƯỚC ĐÂY KHẲNG ĐỊNH NGƯỢC LẠI ("ô TIN vẫn ngửa — v53 chỉ úp ô PHA").
   * Chính vế miễn-ô-tin ấy là con bug founder báo 22/09:
   *   *"ở thẻ sự kiện tôi được chốt vòng 2 lần, cả 2 đều tính kết quả… rồi lật một phát
   *   2 thẻ tiếp theo thay vì 1 thẻ"* — và *"rất thường xuyên xảy ra"*.
   *
   * Vì `vongDaLat` = vong−1 ở vòng PHA nhưng = vong ở vòng TIN, con trỏ "ô đã lật" NHẢY
   * HAI BẬC mỗi lần đổi loại ô ⇒ bản đồ lật hai lá, và ô tin bị coi là đã lật nên kết quả
   * bị tính một lần lúc lật rồi tính lại lúc chốt.
   *
   * Nên bài không canh "loại ô nào úp" nữa — nó canh TÍNH CHẤT mà bug đã vi phạm:
   * **`vongDaLat` tăng ĐÚNG MỘT mỗi vòng, bất kể ô thuộc loại gì.** Ghim tính chất thì
   * không ai sửa lại được bằng cách thêm một ngoại lệ mới cho một loại ô mới.
   */
  it('ô TIN cũng bị úp — không còn ngoại lệ theo loại ô', () => {
    const st = { vong: 3, o_up: true, map: { o: [gd('tang'), gd('tang'), tin('tang'), gd('tang')] } };
    expect(oVongUp(st as never), 'ô tin mà không úp ⇒ con trỏ nhảy hai bậc').toBe(true);
  });

  it('⭐ `vongDaLat` TĂNG ĐÚNG MỘT mỗi vòng trên một bản đồ pha↔tin xen kẽ', () => {
    const o = [gd('tang'), tin('tang'), gd('giam'), tin('giam'), gd('tang'), gd('giam')];
    const day = [1, 2, 3, 4, 5, 6].map(
      (v) => vongDaLat({ vong: v, o_up: true, map: { o } } as never));
    // D382 — mỗi vòng lật đúng MỘT lá mới: o[0] mở màn ở vòng 1, o[1] ở vòng 2, …
    expect(day, 'dãy ô-đã-lật phải đi từng bước một').toEqual([1, 2, 3, 4, 5, 6]);
    const buoc = day.slice(1).map((x, i) => x - day[i]!);
    /*
     * ⚠ VẾ NÀY TỪNG LỌT LỖI: bản đầu chỉ cấm bước > 1 (nhảy hai lá) mà quên cấm bước 0
     * (lật lại lá cũ) — và bước 0 chính là con bug founder gặp ngay sau đó. Nay ghim
     * ĐÚNG MỘT, cấm cả hai chiều.
     */
    expect(buoc.every((b) => b === 1), 'bước ≠ 1 ⇒ lật hai lá hoặc lật lại lá cũ').toBe(true);
  });
});

describe('II. Ô KỲ VỌNG — hình dạng bối cảnh bot ở v53', () => {
  it('v52 ⇒ null (không có ô kỳ vọng nào cả)', () => {
    expect(boiCanhUpCua(ban(false, gd('tang')))).toBeNull();
  });

  it('lời báo lấy từ ô VỪA LẬT, và ô kỳ vọng là một ô PHA (không bao giờ là tin)', () => {
    const b = boiCanhUpCua(ban(true, gd('giam'), tin('tang')))!;
    expect(b.up.bao_truoc).toBe('tang');
    expect(b.o.kind).toBe('giai_doan');
  });

  it('ô vừa lật KHÔNG phải tin ⇒ không có lời báo, chỉ còn nền', () => {
    const b = boiCanhUpCua(ban(true, gd('giam'), gd('tang')))!;
    expect(b.up.bao_truoc).toBeNull();
  });

  it('`that` khai đúng tin thật/bịa — ưu đãi oracle, không rải cho ghế thường', () => {
    expect(boiCanhUpCua(ban(true, gd('tang'), tin('tang', true)))!.that).toBe(true);
    expect(boiCanhUpCua(ban(true, gd('tang'), tin('tang', false)))!.that).toBe(false);
  });

  it('vòng 1 (chưa ô nào lật): nền ĐI NGANG, không lời báo, không ném', () => {
    // Ô đầu map là ô PHA — `sinhMap` cấm sự kiện ở vòng 1, nên bàn thử phải giống luật thật.
    /*
     * D379 — vòng 1 KHÔNG còn úp, nên bối cảnh-úp của bot không tồn tại ở vòng 1 nữa.
     * Dời vế này sang VÒNG 2 (vòng úp đầu tiên thật sự) — giữ nguyên thứ nó canh: chưa
     * lá tin nào lật thì nền ĐI NGANG và không có lời báo nào để nghiêng theo.
     */
    // D382 — `vongDaLat` nay = vòng, nên cùng một lá thì vòng lùi đi một.
    const st = { ...ban(true, gd('di_ngang'), gd('tang')), vong: 1 };
    const b = boiCanhUpCua(st)!;
    expect(b.up.bao_truoc, 'chưa lá tin nào lật thì không có lời báo').toBeNull();
    expect(vongDaLat(st), 'ở vòng 2 thì ô đã lật là ô 1').toBe(1);
  });
});

describe('III. LÃI SUẤT: mức NHÌN THẤY vs mức ĐANG CHẠY GIÁ', () => {
  /** Bàn có kỳ họp ở ô 2 (ô của vòng): mức sau họp 400, mức trước họp 325. */
  const banHop = (oUp: boolean): TrangThaiTran => {
    const st = ban(oUp, gd('di_ngang'));
    return {
      ...st,
      map: { ...st.map, trang_thai: [tt(0, 325), tt(0, 400, true), tt(0, 400)] },
    };
  };

  /*
   * Vế "engine vẫn dùng mức sau" tách sang `o_up_v53_lai_ap.test.ts` (sổ cách ly): từ D382 `laiSuatLuc` đọc mức của lá ĐÃ LẬT
   * cuối, không phải lá quyết toán — founder 10/10 chọn B: lỗi D382 bỏ sót, chữa bằng khoá mới, v53–v65 giữ cho replay.
   */
  it('v53: mức nhìn thấy là mức TRƯỚC kỳ họp chưa lật — kỳ họp úp không rò qua con số', () => {
    const st = banHop(true);
    expect(laiSuatThayDuoc(st)).toBe(325);
  });

  it('v52 (tiêm ngược): hai hàm TRÙNG nhau — nếu lệch, mọi trận cũ đã đổi mặt', () => {
    const st = banHop(false);
    expect(laiSuatThayDuoc(st)).toBe(laiSuatLuc(st));
    expect(laiSuatThayDuoc(st)).toBe(400);
  });

  it('v53: hợp đồng tiết kiệm KHOÁ theo mức nhìn thấy, không theo mức sau họp', () => {
    const st = banHop(true);
    const r = apMoTietKiem(st, 'ban', [{ so_vong: 2, moc_bp: 2500 }]);
    expect(r.ok).toBe(true);
    const hd = r.st.ghe.find((g) => g.id === 'ban')!.tiet_kiem![0]!;
    expect(hd.lai_bp).toBe(laiTietKiemBp(325, 2));
    expect(hd.lai_bp).not.toBe(laiTietKiemBp(400, 2));
  });
});

describe('IV. BẢNG ĐIỆN TỬ không bán hộ ô úp', () => {
  /*
   * Bảng đọc ô để tính nấc thanh khoản + giả định "tin đang nổ là thật". Ở v53
   * ô ấy còn úp, nên đọc nó là moi ô chưa lật ra với giá 25 Vốn — đúng thứ
   * docstring bảng gọi là "lừa có thu phí".
   */
  const nac = (st: TrangThaiTran): string => dungBangDienTu(st, 'ban')
    .thanh_khoan.map((x) => [x.tai_san_id, x.nac ?? '?'].join(':')).join('|');

  /*
   * ⚠ PHẢI LÀ `bien_dong` vs `di_ngang`, KHÔNG phải tăng vs giảm. Lần đầu bài này viết
   * tăng↔giảm và vế tiêm ngược ĐỎ: `THANH_KHOAN_DONG.MONG_DI_GIAI_DOAN` chỉ có `bien_dong`,
   * nên tăng và giảm cho ra nấc y hệt — tức vế v53 khi ấy XANH vì không đo gì cả. Đúng lớp
   * bài canh rỗng mà vế hai chiều sinh ra để bắt, và nó đã bắt được ngay trong phiên viết.
   */
  it('v53: đổi ô của vòng ⇒ nấc thanh khoản KHÔNG đổi', () => {
    expect(nac(ban(true, gd('bien_dong')))).toBe(nac(ban(true, gd('di_ngang'))));
  });

  it('v52 (tiêm ngược): CÙNG phép thử đó phải ra khác', () => {
    expect(nac(ban(false, gd('bien_dong')))).not.toBe(nac(ban(false, gd('di_ngang'))));
  });

  it('v53 vòng 1 (chưa ô nào lật): bảng vẫn mở được, không ném', () => {
    const st = { ...ban(true, gd('tang')), vong: 1 };
    expect(() => dungBangDienTu(st, 'ban')).not.toThrow();
  });
});
describe('D383 — Ô VÒNG 1 VẪN ÚP: cái ngửa là LÁ MỞ MÀN o[0], không phải ô của vòng', () => {
  /*
   * ⚠ KHỐI NÀY TỪNG KHẲNG ĐỊNH NGƯỢC LẠI (D379: "ô vòng 1 luôn ngửa") và đó là một mô hình
   * SAI, sống đúng vài tiếng. Nó ngửa chính lá sẽ tính tiền cho vòng 1 ⇒ vừa lộ đáp án vừa
   * hết lá để lật ở vòng 2 (founder: *"thẻ 1 bấm chốt vòng xong chỉ xám chứ không lật thẻ
   * thứ 2"*).
   * Mô hình ĐÚNG (D382): bộ bài nhiều hơn số vòng MỘT lá. `o[0]` là bối cảnh mở màn — ngửa,
   * không tính tiền; ô CỦA VÒNG 1 là `o[1]` và nó VẪN ÚP.
   */
  it('vòng 1: ô của vòng vẫn úp (lá đang úp là o[1])', () => {
    const st = { vong: 1, o_up: true, map: { o: [gd('tang'), gd('tang'), gd('tang')] } };
    expect(oVongUp(st as never), 'không úp ⇒ lộ lá tính tiền cho vòng 1').toBe(true);
    expect(vongDaLat(st as never), 'vòng 1 đã lật đúng lá mở màn ⇒ 1').toBe(1);
  });

  it('⭐ số vòng = số ô − 1: bộ bài k ô chỉ chạy được k−1 vòng', () => {
    const st = { o_up: true, map: { o: [gd('tang'), gd('tang'), gd('tang')] } };
    expect(soVong(st as never)).toBe(2);
    expect(soVong({ map: { o: st.map.o } } as never), 'luật cũ: số vòng == số ô').toBe(3);
  });
});

