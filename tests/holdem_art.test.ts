/**
 * ARTWORK THẺ BÀI — 26 cảnh SVG nội tuyến.
 *
 * Vì sao cần test: artwork nhúng thẳng vào trang HTML dưới dạng JSON trong
 * <script>. Ba thứ hỏng lặng lẽ mà mắt không thấy ngay:
 *   1. THIẾU LÁ — một mã không có art thì UI lặng lẽ rơi về emoji, trông vẫn
 *      "chạy" nên không ai phát hiện.
 *   2. TRÙNG id trong <defs> — 26 SVG nằm chung một trang; hai lá cùng đặt
 *      id="glow" thì gradient của lá này ăn của lá kia, ra màu sai ngẫu nhiên.
 *   3. THOÁT KHỎI <script> — chuỗi chứa "</script>" sẽ đóng sớm thẻ script và
 *      làm vỡ toàn bộ trang. Đây là lý do ART_JSON phải escape "<".
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ART, KHOA_HOANG_LOAN, KHOA_THIEN_NGA } from '../server/holdem_art.js';
import { LA_BAI } from '../server/art/la_bai.js';
import { LUOI_PIXEL } from '../server/holdem_art_grids.js';
import { CHIEN_THUAT, GIAI_DOAN, SU_KIEN, TAI_SAN, TINH_CHAT_NEN } from '../config/holdem.js';

describe('1. Đủ art cho mọi thứ hiển thị được', () => {
  it('6 tài sản đều có artwork', () => {
    for (const t of TAI_SAN) {
      expect(ART[t.id], `thiếu art cho tài sản "${t.label}"`).toBeTruthy();
    }
  });

  it('10 chiến thuật đều có artwork', () => {
    for (const c of CHIEN_THUAT) {
      expect(ART[c.id], `thiếu art cho chiến thuật "${c.label}"`).toBeTruthy();
    }
  });

  it('5 giai đoạn thị trường đều có artwork (tiền tố gd_)', () => {
    for (const g of GIAI_DOAN) {
      expect(ART[`gd_${g.id}`], `thiếu art cho giai đoạn "${g.label}"`).toBeTruthy();
    }
  });

  it('7 sự kiện vĩ mô đều có artwork (tiền tố sk_)', () => {
    for (const e of SU_KIEN) {
      expect(ART[`sk_${e.id}`], `thiếu art cho sự kiện "${e.label}"`).toBeTruthy();
    }
  });

  it('đủ art cho MỌI thứ catalog công bố, không thừa không thiếu', () => {
    /*
     * Suy từ CONFIG, không gõ số. Bộ bài còn dài ra theo các cụm khắc chế (D5
     * thêm "Đi Ngược"), và một con số cứng ở đây chỉ đẻ ra một test đỏ vô nghĩa
     * mỗi lần thêm thẻ — nó không canh bất biến nào. Bất biến THẬT là: mọi thứ
     * người chơi thấy được đều phải có art, và không có art nào mồ côi.
     */
    const canCo = [
      ...TAI_SAN.map((t) => t.id),
      ...CHIEN_THUAT.map((c) => c.id),
      ...GIAI_DOAN.map((g) => `gd_${g.id}`),
      ...SU_KIEN.map((x) => `sk_${x.id}`),
    ].sort();
    expect(Object.keys(ART).sort()).toEqual(canCo);
  });
});

