/**
 * D307 — LỚP VN: hai ma trận độ lớn hiệu chỉnh theo thị trường Việt Nam.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO BÀI NÀY DỰNG LẠI MA TRẬN THAY VÌ CHÉP LẠI NÓ
 *
 * Founder 08/09 hỏi đúng câu khó: *"có lo bị vặn 'dữ liệu này ở đâu' không? Kiểu chúng ta
 * sẽ phải gộp rất cẩn thận và có toán học chống lưng thì mới gộp được."* Một bài test chép
 * lại 54 con số rồi so bằng `toEqual` KHÔNG trả lời được câu đó — nó chỉ chứng minh hôm nay
 * tôi gõ giống hôm qua tôi gõ. Đúng lớp "bài canh rỗng" của A11.23 và D262/D269/D272.
 *
 * Nên §I **tính lại từng ô từ DỮ LIỆU THÔ** (lợi suất VN 6 tháng + cỡ mẫu) qua đúng công
 * thức gộp co rút, rồi so với hằng số trong `config/holdem.ts`. Ai sửa một ô mà không sửa
 * dữ liệu nguồn ⇒ ĐỎ. Ai đổi `K`/`k` ⇒ đỏ ở mọi ô đổi theo. Đó mới là "toán học chống lưng":
 * công thức là thứ CHẠY ĐƯỢC, không phải một đoạn văn trong doc.
 *
 * Nguồn + bảng từng ô: `docs/thiet-ke-de-xuat/gameplay/lop-vn-nguon-va-gop.md`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION,
  MT_TAI_SAN_GIAI_DOAN, MT_TAI_SAN_GIAI_DOAN_VN,
  MT_TAI_SAN_SU_KIEN, MT_TAI_SAN_SU_KIEN_VN,
  luatCua, mtGiaiDoan, mtSuKien,
} from '../config/holdem.js';

const V40 = 'balance-v40-lichcodinh';
const V41 = 'balance-v41-lopvn';

// ── Công thức gộp (doc §2) — viết một lần, dùng cho cả hai ma trận ──────────
/** Hằng nén thang chơi. ⚠ KHÔNG từ dữ liệu — xem doc §2 và §5. */
const K = 0.55;
/** Tiên nghiệm toàn cầu đáng giá bằng 4 quan sát VN (= số đợt bear VN có sổ). */
const k_ = 4;

/** Làm tròn về lưới 300, xa-số-0 khi hoà. `|| 0` để −0 và +0 là MỘT (Object.is phân biệt). */
const lamTron300 = (x: number) => (Math.sign(x) * Math.round(Math.abs(x) / 300) * 300) || 0;
const kep = (x: number, tran: number) => Math.max(-tran, Math.min(tran, x));

/**
 * ô_mới = làm_tròn_300( kẹp( g + w·(K·r_VN − g) ) ), w = n/(n+4).
 * `n = 0` ⇒ w = 0 ⇒ trả về đúng `g` (ô không đổi một bp — BTC, chiến tranh, cấm vận…).
 */
function gopCoRut(g: number, rVN: number, n: number, tran: number): number {
  const w = n / (n + k_);
  return lamTron300(kep(g + w * (kep(K * rVN, tran) - g), tran));
}

// ── Dữ liệu thô VN (doc §3) — lợi suất 6 tháng, bp ─────────────────────────
const N_PHA = { tang: 12, giam: 5, di_ngang: 4, bien_dong: 1, phuc_hoi: 3 } as const;
type PhaId = keyof typeof N_PHA;

/** bp/ô. Vắng mã = không có mẫu VN riêng (BTC) ⇒ n = 0 ở mọi ô. */
const R_PHA: Record<string, Record<PhaId, number>> = {
  cp_cn: { tang: 1250, giam: -2200, di_ngang: 350, bien_dong: 1000, phuc_hoi: 1900 },
  vn30: { tang: 890, giam: -1630, di_ngang: 250, bien_dong: 720, phuc_hoi: 1360 },
  vang: { tang: 430, giam: 540, di_ngang: 300, bien_dong: 1450, phuc_hoi: 760 },
  usd: { tang: 75, giam: 330, di_ngang: 100, bien_dong: -15, phuc_hoi: 210 },
  tpcp: { tang: 200, giam: -200, di_ngang: 200, bien_dong: 630, phuc_hoi: 400 },
};

