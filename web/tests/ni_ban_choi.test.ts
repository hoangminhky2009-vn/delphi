/**
 * NỈ BÀN CHƠI — và cái bẫy đi kèm nó.
 *
 * Founder 31/08: *"Casino thì bạn xem chỗ nào giống cái bàn chơi / chỗ để bài
 * thì cho vào."* Ba mặt nhận nỉ: dải ô thị trường (`.map`) · quầy bài shop
 * (`.luoiThe`) · thanh bài trên tay (`.tay`).
 *
 * ⚠⚠ BÀI NÀY TỒN TẠI VÌ MỘT LỖI ĐÃ XẢY RA THẬT, HAI LẦN, TRONG CÙNG MỘT GIỜ:
 * một mặt bàn CÓ MÀU không phải "thêm một dòng nền" — nó ăn xuyên qua MỌI thứ
 * trong suốt nằm trên nó.
 *   · ô "ĐÃ QUA" chạy `opacity: .62` ⇒ lá cũ thôi XÁM, hoá ÁM LỤC, và
 *     `grayscale(1)` ngay bên cạnh thành vô nghĩa;
 *   · lá shop chạy `opacity: .4` VÀ có nền gradient nửa trong suốt ⇒ sáu lá tài
 *     sản xanh rêu, trong khi hai lá chiến thuật ngay dưới (không trên nỉ) vẫn
 *     đúng màu.
 * Cả hai hỏng IM LẶNG: không lỗi, không test đỏ, chỉ có màu nói sai. Chỉ lộ khi
 * nhìn bằng mắt trên stack thật.
 *
 * ⇒ LUẬT: mặt nào có nỉ thì con của nó phải có LỚP LÓT ĐỤC.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '');
/** Lấy thân của rule đầu tiên khớp `sel` (sau khi đã bóc chú thích). */
function than(css: string, sel: string): string {
  const s = ma(css);
  const i = s.indexOf(sel);
  if (i < 0) return '';
  return s.slice(i, s.indexOf('}', i));
}

const MAT = [
  { ten: 'dải ô thị trường', f: 'src/components/holdem/MarketMap.module.css', sel: '.map {', lot: '.khung {' },
  { ten: 'quầy bài shop', f: 'src/components/holdem/ShopManHinh.module.css', sel: '.luoiThe {', lot: '.luoiThe > * {' },
];

describe('I. Chất liệu từng mặt đi qua token (D442: nỉ màu còn ở quầy shop; bàn thẻ theo xu hướng; thao tác trung tính)', () => {
  /*
   * D442 (founder 27/09 tối) — ba mặt thôi chung một tấm nỉ xanh: *"Phần hiển thị tăng giảm các mã tài sản hay chỗ chốt
   * vòng/thao tác của người chơi sẽ đổi thành màu sắc trung tính … màu xanh hiện tại hơi lạc quẻ"*, và nền bàn thẻ đổi
   * theo xu hướng (`MarketMap .mapNen`, bài `moi_truong_ban`). Luật gốc của mục này giữ nguyên: màu mặt bàn đi qua TOKEN,
   * không mặt nào gõ hex riêng (ba bản màu là ba thứ sẽ trôi — D61).
   * ⚠ Bản trước kiểm `toContain('--felt')` — chuỗi ấy khớp cả tên VÂN DỆT `--felt-det-*`, nên sau D442 bài vẫn xanh
   * trong khi điều nó khẳng định ("chung một chất liệu") đã sai. Nay kiểm đúng token MÀU.
   */
  it('⭐ quầy bài shop vẫn là nỉ (token màu nỉ), không hex riêng', () => {
    const t = than(doc('src/components/holdem/ShopManHinh.module.css'), '.luoiThe {');
    expect(t, 'quầy bài không dùng token nỉ').toMatch(/var\(--felt(-sang)?\)/);
  });

  it('⭐ dải ô: chỉ còn VÂN DỆT trên mặt — màu nền là nền môi trường theo xu hướng, không phải nỉ xanh', () => {
    const t = than(doc('src/components/holdem/MarketMap.module.css'), '.map {');
    expect(t).toMatch(/background:\s*var\(--felt-det-ban\);/);
    expect(t, 'nỉ xanh quay lại dải ô').not.toContain('--felt-mat');
  });

  it('⭐ dải sáu mã + thanh thao tác: mặt TRUNG TÍNH, không nỉ xanh', () => {
    for (const [f, sel] of [
      ['src/components/holdem/DaiThiTruong.module.css', '.dai {'],
      ['src/components/holdem/TayBai.module.css', '.tay {'],
    ] as const) {
      const t = than(doc(f), sel);
      expect(t, `${sel} phải dùng mặt trung tính`).toContain('var(--mat-trung-mat)');
      expect(t, `${sel} còn nỉ xanh`).not.toContain('--felt-mat');
    }
  });

  it('token nỉ + token trung tính có khai thật trong tokens.css', () => {
    const t = doc('src/styles/tokens.css');
    for (const v of ['--felt:', '--felt-sang:', '--felt-vien:', '--mat-trung:', '--mat-trung-sang:', '--mat-trung-mat:']) {
      expect(t, `thiếu ${v}`).toContain(v);
    }
  });
});

