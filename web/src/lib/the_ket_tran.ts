/**
 * THẺ KẾT TRẬN — vẽ một tấm ảnh RỜI APP ĐƯỢC (`man-ket-de-khoe.md`, thi công
 * 17/08). Founder: *"màn kết chưa có gì để khoe, học từ những màn kết đã viral"*.
 *
 * Bảy luật rút từ Wordle/Wrapped/Chess.com/Balatro/TFT/Strava, và chỗ nào của
 * thẻ này phục vụ luật nào:
 *   1. RỜI APP ĐƯỢC   → PNG + chữ dán được (`chuDan`), không cần mở app để hiểu;
 *   2. một SỐ + một HÌNH → hạng/N + ĐƯỜNG NAV từng vòng;
 *   3. có TÔI         → handle + con đường kỳ ngộ + hai khái niệm vừa chạm;
 *   4. có DRAMA       → cú lật lớn nhất (vòng nào, bao nhiêu);
 *   5. cùng ĐỀ để so  → mã bàn + link "chơi cùng bàn này";
 *   6. chủ đề của TRÒ → pixel, không bo góc, không gradient (§XI);
 *   7. không spoil    → KHÔNG vẽ nội dung ô (map úp), không câu kê đơn (A10).
 *
 * ⚠ HÀM THUẦN + CANVAS, không dịch vụ ảnh ngoài (C1: 0đ) và không phụ thuộc
 * font đã tải (đo `measureText` rồi tự xuống dòng; font hỏng thì chữ vẫn nằm
 * trong khung). Mọi SỐ đến từ payload server — thẻ không tự tính lại NAV/hạng,
 * vì một bản tính thứ hai sẽ trôi (D61) và cú trôi ở đây là khoe một con số
 * server không công nhận.
 */

/** Khổ thẻ — dọc 4:5, cỡ đủ nét khi đăng story mà vẫn < 1 MB PNG. */
export const CO_THE = { w: 1080, h: 1350, o: 8 } as const;

export interface DuLieuThe {
  handle: string;
  hang: number;
  tong: number;
  nav: number;
  navDau: number;
  /** NAV của CHÍNH mình theo vòng (server `nav_theo_vong`), rỗng ⇒ không vẽ đường. */
  duong: number[];
  /** Dải NAV mọi ghế theo vòng — vẽ ghost mờ phía sau (đối thủ + bạn cùng bàn). */
  daiDoiThu?: number[][];
  /** Cú lật lớn nhất: vòng + phần trăm đổi so vòng trước (bp). */
  cuLat?: { vong: number; bp: number } | undefined;
  /** Tên con đường kỳ ngộ đã chọn + đã hoàn thành chưa. */
  conDuong?: { ten: string; xong: boolean }[];
  /** Tên khái niệm vừa chạm (tối đa 2 — nhiều hơn thì thẻ thành danh sách). */
  daCham: string[];
  /** Mã bàn chung/bàn ngày (nếu có) — dòng "chơi cùng bàn này". */
  banMa?: string | null | undefined;
  /** Số ô của bàn — vẽ dải chương hồi đúng độ dài. */
  soO: number;
  link: string;
}

const MAU = {
  nen: '#04070d',
  vien: '#22d3ee',
  chu: '#e8f2fc',
  mo: '#5d7290',
  vang: '#fbbf24',
  xanh: '#34d399',
  do: '#f87171',
} as const;