const N_SK = { tang_lai_suat: 3, ha_lai_suat: 3, lam_phat: 2, dich_benh: 1 } as const;
type SkVn = keyof typeof N_SK;

const R_SK: Record<SkVn, Record<string, number>> = {
  tang_lai_suat: { cp_cn: -4900, vn30: -3500, vang: 1200, usd: 400, tpcp: -2000 },
  ha_lai_suat: { cp_cn: 2800, vn30: 2000, vang: 1600, usd: 100, tpcp: 1000 },
  lam_phat: { cp_cn: -2900, vn30: -2100, vang: 1200, usd: 440, tpcp: -2000 },
  dich_benh: { cp_cn: -3000, vn30: -3300, vang: 1450, usd: 0, tpcp: 1300 },
};

/**
 * LEVER D20 (doc §2) — trú ẩn phải CÓ GIÁ ở pha êm, nếu không Phòng thủ chạy trốn (đo
 * 20/07: thắng 47%). Đè lên KẾT QUẢ công thức, và chỉ ở ĐÚNG hai ô: công thức ra +27 bp
 * cho vàng và −119 bp cho USD ở `tang`. Bảy ô trú ẩn còn lại tự thoả sau khi làm tròn.
 */
const LEVER: Record<string, number> = { 'vang.tang': -300, 'usd.tang': -300 };