describe('II. ⭐⭐ Mặt có nỉ thì con phải có LỚP LÓT ĐỤC', () => {
  for (const m of MAT) {
    it(`${m.ten}: \`${m.lot}\` phải đặt nền đục`, () => {
      /*
       * "Đục" ở đây = một `background` KHÔNG có alpha và KHÔNG phải nỉ. Dùng
       * `--bg-page` (nền trang) nên lá lại pha với nền tối như trước khi có nỉ;
       * nỉ chỉ còn thấy ở khe và viền bàn — đúng cách một lá bài thật che mặt
       * bàn thật.
       */
      const t = than(doc(m.f), m.lot);
      expect(t, `${m.lot} biến mất — nỉ sẽ ăn xuyên qua lá`).not.toBe('');
      expect(t, `${m.lot} thiếu nền đục`).toMatch(/background:\s*var\(--bg-page\)/);
      expect(t, 'lớp lót mà lại là nỉ thì không lót gì cả').not.toContain('--felt');
    });
  }
});

describe('III. Nỉ KHÔNG được lan sang chỗ có số tiền', () => {
  it('⭐⭐ chỉ đúng ba mặt bàn dùng `--felt` — không mặt thứ tư', () => {
    /*
     * Phép đo WCAG (31/08) trên đúng những màu chữ đang chạy: Casino Green
     * #0d5e30 của canon làm `--lose` tụt còn **2,85** — trượt cả AA lẫn ngưỡng
     * chữ lớn, tức nền nuốt đúng kênh báo MẤT TIỀN. Nỉ đã hạ xuống #072b17 để
     * qua ngưỡng, nhưng lý lẽ giữ nguyên: nó đứng dưới LÁ BÀI, không đứng dưới
     * SỐ TIỀN. Bài này đỏ khi ai đó "cho casino thêm chỗ nữa".
     */
    const CHO_PHEP = new Set([
      'MarketMap.module.css', 'ShopManHinh.module.css', 'TayBai.module.css', 'tokens.css',
      /*
       * 13/09 tối — MẶT THỨ TƯ, và nó vào danh sách này SAU khi đo, không phải trước.
       * Dải sáu mã nằm ngay dưới bản đồ và kể tiếp đúng câu chuyện của ô vừa lật, nên để nó
       * trên một mặt khác là chia một câu làm đôi (founder gạch kiểu chia màn ấy). Đo trên
       * đúng những màu chữ đang chạy ở đó: `--text-muted` #93aac8 = 5,2:1 ở đỉnh nỉ và
       * 5,6:1 ở đáy; `--text-body`, `--win`, `--lose` đều cao hơn. Không có SỐ TIỀN nào
       * nằm trên mặt này — chỉ tên mã và cọc chip, đúng ranh mà mục III đang giữ.
       */
      'DaiThiTruong.module.css',

      /*
       * 04/10 (D476) — MẶT THỨ NĂM: màn minigame chép demo đã chốt (A11.25 — demo đặt cả màn chọn lá, màn chơi và KẾT QUẢ lên nỉ).
       * Màn này CÓ số tiền (lãi lỗ màn, NAV trước → sau) nên đã ĐO trên đúng màu chạy, đỉnh nỉ (42 % --felt-sang) / đáy:
       * `--lose` 5,06 / 5,55 · `--text-muted` 5,88 / 6,46 · `--win` 8,04 / 8,82 · `--gold` 10,6 / 11,7 — tất cả ≥ 4,5 (AA).
       * Dòng quyết toán còn nằm trên tấm tối riêng (`.qt`).
       */
      'ManMinigame.module.css',
      /*
       * 26/09 (D422) — MẶT THỨ NĂM: mặt nỉ của CHỢ TRAIT, đúng trang demo founder đã chốt (`the-trait.html`, *"t chốt hết
       * hiệu ứng/ hình ảnh và màu của bản demo"*). Token nỉ nằm trong khối màu `.bm` của `TheTrait.module.css`. Đo trên
       * đúng những màu chữ đứng THẲNG trên nỉ (#072b17, đỉnh có ánh +5 % trắng = #133623): tiêu đề `--text-body` 13,6:1
       * (11,7:1 ở đỉnh) · nhãn TÀI / CÂN 0 `--win` 8,8:1 (7,6:1) · nhãn TẬT / LỆCH `--lose` 5,6:1. Số XU nằm trên ô ví lót
       * 35 % đen (13,5:1); thẻ có nền đục riêng. Không có SỐ TIỀN (NAV, tiền mặt) nào trên mặt này.
       */
      'TheTrait.module.css',
      /*
       * 11/10 — MẶT THỨ SÁU: banner Alpha Draft của HUB tầng không gian, đúng demo đã CHỐT (`hub-tang-khong-gian.html`, A11.25 —
       * banner là mặt nỉ có tay bài). ĐO trước khi vào danh sách: chữ KHÔNG đứng thẳng trên nỉ mà trên tấm tối `.chu` (alpha
       * 0,57 tại dòng nhãn đầu → 0,78 → 0,92), nên đo ca xấu nhất (nỉ sáng #0a3d21, alpha 0,57): nhãn `--gold-amber` 10,3:1 ·
       * "BẠN CÓ BIẾT?" `--accent-bright` 11,9:1 · câu bách khoa `--text-title` 15,8:1 — mọi mức ≥ 4,5 (AA), có dư. Không có SỐ
       * TIỀN nào trên mặt này (chỉ tay bài + câu chữ); số token nằm ở đầu sảnh, ngoài banner.
       */
      'HubBanner.module.css',
      /*
       * 11/10 — MẶT THỨ BẢY: GIẾNG BÀN ở ô chính của SẢNH Alpha Draft bento (demo CHỐT `alpha-draft-tang-khong-gian.html`, A11.25 — giếng là mặt nỉ
       * có hàng lá úp). ĐO trước khi vào danh sách, trên đúng màu chữ đứng THẲNG trên nỉ ở trạng thái "hôm nay xong" (đỉnh nỉ = 42 % `--felt-sang`
       * pha `--felt`, ca xấu nhất; đáy = `--felt`): số TO phân vị `--gold` 9,7:1 (đáy 11,7:1) · dòng phụ `--text-muted` 5,4:1 (đáy 6,5:1) —
       * mọi mức ≥ 4,5 (AA). Chữ nhãn và chip nằm NGOÀI giếng, trên nền thẻ. KHÔNG có SỐ TIỀN (NAV, tiền mặt) trên mặt này — chỉ phân vị của cả
       * sân và các lá úp; số token ở đầu Hub, không ở sảnh.
       */
      'AlphaDraftLobby.module.css',
    ]);
    const pham: string[] = [];
    const quet = (d: string) => {
      for (const e of readdirSync(join(process.cwd(), d))) {
        const p = join(d, e);
        if (statSync(join(process.cwd(), p)).isDirectory()) quet(p);
        else if (e.endsWith('.css') && !CHO_PHEP.has(e)
          && ma(readFileSync(join(process.cwd(), p), 'utf8')).includes('--felt')) pham.push(p);
      }
    };
    quet('src');
    expect(pham, `nỉ lan sang: ${pham.join(', ')} — mỗi mặt mới phải đo lại WCAG trước`).toEqual([]);
  });
});
