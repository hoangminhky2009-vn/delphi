/**
 * NGUYÊN THUỶ LƯỚI PIXEL — bảng màu + thuật toán vẽ, DÙNG CHUNG cho mọi tầng art.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VÌ SAO FILE NÀY TỒN TẠI (và vì sao nó nằm ở `config/` chứ không ở `server/`).
 *
 * Trước đợt avatar, `BANG_MAU` + `veDai()` sống trong `server/holdem_art_pixel.ts`,
 * và điều đó đúng khi chỉ có MỘT tầng art (thẻ 80×60) render ở MỘT phía (server).
 * Avatar phá cả hai giả định: nó là lưới 32×32 và nó phải vẽ ở CẢ HAI phía —
 * React (`web/src`) lẫn trang server-render.
 *
 * Nếu để mỗi bên một bản thì hai bên TRÔI LỆCH — và đó không phải giả thuyết:
 * avatar bot đã từng tồn tại hai bản (`BotAvatar.tsx` và `holdem_ui.ts`) và hai
 * bản đó đã khác nhau. Nên bảng màu và thuật toán vẽ chuyển về đây, `config/` là
 * thư mục DUY NHẤT cả `web/` (alias `@config`) lẫn `server/` cùng đọc được.
 *
 * ⚠ KHÔNG thêm ký tự màu mới vào `BANG_MAU` cho riêng một tầng art. Hai bảng màu
 * trong cùng một tấm ảnh là "hệ art thứ ba" — thứ §XI/R5 cấm — và biểu hiện của
 * nó là phụ kiện có viền không bao giờ ăn với đổ bóng của mặt bên dưới.
 */

/**
 * BẢNG MÀU HI-BIT — mỗi họ có 4 sắc độ để ĐỔ BÓNG được.
 *
 * ⚠ NÂNG TỪ BẢNG 16 MÀU (26/07, founder: "nâng cấp đồ hoạ pixel đẹp và chi tiết
 * hơn — Hi-bit, modern HD"). Bảng cũ chỉ có 2–3 sắc mỗi họ, nên hình chỉ tô được
 * mảng phẳng — đúng cảm giác 8-bit retro mà §XI nói RÕ là KHÔNG muốn.
 *
 * Quy ước chữ: HOA = sáng nhất (bắt sáng), thường = màu gốc, thường+số/ký tự khác
 * = tối dần. Có 4 nấc thì vẽ được khối tròn, mặt vát, và viền sáng — ba thứ tách
 * "modern pixel" khỏi "pixel retro".
 */
export const BANG_MAU: Record<string, string> = {
  // ── cyan (Terminal Neon chủ đạo)
  C: '#cffafe', D: '#67e8f9', E: '#22d3ee', e: '#0e7490',
  // ── violet
  V: '#ddd6fe', v: '#a78bfa', u: '#8b5cf6', w: '#4c1d95',
  // ── trung tính / kim loại
  W: '#ffffff', S: '#e2e8f0', s: '#94a3b8', x: '#475569', z: '#1e293b',
  // ── đỏ (rủi ro, sụt giá)
  R: '#fca5a5', q: '#ef4444', Q: '#b91c1c', r: '#7f1d1d',
  /* ── vàng/cam (tiền, lửa) — 5 nấc từ D185.
   * `J` #fde047 là nấc bị THIẾU, và cái thiếu đó đo được: bảng nhảy thẳng từ
   * #fef08a (vàng nhạt) sang #fbbf24 (hổ phách), bỏ qua đúng sắc VÀNG CHANH mà
   * `tokens.css` khai là `--gold`. Hệ quả lúc gộp bảng icon: mép vàng của hai bậc
   * apex (`rank.test.tsx` "luật nhiệt màu") bị đẩy sang hổ phách và bài test đỏ.
   * ⚠ Bài đó ĐỎ ĐÚNG — nó canh một bất biến thật. Vá bằng cách bù sắc độ còn
   * thiếu, KHÔNG phải bằng cách sửa hex trong test cho vừa (D79).
   */
  Y: '#fef08a', J: '#fde047', y: '#fbbf24', O: '#fb923c', o: '#c2410c',
  // ── lục (tăng trưởng)
  N: '#bbf7d0', G: '#4ade80', n: '#16a34a', g: '#14532d',
  // ── nền
  K: '#1e1b3a', k: '#0a0618',

  /* ═══ BA HỌ BỔ SUNG (D185, founder: "thêm full sắc độ vào bảng màu") ═══
   *
   * ⚠ Đây KHÔNG phải cú "thêm ký tự cho riêng một tầng art" mà đầu file cấm —
   * ngược lại: nó thêm HỌ ĐẦY ĐỦ 4 SẮC ĐỘ, đúng quy ước bảng, dùng chung mọi tầng.
   * Cấm là cấm thêm lẻ một màu để chữa một tấm ảnh; đây là bù chỗ khuyết của hệ.
   *
   * VÌ SAO BA HỌ NÀY, đo được chứ không phải cho đủ bộ:
   *  · LAM  — bảng cũ KHÔNG có một sắc xanh dương nào. Đo lúc gộp bảng icon về
   *    đây (`npm run pixel:hibit`): `N` navy #312e81 và `A` xanh #1d4ed8 của
   *    PixelIcon đều bị đẩy sang họ TÍM (ΔE 22,5 và 21,0) — tức lưng cá ngừ và
   *    vây cá voi của bộ icon rank sẽ hoá tím. Thiếu họ, không thiếu sắc độ.
   *  · HỒNG — "Hot Pink" là một trong bốn Dopamine Colors của quy chuẩn VFX
   *    (`docs/ui-ux/01-vfx-game-feel.md` §1 nhóm 5) và không tồn tại ở bất kỳ
   *    bảng màu nào của repo.
   *  · NÂU  — `B` #78350f trước nay đứng MỘT MÌNH trong họ vàng/cam, nên gỗ/da/
   *    chuôi kiếm chỉ tô được mảng phẳng. `B` giữ NGUYÊN giá trị cũ (art hiện có
   *    không đổi một pixel nào), chỉ mọc thêm ba sắc quanh nó.
   */
  // ── lam (xanh dương — biển, kim loại lạnh, bộ icon rank)
  A: '#bfdbfe', L: '#60a5fa', l: '#2563eb', a: '#1e3a8a',
  // ── hồng (Dopamine Color của quy chuẩn VFX)
  H: '#fbcfe8', P: '#f472b6', p: '#db2777', h: '#831843',
  // ── nâu (gỗ, da, chuôi kiếm) — B là màu CŨ, giữ nguyên để art cũ không đổi
  T: '#c8a27a', b: '#92400e', B: '#78350f', t: '#451a03',
};

