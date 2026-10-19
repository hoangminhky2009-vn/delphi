/**
 * D307 — HƯỚNG DẪN PHẢI PHỦ MỌI CƠ CHẾ ĐANG CHẠY.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO CÓ BÀI NÀY
 *
 * Hướng dẫn đã trôi một lần và trôi im lặng: D300 (07/09) tìm ra nó còn nói "ai cũng
 * 10.000 Vốn" và "khối TAY của shop" trong khi UI đã đổi từ lâu, còn VAI · KỲ NGỘ ·
 * CỠ BÀN thì chưa bao giờ có mục nào. Không ai thấy vì **một trang chữ sai không bao
 * giờ ném lỗi** — đúng lớp D61. Founder 08/09: *"làm lại phần hướng dẫn đi cho phù hợp
 * mọi cơ chế gameplay đang có hiện tại."*
 *
 * Nên bài này KHÔNG chép lại nội dung Hướng dẫn (chép là lại một bản sao sẽ trôi). Nó
 * bắt hai đầu gặp nhau:
 *   §I  mọi GIAI ĐOẠN và mọi SỰ KIỆN khai trong `config/holdem.ts` phải có mặt trong
 *       trang — thêm một mặt thẻ vào engine mà quên Hướng dẫn ⇒ ĐỎ;
 *   §II danh sách cơ chế lớn (khống · ký quỹ · sức căng · kỳ họp · kỳ ngộ · vai …) phải
 *       có mặt — đây là danh sách người, nhưng §I giữ cho nó không tụt lại một mình.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient } from '@/api/queries';
import { GIAI_DOAN, SU_KIEN, TAI_SAN } from '@config/holdem';
import { HuongDan } from '@/screens/holdem/HuongDan';

/** Bỏ dấu + hạ chữ thường: trang viết "hạ lãi suất", catalog ghi "Hạ lãi suất". */
const thuong = (x: string) => x.normalize('NFC').toLocaleLowerCase('vi-VN');

function chuCuaTrang(): string {
  const qc = makeQueryClient();
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><HuongDan /></MemoryRouter>
    </QueryClientProvider>,
  );
  return thuong(container.textContent ?? '');
}

/**
 * Bảng viết tắt — CỐ Ý RỖNG. Bản đầu của bài này cho phép Hướng dẫn gọi tắt ("lạm phát"
 * thay "Lạm phát nóng", "dịch bệnh" thay "Khủng hoảng sinh học") và chính nó lộ ra vì
 * sao không nên: người chơi đọc tên trên THẺ, nên trang tra cứu gọi tên khác thẻ là một
 * cú lệch nữa để trôi. Giữ bảng lại làm cửa cho ngoại lệ có lý do, nhưng mặc định là
 * KHÔNG có ngoại lệ nào.
 */
const VIET_TAT: Record<string, string> = {};

