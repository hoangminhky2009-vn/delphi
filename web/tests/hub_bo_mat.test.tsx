/**
 * HUB — "BỘ MẶT CỦA APP" (founder 30/08: *"cải tiến phần hub đi, nó cũng là bộ mặt của app khi user đăng nhập xong và vào app"*).
 *
 * ⚠ 11/10 — TỆP NÀY ĐƯỢC VIẾT LẠI THEO SPEC `docs/spec/ui-tang-khong-gian.md` (Hub bento). Hai luật cũ bị SPEC (10/10, mục 6) THAY có chủ
 * ý, KHÔNG phải nới cho xanh:
 *   · "Hub là CỬA, không con số" (§XIX)  ⇒  "Hub CÓ SỐ, 0 REQUEST MỚI": nguồn của số = `/auth/me` · `KEY_LO_TRINH` · sổ trên máy;
 *     vẫn cấm một số in ở hai nơi (nên Hub tắt header chung, ví nằm ở đầu sảnh — xem `hub_bento.test.tsx`).
 *   · "Hub chỉ được gọi ĐÚNG MỘT query"  ⇒  được gọi `useMe` + `useLoTrinh` (cùng khoá cache với BottomNav, không đẻ request mới).
 * Thứ tệp này còn canh là ba thứ DỄ MẤT NHẤT của màn: một khuôn mặt mỗi lần · ngân sách request · ô bấm được phải có chiều sâu.
 * Bài đủ-chức-năng (SPEC §5 a–d, 5b) ở `hub_bento.test.tsx`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const TSX = doc('src/screens/Hub.tsx');
const CSS_O = doc('src/components/ui/OBento.module.css');
/** Bóc chú thích trước khi quét — chú thích ở file này trích nguyên văn luật,
 *  nên quét thô sẽ khớp nhầm chính lời cảnh báo (bẫy đã trả giá ở pixelui). */
