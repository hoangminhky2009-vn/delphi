/**
 * CHIA POT — pot chính + các pot phụ khi có người all-in.
 *
 * Hàm thuần, số nguyên tuyệt đối, không chạm đường tiền (chip ảo — D24 luật 1).
 *
 * ─── VÌ SAO CẦN ────────────────────────────────────────────────────────────
 * Bản engine trước ĐÁ THẲNG người không đủ vốn theo giá ra khỏi vòng: họ mất
 * cam kết nền rồi ngồi ngoài. Hệ quả là hết vốn thì bị loại dần chứ không
 * được đánh cú cuối — mất hẳn khoảnh khắc all-in cửa tử, thứ kịch tính nhất
 * của poker. Có side pot thì người ít vốn vẫn all-in được và tranh đúng phần
 * mình đủ sức theo.
 *
 * ─── HAI LUẬT TÁCH BIỆT (đừng gộp) ─────────────────────────────────────────
 *  (1) ALL-IN ÍT HƠN → tách pot phụ. Người góp 100 chỉ tranh tầng 100; phần
 *      vượt của người giàu hơn thành pot riêng họ không đụng tới.
 *  (2) CƯỢC KHÔNG AI ĐỐI ĐƯỢC → TRẢ LẠI. Tố 900 mà bàn chỉ theo nổi 100 thì
 *      800 quay về túi, không phải "thắng" nó.
 *
 * Pot có ĐÚNG MỘT người tranh vẫn hợp lệ khi người khác BỎ BÀI — tiền của
 * người bỏ là tiền chết, người trụ lại ăn cả.
 */

export interface Pot {
  so_tien: number;
  /** Ai đủ điều kiện tranh pot này (đã lọc người bỏ bài). */
  du_tranh: string[];
}

export interface KetQuaChiaPot {
  pots: Pot[];
  /** Phần cược thừa không ai đối được → hoàn về đúng người. */
  tra_lai: Map<string, number>;
  /**
   * v54 (D403) — SONG SONG `pots`: ghế → phần ĐÃ GÓP vào đúng pot đó (người bỏ bài vẫn có dòng — tiền họ nằm trong
   * pot). Trần phần một ghế (`kepTranHang1`, engine) trả phần vượt theo tỷ lệ này. Chỉ ĐỌC thêm — pot không đổi.
   */
  gop_theo_pot: Map<string, number>[];
}

/**
 * Chia đầy đủ: trả cả pot lẫn phần hoàn.
 *
 * @param gop  ghế → tổng đã góp trong vòng (kể cả người đã bỏ)
 * @param daBo ghế đã bỏ bài — tiền của họ ở lại pot nhưng họ không tranh
 */
export function chiaPotDayDu(
  gop: ReadonlyMap<string, number>,
  daBo: ReadonlySet<string>,
): KetQuaChiaPot {
  const traLai = new Map<string, number>();
  if (gop.size === 0) return { pots: [], tra_lai: traLai, gop_theo_pot: [] };

  // ── (2) Cắt phần không ai đối được TRƯỚC khi phân tầng ───────────────────
  // Chỉ xét mức góp của những người CÒN TRANH khi tìm "mức cao nhì": người đã
  // bỏ không thể "đối" cược của ai cả.
  const conTranh = [...gop.keys()].filter((id) => !daBo.has(id));
  const mucHieuLuc = new Map(gop);

  if (conTranh.length > 0) {
    const mucSapXep = [...gop.entries()].sort((a, b) => b[1] - a[1]);
    const [caoNhatId, caoNhat] = mucSapXep[0]!;
    const caoNhi = mucSapXep[1]?.[1] ?? 0;
    if (caoNhat > caoNhi) {
      traLai.set(caoNhatId, caoNhat - caoNhi);
      mucHieuLuc.set(caoNhatId, caoNhi);
    }
  }

  // ── (1) Phân tầng theo các mức góp khác nhau ────────────────────────────
  const mucs = [...new Set([...mucHieuLuc.values()].filter((v) => v > 0))]
    .sort((a, b) => a - b);

  const pots: Pot[] = [];
  /** D403 — song song `pots`: ai góp bao nhiêu vào từng tầng. */
  const gopTang: Map<string, number>[] = [];
  let mucTruoc = 0;
  for (const muc of mucs) {
    const day = muc - mucTruoc;
    let tien = 0;
    const duTranh: string[] = [];
    const gopCuaTang = new Map<string, number>();
    for (const [id, v] of mucHieuLuc) {
      if (v <= mucTruoc) continue;
      // Mỗi người đóng vào tầng này tối đa `day`, hoặc phần còn lại của họ.
      const phan = Math.min(v - mucTruoc, day);
      tien += phan;
      gopCuaTang.set(id, phan);
      // Người BỎ vẫn góp tiền nhưng KHÔNG vào danh sách tranh.
      if (v >= muc && !daBo.has(id)) duTranh.push(id);
    }
    if (tien > 0) {
      pots.push({ so_tien: tien, du_tranh: duTranh });
      gopTang.push(gopCuaTang);
    }
    mucTruoc = muc;
  }

  // ── Gộp các tầng có CÙNG danh sách tranh ────────────────────────────────
  // Không gộp thì một bàn 5 người all-in lệch nhau đẻ ra 4-5 pot rời rạc, UI
  // hiển thị rối mà kết quả không khác gì.
  const gopLai: Pot[] = [];
  const gopTheoPot: Map<string, number>[] = [];
  for (let i = 0; i < pots.length; i += 1) {
    const p = pots[i]!;
    const truoc = gopLai[gopLai.length - 1];
    if (truoc && cungTapHop(truoc.du_tranh, p.du_tranh)) {
      truoc.so_tien += p.so_tien;
      const m = gopTheoPot[gopTheoPot.length - 1]!;
      for (const [id, x] of gopTang[i]!) m.set(id, (m.get(id) ?? 0) + x);
    } else {
      gopLai.push({ ...p });
      gopTheoPot.push(new Map(gopTang[i]!));
    }
  }

  return { pots: gopLai, tra_lai: traLai, gop_theo_pot: gopTheoPot };
}

/** Chỉ lấy danh sách pot — tiện cho chỗ không quan tâm phần hoàn. */
export function chiaPot(
  gop: ReadonlyMap<string, number>,
  daBo: ReadonlySet<string>,
): Pot[] {
  return chiaPotDayDu(gop, daBo).pots;
}

function cungTapHop(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}