describe('I. ⭐⭐ Hướng dẫn phủ đủ mặt thẻ của engine', () => {
  const chu = chuCuaTrang();

  it('mọi GIAI ĐOẠN trong config có mặt trong trang', () => {
    const thieu = GIAI_DOAN
      .map((g) => VIET_TAT[thuong(g.label)] ?? thuong(g.label))
      .filter((t) => !chu.includes(t));
    expect(thieu, `pha chưa được nhắc: ${thieu.join(' · ')}`).toEqual([]);
  });

  it('mọi SỰ KIỆN trong config có mặt trong trang', () => {
    const thieu = SU_KIEN
      .map((e) => VIET_TAT[thuong(e.label)] ?? thuong(e.label))
      .filter((t) => !chu.includes(t));
    expect(thieu, `mặt tin chưa được nhắc: ${thieu.join(' · ')}`).toEqual([]);
  });

  it('⭐ mọi TÀI SẢN trong config có mặt trong trang — đổi tên lá mà quên trang là ĐỎ', () => {
    /*
     * D313 — thêm vế TÀI SẢN. D310 đổi tên bốn lá (BTC→Crypto, CP Công nghệ→CP Chứng
     * khoán, USD→USDT, Trái phiếu CP→Trái phiếu Mỹ) và §I lúc ấy chỉ quét pha + mặt tin,
     * nên trang vẫn có thể gọi tên cũ mà không ai báo — đúng lớp trôi bài này sinh ra để
     * chặn, chỉ khác trục.
     */
    const thieu = TAI_SAN.map((t) => thuong(t.label)).filter((t) => !chu.includes(t));
    expect(thieu, `lá chưa được nhắc tên: ${thieu.join(' · ')}`).toEqual([]);
  });

  it('⭐ hai CƠ CHẾ THEO LÁ phải được giải thích, không chỉ gọi tên', () => {
    /*
     * Suy TỪ CONFIG, không chép tay danh sách mã: lá nào trả coupon và lá nào bị cấm
     * khống thì trang phải nói ra. Đổi `dong_tien`/`khong_duoc` ở config mà quên trang
     * ⇒ ĐỎ, không cần ai nhớ.
     */
    for (const t of TAI_SAN.filter((x) => x.dong_tien === 'coupon')) {
      expect(chu, `lá ${t.label} trả coupon mà trang không nhắc "trả lãi"`)
        .toContain('trả lãi');
      expect(chu).toContain(thuong(t.label));
    }
    /*
     * D530 — khoá v60: bán khống chỉ còn trong MÀN (sổ khống ở shop không mở bằng lá nữa), và màn KHÔNG xét `khong_duoc` ⇒ trang thôi hứa
     * "CP Chứng khoán không khống được" (câu ấy sẽ là lời hứa không có mã đứng sau). Có chặn trong màn hay không: chờ founder.
     */
    // Lạm phát ăn tiền mặt — cơ chế không gắn lá nào, nên khoá bằng đầu dò riêng.
    expect(chu).toContain('tiền mặt');
    expect(chu).toContain('bốc hơi');
  });

  it('⚠ bài này bắt được cú thêm mặt thẻ mà quên Hướng dẫn', () => {
    // Tiêm ngay trong bài (A11.23): một mặt tưởng tượng PHẢI làm phép quét đỏ.
    const gia = [...SU_KIEN, { id: 'sieu_lam_phat', label: 'Siêu lạm phát Zimbabwe', icon: '?' }];
    const thieu = gia
      .map((e) => VIET_TAT[thuong(e.label)] ?? thuong(e.label))
      .filter((t) => !chu.includes(t));
    expect(thieu).toEqual(['siêu lạm phát zimbabwe']);
  });
});