const ma = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('I. Một khuôn mặt mỗi lần', () => {
  it('⭐ có tài khoản thật ⇒ mặt của NGƯỜI CHƠI (Avatar); khách/chưa đăng nhập ⇒ icon trò — hai nhánh LOẠI TRỪ nhau', () => {
    const m = ma(TSX);
    expect(m, 'thiếu cờ phân nhánh danh tính').toContain('coTaiKhoan');
    // Khách KHÔNG được tính là có danh tính — họ chưa có tài khoản để mà nhận.
    expect(m).toMatch(/khach\s*=\s*user\?\.la_khach\s*===\s*true/);
    expect(m).toMatch(/coTaiKhoan\s*=\s*user\s*!==\s*null\s*&&\s*!khach/);
    // Hai khuôn mặt cùng lúc là hai chủ ngữ tranh nhau — avatar chỉ ở nhánh `coTaiKhoan`.
    expect(m, 'avatar phải nằm sau điều kiện coTaiKhoan').toMatch(/coTaiKhoan\s*\?[\s\S]{0,120}?<Avatar/);
  });

  it('⭐⭐ token của người chơi in ở ĐÚNG MỘT chỗ trong mã Hub (ví ở đầu sảnh) — không lặp ở thân', () => {
    const m = ma(TSX);
    // §XIX vẫn đứng: một số không in ở hai nơi. `bankroll` chỉ được đọc để vẽ ví đầu sảnh.
    expect((m.match(/\bbankroll\b/g) ?? []).length, '`bankroll` đọc ở nhiều chỗ — ví in hai nơi').toBe(1);
    expect((m.match(/formatT\(/g) ?? []).length).toBe(1);
    // Điểm Q (quest_points) không thuộc mặt Hub — nó ở trang Hành trình.
    expect(m).not.toContain('quest_points');
  });
});

describe('II. Ngân sách request — thứ dễ phá nhất ở màn này', () => {
  it('⭐⭐ Hub chỉ được gọi hook dữ liệu `useMe` · `useLoTrinh` · `useDiemDanh`', () => {
    /*
     * Hub mở ở MỌI lần vào app. Thêm một query ở đây là +1 request mỗi lần mở — ở mốc 5.000 user (C2) với 3 lần mở/ngày là ~450k/tháng,
     * gần NỬA hạn mức 1 triệu của cả hệ. D146/K11 đã chốt "một cú mở app, một cửa". SPEC 10/10 cho Hub CÓ SỐ nhưng chỉ từ nguồn ĐÃ có:
     * `/me` (đã gọi), `KEY_LO_TRINH` (BottomNav đã gọi — react-query gộp cùng khoá thành MỘT request), sổ trên máy (không mạng).
     * `useDiemDanh` là MUTATION (bấm mới gọi), không phải truy vấn lúc mở.
     *
     * ⚠ Bài này đỏ khi ai đó thêm `useProgress`/`useRank`/`useMyStats` vào Hub cho "phong phú hơn". Đỏ là ĐÚNG: thứ cần thêm phải đi
     * ghép vào payload `/me` sẵn có, không phải mở thêm một cửa.
     */
    const goi = [...ma(TSX).matchAll(/\buse[A-Z]\w*\(/g)].map((x) => x[0].slice(0, -1));
    const truyVan = goi.filter((g) => !['useState', 'useNavigate', 'useEffect', 'useMemo', 'useRef', 'useCallback', 'useLocation', 'useLunVung'].includes(g));
    expect([...new Set(truyVan)].sort(), `Hub đang gọi: ${truyVan.join(', ')}`).toEqual(['useDiemDanh', 'useLoTrinh', 'useMe']);
  });

  it('⭐ Hub KHÔNG nhập thẳng tầng PFM / bách khoa vào gói chính — chúng nạp trễ (chunk riêng)', () => {
    const m = ma(TSX);
    for (const cam of ["from '@/pfm/", "from '@/lib/bach_khoa'", "from '@server/art", "components/pfm/BanTien"]) {
      expect(m, `Hub nhập tĩnh \`${cam}\` — kéo cả tầng nặng vào gói MỌI người chơi tải`).not.toContain(cam);
    }
    expect(m).toContain("import('./hub/HubBanner')");
    expect(m).toContain("import('./hub/HubTaiChinh')");
  });
});

describe('III. Ô cửa phải BẤM ĐƯỢC — không đứng im vô cảm', () => {
  it('ô có chiều sâu 2.5D bằng bóng cứng, gọi BIẾN chứ không composes lớp bóng', () => {
    const i = CSS_O.indexOf('.o {');
    const the = CSS_O.slice(i, CSS_O.indexOf('}', i));
    expect(the, 'ô vẫn phẳng — không có bóng').toContain('--px-bong');
    // §XI luật 6: `box-shadow` không cộng dồn ⇒ composes rồi khai lại là mất trắng.
    expect(the, 'phải gọi biến, không composes lớp bóng').not.toMatch(/composes:[^;]*bong/);
  });

  it('⭐⭐ cú LÚN phải nhân đôi lớp (`.o.lun`) — nếu không nó thua `.hubNay` và câm im lặng', () => {
    /*
     * Cùng lý do của `.card.card:active` ngày xưa (D122 `.laVao.laVao`): lớp thường (0,1,0) hoà độ ưu tiên với lớp `composes` kéo
     * `transition` vào, nên thứ tự bundle quyết — và hỏng IM LẶNG. `.o.lun` (0,2,0) thắng bất kể thứ tự.
     */
    expect(CSS_O, 'thiếu quy tắc lún').toMatch(/\.o\.lun\s*\{/);
    const i = CSS_O.indexOf('.o.lun {');
    const luat = CSS_O.slice(i, CSS_O.indexOf('}', i));
    expect(luat, 'lún phải dịch đúng bằng độ dày bóng').toContain('--px-do-day');
  });

  it('nút chính cũng lún nhân đôi lớp (`.vao.vaoLun`) và khai lại box-shadow GHÉP chân nút', () => {
    expect(CSS_O).toMatch(/\.vao\.vaoLun\s*\{/);
    const i = CSS_O.indexOf('.vao {');
    const luat = CSS_O.slice(i, CSS_O.indexOf('}', i));
    // Khai lại mà quên bóng dày là nút mất chiều sâu đúng lúc nó cần nổi nhất.
    expect(luat).toContain('--px-bong');
  });
});