/**
 * Ô nào toả quầng neon — CHỈ nấc sáng nhất mỗi họ, glow tất cả là mất tương phản.
 *
 * Export vì `scripts/lint_pixel_art.ts` đo TIẾT CHẾ PHÁT SÁNG và phải đọc đúng
 * tập này, không được chép tay: chép tay thì thêm một ký tự phát sáng ở đây mà
 * quên sửa lint là ngưỡng đo sai một cách im lặng.
 */
/*
 * D185 — thêm `A` (lam) và `H` (hồng) khi bổ sung ba họ mới.
 * ⚠ Cố ý KHÔNG thêm `T` (nâu): nâu là VẬT LIỆU (gỗ, da, chuôi kiếm), không phải
 * nguồn sáng. Cho gỗ toả quầng neon là đúng thứ luật này sinh ra để chặn.
 */
export const O_PHAT_SANG: ReadonlySet<string> = new Set(['W', 'C', 'Y', 'V', 'N', 'R', 'A', 'H']);

export interface Cell { x: number; y: number; ch: string }

/** Lưới ký tự → danh sách ô có màu. `.` và ký tự lạ bị bỏ (trong suốt). */
export function docLuoi(luoi: readonly string[]): Cell[] {
  const out: Cell[] = [];
  luoi.forEach((hang, y) => {
    for (let x = 0; x < hang.length; x += 1) {
      const ch = hang[x]!;
      if (ch !== '.' && BANG_MAU[ch]) out.push({ x, y, ch });
    }
  });
  return out;
}

/**
 * Gộp ô thành ĐƯỜNG DẪN, MỘT `<path>` cho mỗi màu.
 *
 * ⚠ ĐÂY LÀ CHỖ QUYẾT ĐỊNH KÍCH THƯỚC TRANG, không phải chi tiết cài đặt.
 * Bản đầu của art thẻ emit một `<rect>` cho mỗi dải ô: trang bàn chơi phồng lên
 * **898KB** và test "trang vẫn ở kích thước phục vụ được" (ngưỡng 700KB cho 3G)
 * vỡ ngay. Một `<rect x= y= width= height= fill=>` tốn ~60 ký tự; cùng thông tin
 * viết thành subpath `M x,y h w v h z` tốn ~18, và gom mọi dải cùng màu vào MỘT
 * phần tử thì thuộc tính `fill` chỉ viết một lần cho cả trăm dải.
 *
 * Với avatar lý do còn gắt hơn: lối `box-shadow`-mỗi-ô của `PixelIcon` sinh MỘT
 * entry cho mỗi ô có màu, mà avatar phủ kín khung ⇒ 1.024 entry/lá ⇒ bàn 8 ghế là
 * 8.192 entry trên đúng màn động nhất của app. Gộp dải cho ≤30 `<path>` mỗi lá.
 *
 * `px` là THAM SỐ chứ không phải hằng số module: thẻ chạy 2,5px/ô (80×60 → 200×150),
 * avatar chạy 1px/ô (32×32 → viewBox 32×32 rồi để CSS phóng theo bội số nguyên).
 */
