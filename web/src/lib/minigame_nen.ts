/**
 * Dựng NẾN HIỂN THỊ từ nhịp giá server gửi (D472). Thuần, không tiền (C4). Nến mịn = 8 nhịp; khung thường gộp đôi (16 nhịp / nến) như
 * demo `gopHaiNen` — mở của nến đầu, đóng của nến sau, râu = cực trị cả hai, nên cú giật nửa giây thành RÂU chứ không mất.
 * Mở của một nến = đóng của nến trước (server dựng y thế, trừ nến "gap" — chỉ lệch vài phần nghìn ở mép thân, không đổi râu).
 */
export interface NenHienThi { o: number; h: number; l: number; c: number; trang: boolean; trangBan: boolean; lichSu: boolean }

export const NHIP_MOI_NEN = 8;

/**
 * @param lichSu 20 nến mịn trước màn [mở, cao, thấp, đóng]
 * @param gia giá nhịp 0…k của màn (đã nhận tới đâu thì tới đó)
 * @param trang cờ trắng theo chỉ số nến mịn của màn
 * @param gop true = khung thường (gộp đôi), false = khung nhanh 60 nến
 */
export function dungNenHienThi(
  lichSu: readonly number[][], gia: readonly number[],
  trang: ReadonlyMap<number, [boolean, boolean]>, gop: boolean,
): NenHienThi[] {
  const min: NenHienThi[] = lichSu.map(([o, h, l, c]) => ({ o: o!, h: h!, l: l!, c: c!, trang: false, trangBan: false, lichSu: true }));
  let dong = min.length ? min[min.length - 1]!.c : (gia[0] ?? 100);
  for (let j = 0; j * NHIP_MOI_NEN < gia.length; j++) {
    const t = gia.slice(j * NHIP_MOI_NEN, (j + 1) * NHIP_MOI_NEN);
    const c = t[t.length - 1]!, cr = trang.get(j);
    min.push({ o: dong, h: Math.max(dong, ...t), l: Math.min(dong, ...t), c, trang: !!cr?.[0], trangBan: !!cr?.[1], lichSu: false });
    dong = c;
  }
  if (!gop) return min;
  const ra: NenHienThi[] = [];
  for (let i = 0; i < min.length; i += 2) {
    const a = min[i]!, b = min[i + 1];
    ra.push(b ? { o: a.o, h: Math.max(a.h, b.h), l: Math.min(a.l, b.l), c: b.c, trang: a.trang || b.trang, trangBan: a.trangBan || b.trangBan, lichSu: a.lichSu && b.lichSu } : { ...a });
  }
  return ra;
}