describe('I. ⭐⭐ Dựng lại ma trận VN từ dữ liệu thô — không chép số', () => {
  it('mọi ô GIAI ĐOẠN khớp công thức gộp co rút (lever chặn đúng 2 ô, khai đích danh)', () => {
    for (const [ma, hangVn] of Object.entries(MT_TAI_SAN_GIAI_DOAN_VN)) {
      const hangGoc = MT_TAI_SAN_GIAI_DOAN[ma]!;
      for (const pha of Object.keys(N_PHA) as PhaId[]) {
        const g = hangGoc[pha]!;
        const r = R_PHA[ma]?.[pha];
        // Không có dòng dữ liệu VN ⇒ n = 0 ⇒ ô phải Y HỆT bộ toàn cầu.
        const tinh = r === undefined ? g : gopCoRut(g, r, N_PHA[pha], 1200);
        const cho = LEVER[`${ma}.${pha}`];
        const mong = cho !== undefined ? Math.min(tinh, cho) : tinh;
        expect(hangVn[pha], `${ma} × ${pha}: công thức ra ${mong}`).toBe(mong);
      }
    }
  });

  it('mọi ô SỰ KIỆN khớp công thức; 8 sự kiện không có mẫu VN thì KHÔNG đổi một bp', () => {
    for (const [ma, hangVn] of Object.entries(MT_TAI_SAN_SU_KIEN_VN)) {
      const hangGoc = MT_TAI_SAN_SU_KIEN[ma]!;
      for (const [sk, goc] of Object.entries(hangGoc)) {
        const r = R_SK[sk as SkVn]?.[ma];
        const mong = r === undefined ? goc : gopCoRut(goc, r, N_SK[sk as SkVn], 2400);
        expect(hangVn[sk as never], `${ma} × ${sk}: công thức ra ${mong}`).toBe(mong);
      }
    }
  });

  it('⭐ ĐẾM ô đổi — con số trong doc phải là con số máy đếm được', () => {
    /*
     * Bản nháp của doc ghi "34/102 ô đổi" và SAI: tôi đếm tay, quên rằng hai ô
     * (`vang × ha_lai_suat`, `usd × lam_phat`) co rút xong rơi lại đúng giá trị cũ.
     * Một con số trong tài liệu mà không ai đếm lại thì sẽ trôi (D61) — nên nó nằm ở đây.
     * Sửa bộ số VN mà quên sửa doc ⇒ ĐỎ, và thông báo nói luôn số đúng.
     */
    const dem = (a: Record<string, Record<string, number>>, b: Record<string, Record<string, number>>) => {
      let doi = 0; let tong = 0;
      for (const ma of Object.keys(a)) {
        for (const k of Object.keys(a[ma]!)) { tong += 1; if (a[ma]![k] !== b[ma]![k]) doi += 1; }
      }
      return { doi, tong };
    };
    const gd = dem(MT_TAI_SAN_GIAI_DOAN, MT_TAI_SAN_GIAI_DOAN_VN);
    const sk = dem(MT_TAI_SAN_SU_KIEN, MT_TAI_SAN_SU_KIEN_VN);
    expect({ gd: gd.doi, sk: sk.doi, tong: gd.tong + sk.tong },
      'doc lop-vn-nguon-va-gop §4.0 phải khớp con số này').toEqual({ gd: 16, sk: 16, tong: 102 });
  });

  it('⭐ hàng BTC không đổi một bp ở CẢ HAI ma trận — không có "BTC của VN"', () => {
    expect(MT_TAI_SAN_GIAI_DOAN_VN['btc']).toEqual(MT_TAI_SAN_GIAI_DOAN['btc']);
    expect(MT_TAI_SAN_SU_KIEN_VN['btc']).toEqual(MT_TAI_SAN_SU_KIEN['btc']);
  });

  it('⭐ ba phát hiện VN đổi DẤU/ĐỘ LỚN so bộ toàn cầu — đây là lý do cả đợt tồn tại', () => {
    // 1. TPCP thôi làm boong-ke: bear VN đi kèm siết lãi (2008 · 2011 · 2022).
    expect(MT_TAI_SAN_GIAI_DOAN['tpcp']!.giam).toBe(600);
    expect(MT_TAI_SAN_GIAI_DOAN_VN['tpcp']!.giam).toBe(300);
    // 2. Vàng TĂNG khi NHNN tăng lãi (bộ cũ chép logic Fed: lợi suất thực lên ⇒ vàng xuống).
    expect(MT_TAI_SAN_SU_KIEN['vang']!.tang_lai_suat).toBe(-1200);
    expect(MT_TAI_SAN_SU_KIEN_VN['vang']!.tang_lai_suat).toBe(-300);
    // 3. Lạm phát KHÔNG có lợi cho cổ phiếu VN (CPI 23% năm 2008, 18,6% năm 2011).
    expect(MT_TAI_SAN_SU_KIEN['vn30']!.lam_phat).toBe(600);
    expect(MT_TAI_SAN_SU_KIEN_VN['vn30']!.lam_phat).toBe(0);
    // 4. Bất đối xứng lên/xuống: bull VN +18,5%/năm vs bear −29,7%/năm.
    expect(MT_TAI_SAN_GIAI_DOAN_VN['vn30']!.tang).toBe(600);
    expect(MT_TAI_SAN_GIAI_DOAN_VN['vn30']!.giam).toBe(-900);
  });

  it('⚠ bài này BẮT ĐƯỢC cú sửa lén: đổi một ô mà không đổi dữ liệu nguồn ⇒ lệch', () => {
    // Tiêm lỗi ngay trong bài (A11.23 — bài canh phải chứng minh nó canh được).
    const oThat = MT_TAI_SAN_GIAI_DOAN_VN['vn30']!.giam;
    const tinhLai = gopCoRut(MT_TAI_SAN_GIAI_DOAN['vn30']!.giam, R_PHA['vn30']!.giam, 5, 1200);
    expect(oThat).toBe(tinhLai);
    // Đổi cỡ mẫu (n) hoặc lợi suất (r) là ô PHẢI đổi — nếu không thì công thức chỉ là trang trí.
    expect(gopCoRut(MT_TAI_SAN_GIAI_DOAN['vn30']!.giam, R_PHA['vn30']!.giam, 0, 1200))
      .not.toBe(oThat);
    expect(gopCoRut(MT_TAI_SAN_GIAI_DOAN['vn30']!.giam, -300, 5, 1200)).not.toBe(oThat);
  });
});