describe('II. Hướng dẫn phủ đủ CƠ CHẾ lớn đang chạy', () => {
  const chu = chuCuaTrang();

  /**
   * Cơ chế → một cụm từ ĐỦ RIÊNG để chỉ mục đó.
   *
   * ⚠⚠ BẢN ĐẦU CỦA BẢNG NÀY LÀ MỘT BÀI CANH RỖNG, và chính mũi tiêm ngược đã lộ ra:
   * tôi dò "bán khống" bằng chữ `khống`, nhưng `khống` còn nằm ở mục VAI ("mở khống" /
   * "đóng khống"), nên **xoá HẲN cả mục BÁN KHỐNG mà bài vẫn xanh**. Cùng bệnh với
   * `ký quỹ` (mục ĐÒN BẨY nhắc lại), `trượt giá` (mục KHOÁ NẮM GIỮ nhắc lại), `bảng
   * điện tử` (mục BA CÁI BẪY nhắc lại), `quỹ vòng`, `kỳ ngộ`, `đòn bẩy`, `kỳ họp`…
   * Đúng lớp D262/D269/D272: bài xanh mà không canh gì.
   *
   * Nên mỗi đầu dò dưới đây phải là cụm CHỈ xuất hiện trong đúng mục của nó — đã kiểm
   * bằng cách xoá từng mục và xem bài có đỏ không.
   */
  /*
   * D524 — Hướng dẫn viết lại cho trận thật v57 (minigame theo lõi). Đầu dò đổi theo: bỏ cụm của cơ chế v57 đã gỡ khỏi trận thật (khớp giữa
   * vòng · cam kết · ngân hàng/bảng điện tử/tin bịa nay chỉ ở mục BÀN TẬP), thêm cụm của cơ chế v57 (vốn theo vai · vai bốc xác suất · năm lõi ·
   * màn lõi · đường giá trị · quá bán · vết thác · bầy · bàn nghiên cứu · lửa/xu/chợ trait). Mỗi cụm CHỈ có ở đúng mục của nó (đã xoá từng mục thử).
   * D527 — nhịp xen kẽ v58: trận thật 8 ô, bàn tập sang CÙNG luật (6 ô) ⇒ bỏ đầu dò của ba mục "chỉ còn ở bàn tập" (đám đông đổi ô · kỳ ngộ ·
   * ngân hàng/bảng điện tử/tin bịa — không trận mới nào còn chúng), thêm đầu dò nhịp xen kẽ + đổi lõi một lần.
   */
  const CO_CHE: [string, string][] = [
    ['xếp hạng theo % trên vốn đầu', 'so với vốn đầu của chính mình'],
    ['nhịp một vòng + chốt hộ', 'server chốt hộ'],
    ['vai bốc theo xác suất', 'vai bốc theo xác suất'],
    ['vốn theo vai', 'cá nhân ×1 · đội lái ×10'],
    ['vai cá mập', 'tay nặng'],
    ['vai tổ chức', 'không mua mã nào quá 40% nav'],
    ['vai đội lái', 'soi pháp lý'],
    ['hướng lệnh đối thủ', 'vừa vào vừa ra'],
    ['cỡ bàn', 'trận thật: 14 ô'],
    ['bàn tập cùng luật', 'bàn tập: 6 ô'],
    ['nhịp xen kẽ: một chặng sau mỗi lần chốt', 'một chặng'],
    ['chu kỳ 1 ô = nửa năm', 'nửa năm'],
    ['tin trên bản đồ đều thật', 'mọi tin trên bản đồ đều thật'],
    ['tính chất tin', 'huy hiệu'],
    ['lãi suất nền', 'tiền đắt'],
    ['sức căng', 'sức căng'],
    ['ô kỳ họp — lịch công khai', 'lịch công khai'],
    ['đặt lệnh theo mốc', 'mốc phần trăm vốn'],
    ['cọc chip', 'cọc chip'],
    ['trượt giá theo độ sâu sổ', 'sổ mỏng'],
    ['phí vội vàng', 'vội vàng'],
    // D530 — v60: Đòn Bẩy / Bán Khống chỉ trong màn; gọi ký quỹ tầng vòng không còn.
    ['bán khống', 'bán khống chỉ chơi trong'],
    ['đòn bẩy', 'lãi lỗ nhân đúng mức đã chọn'],
    ['bỏ / cắt lỗ', 'cắt lỗ'],
    ['đổi lõi một lần', 'đổi được một lần'],
    ['đứng ngoài', 'đứng ngoài'],
    ['đầu hàng', 'đầu hàng'],
    ['lá lõi', 'lõi chiến thuật'],
    ['năm lõi = năm màn', 'năm cách giao dịch'],
    ['lõi chỉ tác động trong màn (D530 — thay "gắn lõi vào mã")', 'vòng không có màn, lõi nghỉ'],
    ['quỹ vòng', 'ăn quỹ'],
    ['xếp hạng', 'cá voi'],
    ['khẩu vị rủi ro', 'thận trọng'],
    ['lửa đà', 'ngọn lửa đà'],
    ['xu', 'ví duy nhất'],
    ['chợ trait là chặng thay màn', 'chặng thay chỗ màn lõi'],
    ['màn lõi', 'không bấm = giữ suốt'],
    ['đường giá trị (Bắt Đáy)', 'giá trị gốc của kịch bản'],
    ['nhãn quá bán', 'quá bán'],
    ['thanh lý dây chuyền + vết', 'để lại vết'],
    ['bầy cá nhân', 'bầy cá nhân'],
    ['bàn nghiên cứu tổ chức', 'không ô nào quá 67%'],
    ['chip ảo không quy đổi', 'chip ảo'],
  ];

  it('không cơ chế nào vắng mặt', () => {
    const thieu = CO_CHE.filter(([, cum]) => !chu.includes(cum)).map(([ten]) => ten);
    expect(thieu, `cơ chế chưa có mục: ${thieu.join(' · ')}`).toEqual([]);
  });

  /*
   * D307 → D406: v54 mặc định — trận thật một cỡ (16), không kỳ ngộ, không chọn khẩu vị ⇒ KHÔNG còn gì phải mở khoá.
   * Bản D307 đòi câu "3 trận chơi xong" (khẩu vị mở sau 3 trận) — sau lật v54 câu ấy là hứa một nút không còn.
   */
  it('⭐ D550 — `CO_TRAN` của trang = cỡ ghim của khoá mặc định (trang không kéo `coBanGhim` vào bundle nên khoá bằng bài này)', async () => {
    const { CO_TRAN } = await import('../src/screens/holdem/HuongDan');
    const { coBanGhim } = await import('@config/luoc_bo');
    const { HOLDEM_BALANCE_VERSION, luatCua } = await import('@config/holdem');
    expect(CO_TRAN).toBe(coBanGhim(luatCua(HOLDEM_BALANCE_VERSION)));
  });
  it('⭐ D527 → D550 — trận thật v63: 14 ô, vốn theo vai, không còn gì phải mở khoá', () => {
    expect(chu).toContain('trận thật: 14 ô');
    expect(chu).toContain('13 vòng');
    expect(chu).toContain('chín màn lõi');
    expect(chu).toContain('năm chợ trait');
    expect(chu).toContain('họp ở ô 4 · 9');
    expect(chu).not.toContain('trận thật: 8 ô');
    expect(chu).not.toContain('trận thật: 12 ô');
    expect(chu).toContain('không còn gì phải mở khoá');
    expect(chu).toContain('vốn theo vai');
    expect(chu).not.toContain('trận thật: dài (16 ô)');
    expect(chu).not.toContain('mọi ghế cùng vốn');
    expect(chu).not.toMatch(/mở sau \d+ trận/);
    expect(chu).not.toContain('nhanh (8 ô)');
  });

  it('⭐ D527 — bàn tập cùng luật trận thật: không còn mục "chỉ còn ở bàn tập", không còn kỳ ngộ / đám đông đổi ô / tin bịa', () => {
    expect(chu).toContain('chợ chạy theo mùa');
    expect(chu).not.toContain('chỉ còn ở bàn tập');
    expect(chu).not.toContain('chỉ ở bàn tập');
    expect(chu).not.toContain('kỳ ngộ');
    // (khối BÁCH KHOA CƠ CHẾ ở đầu trang còn kể "đám đông bẻ ô" — component chung với nút SỔ trong trận, việc mở riêng.)
    expect(chu).not.toContain('đám đông đổi được ô');
    expect(chu).not.toContain('tin bịa');
    expect(chu).not.toContain('bàn tập 12 ô');
  });

  it('⭐ D524 — vế ngược: cơ chế v57 đã gỡ khỏi trận thật không còn được giới thiệu như của trận thật', () => {
    expect(chu).not.toContain('khớp giữa vòng');
    expect(chu).not.toContain('chốt lời trong ô');
    expect(chu).not.toContain('mù tin');
    expect(chu).not.toContain('có tin là tin bịa');
    expect(chu).not.toContain('gửi tiết kiệm trả cao hơn');
    expect(chu).not.toContain('đáy thác');
    expect(chu).not.toContain('bàn 4–7 ghế luôn có một tổ chức');
  });

  it('⭐ D527 — vế ngược: ngân hàng · bảng điện tử không còn được giới thiệu (không trận mới nào có)', () => {
    expect(chu).not.toContain('gửi tiết kiệm');
    expect(chu).not.toContain('bảng điện tử');
    expect(chu).not.toContain('ngân hàng có thể đổ vỡ');
  });

});