export function veDai(cells: readonly Cell[], px: number): string {
  /*
   * HAI LẦN GỘP: dải ngang trong hàng, RỒI gộp dọc các dải trùng (x, rộng).
   *
   * ⚠ Lần gộp dọc thêm 27/07 vì luật ĐỘ PHỦ ≥60% làm mọi lá phủ kín 4.800 ô. Chỉ
   * gộp ngang thì một mảng nền phẳng 40×30 ô ra 30 dải rời — nhân 29 lá thì trang
   * phồng 598 KB → 829 KB và vượt ngưỡng 700 KB, tức CHẶN BUILD.
   *
   * Lossless tuyệt đối: cùng tập ô vào → cùng pixel ra, chỉ khác cách viết `d`.
   */
  /** màu → dải ngang [x, y, rộng] theo ĐƠN VỊ Ô (đổi sang px ở bước cuối). */
  const theoMau = new Map<string, [number, number, number][]>();
  const theoHang = new Map<string, Cell[]>();
  for (const c of cells) {
    const k = `${c.y}|${c.ch}`;
    const a = theoHang.get(k); if (a) a.push(c); else theoHang.set(k, [c]);
  }
  for (const [k, list] of theoHang) {
    const ch = k.split('|')[1]!;
    list.sort((a, b) => a.x - b.x);
    const dai = theoMau.get(ch) ?? [];
    let i = 0;
    while (i < list.length) {
      let j = i;
      while (j + 1 < list.length && list[j + 1]!.x === list[j]!.x + 1) j += 1;
      dai.push([list[i]!.x, list[i]!.y, list[j]!.x - list[i]!.x + 1]);
      i = j + 1;
    }
    theoMau.set(ch, dai);
  }

  const parts: string[] = [];
  for (const [ch, dai] of theoMau) {
    // Sắp theo (x, rộng, y) để dải chồng nhau nằm liền kề → gộp một lượt tuyến tính.
    dai.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    const o: string[] = [];
    let i = 0;
    while (i < dai.length) {
      const [x, y, w] = dai[i]!;
      let j = i;
      // Cùng cột, cùng bề rộng, hàng liền nhau → một khối cao hơn.
      while (j + 1 < dai.length
        && dai[j + 1]![0] === x && dai[j + 1]![2] === w
        && dai[j + 1]![1] === dai[j]![1] + 1) j += 1;
      const cao = dai[j]![1] - y + 1;
      /*
       * ⚠ CẠNH THỨ BA LÀ BẮT BUỘC — `h-${w}` không phải thứ tối ưu bỏ đi được.
       *
       * Bản trước ở `server/holdem_art_pixel.ts` viết `M x,y h w v cao z` kèm chú
       * thích "z tự đóng về điểm đầu nên KHÔNG cần h-{w} ở cuối — bớt ~5 ký tự".
       * Chú thích đó SAI, và cái sai không nằm ở kích thước file mà ở HÌNH:
       *
       *     M(x,y) → h w → v cao → z   vẽ ra (x,y) → (x+w,y) → (x+w,y+cao) → về (x,y)
       *     = BA đỉnh = MỘT TAM GIÁC VUÔNG, không phải hình chữ nhật.
       *
       * Nghĩa là MỌI khối pixel của app — 29 art thẻ lẫn avatar — được vẽ thành
       * tam giác và cả bộ art bị XÉN CHÉO. Đây gần như chắc chắn là thứ đứng sau
       * ba lần founder kêu "art xấu": hai lần trước chẩn thành độ phân giải
       * (40×30 → 80×60) rồi thành bố cục, nên nâng gì cũng vẫn xấu — vì lỗi nằm
       * ở phép vẽ chứ không ở nét vẽ.
       *
       * Giá của cạnh thứ ba: ~5 ký tự/khối. Đó là cái giá đúng đắn duy nhất —
       * "gọn" mà ra sai hình thì không phải tối ưu, là hỏng.
       */
      o.push(`M${x * px},${y * px}h${w * px}v${cao * px}h${-w * px}z`);
      i = j + 1;
    }
    parts.push(`<path fill="${BANG_MAU[ch]}" d="${o.join('')}"/>`);
  }
  return parts.join('');
}