describe('2. SVG hợp lệ và an toàn', () => {
  for (const [id, svg] of Object.entries(ART)) {
    it(`"${id}" — SVG đúng khuôn, không có thứ nguy hiểm`, () => {
      expect(svg.trim().startsWith('<svg'), 'không bắt đầu bằng <svg').toBe(true);
      expect(svg.trim().endsWith('</svg>'), 'không kết thúc bằng </svg>').toBe(true);
      // Lá mới (D390/D393): viewBox VUÔNG đúng cỡ lưới; sáu lá cảnh cũ giữ 200×150.
      const moi = LA_BAI[id] ?? (KHOA_HOANG_LOAN.includes(id) ? LA_BAI[KHOA_THIEN_NGA] : undefined);
      expect(svg).toContain(moi
        ? `viewBox="0 0 ${moi.luoi.length} ${moi.luoi.length}"`
        : 'viewBox="0 0 200 150"');
      // Không width/height cố định → CSS co giãn được.
      expect(/<svg[^>]*\swidth=/.test(svg), 'có width cố định').toBe(false);
      expect(svg).not.toContain('<script');
      expect(svg).not.toContain('<image');
      expect(svg).not.toContain('</script>');
      // Chỉ được phép một URL: namespace SVG.
      const urls = svg.match(/https?:\/\/[^"']+/g) ?? [];
      for (const u of urls) expect(u).toBe('http://www.w3.org/2000/svg');
    });
  }

  it('đủ giàu chi tiết — đo bằng Ô PIXEL, không bằng số phần tử SVG', () => {
    /*
     * ⚠ ĐỔI THƯỚC ĐO, KHÔNG PHẢI HẠ NGƯỠNG (25/07/2026).
     *
     * Bản cũ đếm số phần tử SVG và đòi >= 25 — hợp lý với art VECTOR, nơi mỗi chi
     * tiết là một phần tử. Với art PIXEL thì nó đo ngược: cả điểm của pixel là GỘP
     * mọi ô cùng màu vào một path để nhẹ, và chính việc gộp đó vừa kéo trang từ
     * 898KB (vỡ ngưỡng 3G) về mức phục vụ được. Giữ thước cũ là phạt đúng thứ mình
     * vừa sửa.
     *
     * Thước đúng cho pixel: bao nhiêu Ô được vẽ, và bao nhiêu MÀU. Ngưỡng lấy DƯỚI
     * sàn đo thật (thấp nhất hiện tại 122 ô / 4 màu, trung bình 236) nên nó bắt
     * được art rỗng, chứ không phải con số vặn cho vừa khít.
     */
    const moi = Object.fromEntries(Object.entries(LA_BAI).map(([id, la]) => [id, la.luoi]));
    for (const [id, luoi] of Object.entries({ ...LUOI_PIXEL, ...moi })) {
      const o = luoi.join('').split('').filter((c) => c !== '.');
      expect(o.length, `"${id}" chỉ ${o.length} ô — quá sơ sài`).toBeGreaterThanOrEqual(100);
      expect(new Set(o).size, `"${id}" chỉ ${new Set(o).size} màu — phẳng lì`)
        .toBeGreaterThanOrEqual(3);
    }
  });
});

describe('3. 🔴 KHÔNG TRÙNG id giữa 26 lá (nếu trùng: gradient ăn nhầm của nhau)', () => {
  it('mọi id trong defs đều có tiền tố theo mã thẻ', () => {
    const thay = new Map<string, string>();
    const loi: string[] = [];
    for (const [ma, svg] of Object.entries(ART)) {
      for (const m of svg.matchAll(/\sid="([^"]+)"/g)) {
        const id = m[1]!;
        const chu = thay.get(id);
        if (chu && chu !== ma) loi.push(`id "${id}" dùng ở cả "${chu}" lẫn "${ma}"`);
        thay.set(id, ma);
      }
    }
    expect(loi, loi.join('\n')).toEqual([]);
  });
});

/*
 * ⚠ ĐÃ XOÁ 27/07 — hai khối "4. Nhúng vào trang an toàn" và "5. KHOẢNH KHẮC LỚN".
 *
 * Cả hai kiểm `HOLDEM_HTML` — trang chơi thử server-render đã bị xoá cùng ngày
 * (founder: "xóa hết mấy cái link phụ hay bản test đi"). Giữ lại là giữ test cho
 * một trang không còn tồn tại.
 *
 * ⚠ ĐỘ PHỦ KHÔNG MẤT, NÓ ĐÃ Ở CHỖ KHÁC — nói rõ để không ai tưởng vừa bị hụt:
 *   · nhúng an toàn / escape SVG → nay là chuyện của React, không còn khâu tự
 *     chuỗi-hoá HTML nào để mà thoát sai.
 *   · khoảnh khắc lớn (công bố · nháy đỏ · tô màu sự kiện · thanh cược rực cháy)
 *     → `web/src/components/holdem/MomentOverlay.tsx` + `web/tests/cardfx.test.tsx`.
 *
 * Ba khối còn lại kiểm CHÍNH ART (đủ lá · SVG hợp lệ · không trùng id) nên sống
 * độc lập với việc art được nhúng ở đâu.
 */
/*
 * 4. HÌNH TRÊN Ô KHÔNG ĐƯỢC TRÙNG (D351).
 *
 * ⚠ Khối này sinh ra từ một lỗi THẬT của chính đợt D351: đổi hình ô "Sàn khoá rút tiền" sang 🔒
 * mà không ai để ý 'Tăng lãi suất' đã cầm đúng hình đó. Hai ô hiện cùng một biểu tượng trên bàn
 * là thứ người chơi thấy ngay và đọc sai ngay — mà **41 bài của tệp này vẫn xanh**, vì chúng canh
 * art SVG của 26 lá, không canh emoji trên ô.
 * ⇒ Chỗ trống có thật, không phải bài cho có: nó bắt đúng lớp lỗi vừa xảy ra một lần.
 */
describe('4. 🔴 HÌNH TRÊN Ô không trùng nhau (sự kiện + giai đoạn)', () => {
  it('mỗi ô một hình riêng — trùng hình là hai nghĩa dưới một biểu tượng', () => {
    const theo = new Map<string, string[]>();
    for (const x of [...SU_KIEN, ...GIAI_DOAN]) {
      theo.set(x.icon, [...(theo.get(x.icon) ?? []), x.id]);
    }
    const trung = [...theo].filter(([, ds]) => ds.length > 1)
      .map(([ic, ds]) => `${ic} dùng chung bởi ${ds.join(' + ')}`);
    expect(trung, trung.join('\n')).toEqual([]);
  });
});

/*
 * 5. LÁ MỚI = ĐÚNG TRANG ĐÃ DUYỆT (D393).
 *
 * Trang demo `docs/ui-ux/demo/la-bai-phong-cach.html` là nguồn chân lý (A11.25); `server/art/la_bai.ts`
 * là bản chép. Hai bản của cùng một tác phẩm SẼ trôi (D61) — lệch một ô là người chơi thấy một lá khác
 * lá founder đã duyệt, và không ai biết. Nên bài này so TỪNG Ô, cả lớp neon lẫn hướng/nhịp vệt sáng.
 */
describe('5. 🔴 Lá mới khớp từng ô với trang demo đã duyệt', () => {
  const html = readFileSync(new URL('../docs/ui-ux/demo/la-bai-phong-cach.html', import.meta.url), 'utf8');
  const LUOI_DEMO = JSON.parse(html.match(/const LUOI = (\{.*?\});\r?\n/)![1]!) as Record<string, string[]>;
  const theDemo = (id: string) => {
    const m = html.match(new RegExp(`\\{ id: '${id}',([^{}]*?)goc: (-?\\d+) \\}`));
    expect(m, `trang demo không có lá "${id}"`).toBeTruthy();
    const chu = (ten: string) => [...m![1]!.match(new RegExp(`${ten}: \\[(.*?)\\]`))![1]!
      .matchAll(/'([^']+)'/g)].map((x) => x[1]!);
    return { neon: chu('neon'), vet: chu('vet'), goc: Number(m![2]) };
  };
  const kimDemo = [...html.matchAll(/\[data-id="([a-z_]+)"\] \.cua svg \.vet\{animation-name:vetKim\}/g)]
    .map((m) => m[1]);

  for (const [khoa, la] of Object.entries(LA_BAI)) {
    it(`"${khoa}" = lá "${la.demo}" của trang demo`, () => {
      expect(la.luoi, 'lưới lệch trang demo').toEqual(LUOI_DEMO[la.demo]);
      const t = theDemo(la.demo);
      expect([...la.neon], 'nét neon lệch').toEqual(t.neon);
      expect(la.goc, 'góc vệt sáng lệch').toBe(t.goc);
      expect(la.vet, 'màu tâm vệt lệch').toBe(t.vet[0]);
      expect(la.nhip === 'kim', 'nhịp loé kim lệch').toBe(kimDemo.includes(la.demo));
    });
  }

  it('bài trên KHÔNG rỗng: đọc được cả 22 lá và cả hai lá nhịp kim của trang demo', () => {
    expect(Object.keys(LA_BAI)).toHaveLength(22);
    expect(Object.keys(LUOI_DEMO).length).toBeGreaterThanOrEqual(22);
    expect(kimDemo.sort()).toEqual(['ha_lai', 'tang_lai']);
  });

  it('mọi lá mới có lớp NEON không rỗng và vệt sáng đứng yên mặc định', () => {
    for (const khoa of Object.keys(LA_BAI)) {
      const svg = ART[khoa]!;
      expect(svg, `"${khoa}" mất lớp neon`).toMatch(/<g class="neon"><path /);
      const vet = svg.match(/<path class="vet"[^>]*>/g) ?? [];
      expect(vet.length, `"${khoa}" không có vệt sáng`).toBeGreaterThan(0);
      // Lá đứng yên (mọi chỗ ngoài ô đang lật) phải KHÔNG thấy vệt — khung ngoài mới bật nó.
      for (const v of vet) expect(v).toContain('opacity="0"');
    }
  });
});

/*
 * 6. MỘT LÁ THIÊN NGA ĐEN CHO MỌI TIN HOẢNG LOẠN (D390 — founder: *"chú ý logic phần hiển thị của
 * thẻ thiên nga đen"*). Suy từ `TINH_CHAT_NEN`, không gõ danh sách: tin hoảng loạn mới tự nhận lá.
 */
describe('6. 🔴 Thiên nga đen: bảy tin hoảng loạn, một hình', () => {
  const hoangLoan = SU_KIEN.filter((x) => TINH_CHAT_NEN[x.id] === 'hoang_loan').map((x) => `sk_${x.id}`);

  it('mọi tin `hoang_loan` hiện ĐÚNG hình thiên nga — không tin nào lọt về tranh riêng', () => {
    expect(hoangLoan.length).toBeGreaterThanOrEqual(7);
    for (const k of hoangLoan) expect(ART[k], `"${k}" không phải lá thiên nga`).toBe(ART[KHOA_THIEN_NGA]);
  });

  it('không tin nào KHÁC mượn hình thiên nga', () => {
    for (const x of SU_KIEN) {
      if (TINH_CHAT_NEN[x.id] === 'hoang_loan') continue;
      expect(ART[`sk_${x.id}`], `"${x.id}" không hoảng loạn mà mang hình thiên nga`).not.toBe(ART[KHOA_THIEN_NGA]);
    }
  });
});