/** % từ bp, kiểu VN (dấu phẩy), luôn có dấu. */
export function pct(bp: number): string {
  const v = bp / 100;
  return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1).replace('.', ',')}%`;
}

/** Chuỗi khối kiểu Wordle cho đường NAV — 8 bậc, đọc được ở mọi máy (không emoji, D47). */
export function daiKhoi(duong: readonly number[], navDau: number): string {
  if (duong.length === 0) return '';
  const BAC = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  const ti = duong.map((n) => n / (navDau || 1));
  const lo = Math.min(...ti, 1);
  const hi = Math.max(...ti, 1);
  const dai = hi - lo || 1;
  return ti.map((t) => BAC[Math.min(7, Math.max(0, Math.round(((t - lo) / dai) * 7)))]).join('');
}

/** Chữ dán được (kiểu Wordle) — cho chỗ không đăng ảnh. */
export function chuDan(d: DuLieuThe): string {
  const loi = (d.nav - d.navDau) / (d.navDau || 1);
  const dong = [
    `DELPHI · ĐẤU TRƯỜNG${d.banMa ? ` #${d.banMa.toUpperCase()}` : ''}`,
    `hạng ${d.hang}/${d.tong} · NAV ${d.nav.toLocaleString('vi-VN')} (${pct(Math.round(loi * 10000))})`,
  ];
  const khoi = daiKhoi(d.duong, d.navDau);
  if (khoi) dong.push(`${khoi}  (${d.duong.length} vòng)`);
  if (d.cuLat) dong.push(`cú lật vòng ${d.cuLat.vong}: ${pct(d.cuLat.bp)}`);
  if (d.daCham.length) dong.push(`vừa chạm: ${d.daCham.join(' · ')}`);
  dong.push(d.banMa ? `chơi cùng bàn: ${d.link}` : d.link);
  return dong.join('\n');
}

/** Bo chữ theo bề rộng — đo thật, không đếm ký tự (chữ Việt có dấu rộng khác nhau). */
function veChuGon(
  ctx: CanvasRenderingContext2D, chu: string, x: number, y: number, wMax: number,
): void {
  let s = chu;
  if (ctx.measureText(s).width <= wMax) { ctx.fillText(s, x, y); return; }
  while (s.length > 1 && ctx.measureText(`${s}…`).width > wMax) s = s.slice(0, -1);
  ctx.fillText(`${s}…`, x, y);
}

/** Khối chữ pixel: nền tối, viền cứng, không bo góc (§XI). */
function khung(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, mau: string): void {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = mau;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}

/**
 * Vẽ thẻ vào canvas đã cấp. Trả về chính canvas để tầng gọi xuất PNG.
 * ⚠ Không async, không tải ảnh ngoài — mọi thứ vẽ bằng hình học, nên hàm này
 * chạy được cả trong test (jsdom + canvas giả) lẫn trên máy yếu.
 */
export function veThe(canvas: HTMLCanvasElement, d: DuLieuThe): HTMLCanvasElement {
  canvas.width = CO_THE.w;
  canvas.height = CO_THE.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  /*
   * D182 — thẻ này là thứ người chơi ĐEM ĐI KHOE, nên nó là chỗ tệ nhất để lộ
   * font hệ điều hành. Trước đợt đổi font nó gõ cứng "JetBrains Mono"; từ lúc app
   * bỏ font đó, chuỗi ấy không khớp font nào đang nạp nên canvas rơi thẳng về
   * `monospace` của MÁY NGƯỜI XEM — đúng thứ §XI cấm, và hỏng IM LẶNG vì canvas
   * không báo gì khi thiếu font.
   * ⚠ Canvas KHÔNG đọc `font-variation-settings`, nên thẻ ra ELSH mặc định (hơi bo)
   *   thay vì ELSH 0 như trên màn. Sai lệch nhỏ, chấp nhận; muốn khớp tuyệt đối thì
   *   phải tự vẽ glyph, không đáng cho một tấm thẻ tĩnh.
   */
  const F = (co: number, dam = false) =>
    `${dam ? 'bold ' : ''}${co}px "Handjet Variable", "Handjet", monospace`;

  ctx.fillStyle = MAU.nen;
  ctx.fillRect(0, 0, CO_THE.w, CO_THE.h);
  // Viền ngoài kép — khấc pixel, không bo.
  ctx.strokeStyle = MAU.vien;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, CO_THE.w - 48, CO_THE.h - 48);
  ctx.strokeStyle = 'rgba(34,211,238,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, CO_THE.w - 80, CO_THE.h - 80);

  // ── Đầu thẻ
  ctx.fillStyle = MAU.vien;
  ctx.font = F(34, true);
  ctx.textBaseline = 'top';
  ctx.fillText('DELPHI · ĐẤU TRƯỜNG', 72, 84);
  if (d.banMa) {
    ctx.fillStyle = MAU.vang;
    ctx.font = F(30, true);
    const t = `#${d.banMa.toUpperCase()}`;
    ctx.fillText(t, CO_THE.w - 72 - ctx.measureText(t).width, 88);
  }
  ctx.fillStyle = MAU.mo;
  ctx.font = F(26);
  veChuGon(ctx, `@${d.handle}`, 72, 136, CO_THE.w - 200);

  // ── Con số duy nhất: HẠNG + NAV
  const loiBp = Math.round(((d.nav - d.navDau) / (d.navDau || 1)) * 10000);
  ctx.fillStyle = MAU.chu;
  ctx.font = F(150, true);
  ctx.fillText(`#${d.hang}`, 72, 196);
  const wHang = ctx.measureText(`#${d.hang}`).width;
  ctx.fillStyle = MAU.mo;
  ctx.font = F(44);
  ctx.fillText(`/${d.tong}`, 72 + wHang + 12, 288);
  ctx.fillStyle = loiBp >= 0 ? MAU.xanh : MAU.do;
  ctx.font = F(64, true);
  const sLoi = pct(loiBp);
  ctx.fillText(sLoi, CO_THE.w - 72 - ctx.measureText(sLoi).width, 232);
  ctx.fillStyle = MAU.mo;
  ctx.font = F(28);
  const sNav = `NAV ${d.nav.toLocaleString('vi-VN')}`;
  ctx.fillText(sNav, CO_THE.w - 72 - ctx.measureText(sNav).width, 306);

  // ── Hình kể chuyện: ĐƯỜNG NAV (ghost đối thủ mờ phía sau)
  const gx = 72; const gy = 386; const gw = CO_THE.w - 144; const gh = 330;
  khung(ctx, gx, gy, gw, gh, 'rgba(34,211,238,0.35)');
  ctx.fillStyle = MAU.mo;
  ctx.font = F(22, true);
  ctx.fillText('ĐƯỜNG NAV', gx + 18, gy + 16);
  if (d.duong.length >= 2) {
    const moi = [d.navDau, ...d.duong];
    const dai = (d.daiDoiThu ?? []).map((x) => [d.navDau, ...x]);
    const tatCa = [...moi, ...dai.flat()];
    const lo = Math.min(...tatCa);
    const hi = Math.max(...tatCa);
    const bien = hi - lo || 1;
    const px = (i: number, n: number) => gx + 30 + (i * (gw - 60)) / Math.max(1, n - 1);
    const py = (v: number) => gy + gh - 34 - ((v - lo) / bien) * (gh - 78);
    // vạch vốn đầu — mốc "hoà"
    ctx.strokeStyle = 'rgba(93,114,144,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath(); ctx.moveTo(gx + 24, py(d.navDau)); ctx.lineTo(gx + gw - 24, py(d.navDau)); ctx.stroke();
    ctx.setLineDash([]);
    // ghost các ghế khác
    ctx.strokeStyle = 'rgba(93,114,144,0.42)';
    ctx.lineWidth = 3;
    for (const g of dai) {
      ctx.beginPath();
      g.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i, g.length), py(v)) : ctx.lineTo(px(i, g.length), py(v))));
      ctx.stroke();
    }
    // đường của mình — bậc thang (pixel, không bo)
    ctx.strokeStyle = loiBp >= 0 ? MAU.xanh : MAU.do;
    ctx.lineWidth = 7;
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    moi.forEach((v, i) => {
      const X = px(i, moi.length); const Y = py(v);
      if (i === 0) ctx.moveTo(X, Y);
      else { ctx.lineTo(X, py(moi[i - 1]!)); ctx.lineTo(X, Y); }
    });
    ctx.stroke();
    // chấm cuối
    ctx.fillStyle = loiBp >= 0 ? MAU.xanh : MAU.do;
    ctx.fillRect(px(moi.length - 1, moi.length) - 9, py(moi[moi.length - 1]!) - 9, 18, 18);
  } else {
    ctx.fillStyle = MAU.mo;
    ctx.font = F(24);
    ctx.fillText('(trận quá ngắn để vẽ đường)', gx + 30, gy + gh / 2);
  }

  // ── Drama: cú lật
  let y = gy + gh + 26;
  if (d.cuLat) {
    khung(ctx, 72, y, CO_THE.w - 144, 84, d.cuLat.bp >= 0 ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)');
    ctx.fillStyle = MAU.vang;
    ctx.font = F(24, true);
    ctx.fillText('CÚ LẬT', 96, y + 16);
    ctx.fillStyle = d.cuLat.bp >= 0 ? MAU.xanh : MAU.do;
    ctx.font = F(36, true);
    ctx.fillText(`vòng ${d.cuLat.vong} · ${pct(d.cuLat.bp)}`, 96, y + 44);
    y += 104;
  }

  // ── Danh tính: con đường + khái niệm vừa chạm
  const dong = (nhan: string, giaTri: string, mau: string) => {
    ctx.fillStyle = MAU.mo;
    ctx.font = F(22, true);
    ctx.fillText(nhan, 96, y);
    ctx.fillStyle = mau;
    ctx.font = F(30, true);
    veChuGon(ctx, giaTri, 96, y + 30, CO_THE.w - 192);
    y += 82;
  };
  if (d.conDuong?.length) {
    dong('CON ĐƯỜNG', d.conDuong.map((c) => `${c.ten}${c.xong ? ' ✓' : ''}`).join(' · '), MAU.vang);
  }
  if (d.daCham.length) dong('VỪA CHẠM', d.daCham.slice(0, 2).join(' · '), MAU.vien);

  // ── Dải chương hồi: chỉ SỐ Ô, không nội dung (luật 7 — không spoil)
  const oW = Math.floor((CO_THE.w - 192) / Math.max(1, d.soO));
  const oY = CO_THE.h - 168;
  for (let i = 0; i < d.soO; i++) {
    ctx.fillStyle = i < d.duong.length ? 'rgba(34,211,238,0.55)' : 'rgba(93,114,144,0.25)';
    ctx.fillRect(96 + i * oW, oY, oW - 6, 18);
  }

  // ── Chân: link chơi cùng bàn
  ctx.fillStyle = MAU.mo;
  ctx.font = F(22);
  veChuGon(ctx, d.banMa ? `chơi cùng bàn: ${d.link}` : d.link, 96, CO_THE.h - 124, CO_THE.w - 192);
  return canvas;
}

/**
 * Cú lật lớn nhất: vòng có % đổi NAV mạnh nhất so với vòng trước (theo TRỊ
 * TUYỆT ĐỐI — cú sập cũng là chuyện đáng kể, và thẻ nói thật chứ không chỉ khoe).
 */
export function cuLatLon(duong: readonly number[], navDau: number): { vong: number; bp: number } | undefined {
  let tot: { vong: number; bp: number } | undefined;
  let truoc = navDau;
  duong.forEach((v, i) => {
    if (truoc > 0) {
      const bp = Math.round(((v - truoc) / truoc) * 10000);
      if (!tot || Math.abs(bp) > Math.abs(tot.bp)) tot = { vong: i + 1, bp };
    }
    truoc = v;
  });
  return tot;
}