describe('II. Cờ tắt = bộ cũ, từng byte', () => {
  it('hai cửa trả về CHÍNH object bộ toàn cầu (===) khi cờ tắt — trận cũ không trôi', () => {
    expect(mtGiaiDoan('v40')).toBe(MT_TAI_SAN_GIAI_DOAN);
    expect(mtSuKien('v40')).toBe(MT_TAI_SAN_SU_KIEN);
    expect(mtGiaiDoan('v41')).toBe(MT_TAI_SAN_GIAI_DOAN_VN);
    expect(mtSuKien('v41')).toBe(MT_TAI_SAN_SU_KIEN_VN);
  });

  it('hai ma trận VN phủ ĐÚNG bộ mã và bộ trạng thái của bộ cũ — không thiếu ô, không thừa ô', () => {
    expect(Object.keys(MT_TAI_SAN_GIAI_DOAN_VN).sort())
      .toEqual(Object.keys(MT_TAI_SAN_GIAI_DOAN).sort());
    expect(Object.keys(MT_TAI_SAN_SU_KIEN_VN).sort())
      .toEqual(Object.keys(MT_TAI_SAN_SU_KIEN).sort());
    for (const ma of Object.keys(MT_TAI_SAN_SU_KIEN)) {
      expect(Object.keys(MT_TAI_SAN_SU_KIEN_VN[ma]!).sort(), `thiếu sự kiện ở ${ma}`)
        .toEqual(Object.keys(MT_TAI_SAN_SU_KIEN[ma]!).sort());
    }
  });
});

describe('III. Bảng luật — cờ lopVn', () => {
  it('false ở mọi khoá < 41 (bật ở bản cũ = viết lại kết quả trận đã lưu), true từ v41', () => {
    const soCua = (x: string) => Number(/^balance-v(\d+)/.exec(x)?.[1] ?? NaN);
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      if (soCua(ten) >= 41) expect(luat.lopVn, `"${ten}" phải bật`).toBe(true);
      else expect(luat.lopVn, `"${ten}" bật cờ`).toBe(false);
    }
    expect(luatCua(null).lopVn).toBe(false);
    // D313 (09/09) — founder LẬT v42, mà v42 xếp chồng v41 ⇒ lớp VN theo đó lên mặc định.
    expect(luatCua(HOLDEM_BALANCE_VERSION).lopVn, 'mặc định prod nay phải mang lớp VN')
      .toBe(true);
  });

  it('v41 khác v40 đúng MỘT cờ (quy ước bảng: bản mới xếp chồng mọi cờ cũ)', () => {
    const a = luatCua(V40) as unknown as Record<string, boolean>;
    const b = luatCua(V41) as unknown as Record<string, boolean>;
    expect(Object.keys(b).filter((x) => a[x] !== b[x])).toEqual(['lopVn']);
  });
});

describe('IV. ⭐⭐ MỘT CỬA — không tệp server nào đọc thẳng hằng số ma trận', () => {
  /*
   * Bài học `bangCanTroi` viết lại lần hai (rà 11/08): engine đổi bảng theo cờ còn bot đọc
   * thẳng hằng số ⇒ bot MUA theo bảng này rồi bị CHẤM bằng bảng kia, và gate G1/G4 đo trên
   * chênh lệch hai bảng chứ không đo kỹ năng. Cú trôi đó KHÔNG BAO GIỜ ném lỗi — nên phải
   * có một bài quét mã nguồn, không thể trông vào việc "nhớ".
   */
  const quet = (thuMuc: string, ra: string[] = []): string[] => {
    for (const ten of readdirSync(thuMuc)) {
      const p = path.join(thuMuc, ten);
      if (statSync(p).isDirectory()) quet(p, ra);
      else if (ten.endsWith('.ts')) ra.push(p);
    }
    return ra;
  };

  it('mọi lần đọc ma trận trong server/ đi qua mtGiaiDoan()/mtSuKien()', () => {
    const xau: string[] = [];
    for (const p of quet(path.resolve(process.cwd(), 'server'))) {
      const src = readFileSync(p, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const dong of src.split('\n')) {
        if (!/MT_TAI_SAN_(GIAI_DOAN|SU_KIEN)/.test(dong)) continue;
        // Dòng `import` được phép nhắc tên (kiểu/ hằng dùng cho mặc định của hàm cửa).
        if (/^\s*(import|export)\b/.test(dong) || /^\s{2}MT_TAI_SAN_/.test(dong)) continue;
        xau.push(`${path.relative(process.cwd(), p)}: ${dong.trim().slice(0, 90)}`);
      }
    }
    expect(xau, `đọc thẳng hằng số ⇒ bot và engine sẽ dùng hai bảng khác nhau:\n${xau.join('\n')}`)
      .toEqual([]);
  });
});
