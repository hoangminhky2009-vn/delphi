/**
 * THANG MÀU HẠNG — nội suy LIÊN TỤC theo điểm.
 *
 * Founder 23/08: *"thanh không chỉ tăng mà còn đổi màu dần theo mức hiện tại
 * nhé … Màu cho từng mức thì tham khảo devil may cry"*.
 *
 * ─── ⚠ TRA CỨU ĐÍNH CHÍNH ĐỀ BÀI ──────────────────────────────────────────
 * Dãy tên bậc quen thuộc *"Dirty · … · Sensational"* là HAI GAME TRỘN VÀO NHAU:
 * `Dirty` và `Sensational` thuộc **DmC (bản reboot 2013)**, không phải DMC5.
 * Thang DMC5 thật: Dismal · Crazy · Badass · Apocalyptic · Savage · Sick Skills
 * · Smokin' Sexy Style. (DMC4: Deadly · Carnage · Brutal · Atomic · Smokin' ·
 * Smokin' Style · Smokin' Sick Style — cả ba game đều theo luật "tên bắt đầu
 * bằng đúng chữ cái của bậc".) Ghi ra vì lần sau ai tra lại sẽ gặp đúng cái bẫy
 * đó, và vì chữ `Smokin'` chiếm CẢ BA bậc S của DMC4 — tức hình tượng KHÓI LỬA
 * nằm ngay trong tên gọi chính thức, không phải tôi bịa ra để trang trí.
 *
 * ─── ⚠ KHAI ĐỘ TIN: MỌI MÃ HEX DƯỚI ĐÂY LÀ SUY LUẬN ───────────────────────
 * Capcom không công bố mã màu HUD, và không nguồn chữ nào mô tả màu từng bậc.
 * Đã thử ĐO THẬT chứ không chỉ tra chữ — mọi ngõ đều cụt: wiki 402 · 5 ảnh
 * chính thức trên Steam quét pixel ra CẢNH ĐIỆN ẢNH KHÔNG CÓ HUD · ảnh cộng
 * đồng bị cổng nội dung chặn · thumbnail YouTube là ảnh chế. Muốn số THẬT thì
 * chỉ còn đường tự chụp màn hình game rồi hút màu.
 * ⇒ Đây là DẢI TỰ THIẾT KẾ theo đúng TRỤC của DMC (lạnh → nóng, điểm lật ở A),
 * chỉnh cho pixel neon nền tối ở 375px. Và việc không bê được màu thật có khi
 * lại may: HUD thật của DMC tối, bão hoà thấp, phủ đầy bloom — bê nguyên vào
 * đây thì các bậc dính vào nhau, không đọc ra bậc nào với bậc nào.
 *
 * ─── ⚠⚠ VÀ TRA CỨU BÁC MỘT NỬA YÊU CẦU — CHỖ NÀY ĐÁNG ĐỌC KỸ ──────────────
 * Không game DMC nào đổi màu DẦN: *"điểm là liên tục, hạng là ngưỡng"* — thanh
 * chạy mượt, còn MÀU nhảy đúng tại khoảnh khắc qua ngưỡng. Lý do họ làm vậy:
 * đổi dần thì người chơi không đọc được mình đang ở bậc nào.
 *
 * Vẫn làm liên tục như founder đặt, vì lý do đó KHÔNG áp cho ta: thanh của DMC
 * không có nhãn hạng thường trực nên MÀU phải gánh cả việc "đang ở đâu"; thanh
 * của ta có CHỮ HẠNG pixel đứng ngay cạnh, luôn hiện. Màu được rảnh, nên nó
 * nhận việc khác: cho biết ĐANG TIẾN. Bản cũ gom 20 hạng thành 5 bậc màu, nên
 * leo từ `C-` lên `C+` — 55 điểm, gần một phần tư quãng đường — không đổi một
 * pixel nào.
 * ⚠ Nhưng lời cảnh báo vẫn được tôn trọng ở chỗ khác: cú qua ngưỡng phải ĐỌC RA
 * ĐƯỢC, nên nó có cú đóng dấu riêng (`pcDong`) và các MỐC màu đặt đúng tại
 * ngưỡng chữ cái — trong lòng một bậc màu chỉ nhích, qua bậc thì nó rẽ hướng.
 */

import { THANG } from '@server/holdem/phong_cach';

/**
 * Ngưỡng điểm của một hạng — lấy THẲNG từ `THANG` của server.
 *
 * ⚠ KHÔNG chép số. Bản đầu của file này gõ tay 355/520/670/805/925/970 và nó là
 * bản sao thứ N của cùng một bảng: đổi `THANG` ở server thì mốc màu trôi IM
 * LẶNG — không lỗi, không test đỏ, chỉ là các bậc màu thôi trùng với các bậc
 * chữ. Đúng lớp D61, và ở dạng khó thấy nhất vì hai thứ vẫn "trông hợp lý".
 */
const nguong = (h: string): number => {
  const m = THANG.find((t) => t.hang === h);
  if (!m) throw new Error(`mau_hang: không có hạng ${h} trong THANG`);
  return m.tu;
};

/**
 * Mốc màu theo ĐIỂM (0–1000), neo tại ĐÚNG ngưỡng chữ cái của `phong_cach.ts`.
 * Giữa hai mốc thì nội suy tuyến tính trong RGB.
 */
const MOC: readonly { tu: number; mau: [number, number, number] }[] = [
  { tu: 0, mau: [124, 135, 148] },              // #7c8794 — E/D "Dismal": xám thép
  { tu: nguong('C-'), mau: [63, 169, 245] },    // #3fa9f5 — C "Crazy": lam neon
  { tu: nguong('B-'), mau: [34, 211, 197] },    // #22d3c5 — B "Badass": lục lam
  { tu: nguong('A-'), mau: [200, 240, 60] },    // #c8f03c — A: ĐIỂM LẬT lạnh→nóng
  { tu: nguong('S-'), mau: [255, 176, 32] },    // #ffb020 — S "Savage": vào vùng LỬA
  { tu: nguong('SS'), mau: [255, 106, 24] },    // #ff6a18 — SS "Sick Skills": cam lửa
  { tu: nguong('SSS'), mau: [255, 224, 102] },  // #ffe066 — SSS: lõi trắng-vàng cháy
];

/*
 * ⚠ Điểm lật đặt ở A chứ không ở S, đúng thang DMC: người chơi phải cảm thấy
 * mình vừa bước qua một ngưỡng TRƯỚC khi chạm nhóm S, không phải lúc đã ở đó.
 * ⚠ SSS lấy lõi gần TRẮNG chứ không phải một màu bão hoà hơn SS: ở 375px trên
 * nền tối, thứ đọc ra "cháy hết cỡ" là ĐỘ CHÓI, không phải sắc độ — một màu bão
 * hoà nữa chỉ trông như SS đậm hơn. (Thanh SSS còn phủ cầu vồng chạy đè lên,
 * xem `.fx_cau_vong`; màu này là thứ chữ hạng dùng.)
 */

const kep = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Màu của một mức điểm — `rgb(...)`, nội suy giữa hai mốc gần nhất. */
export function mauTheoDiem(diem: number): string {
  const d = kep(diem, 0, 1000);
  const cuoi = MOC[MOC.length - 1]!;
  let a = MOC[0]!;
  let b = cuoi;
  if (d >= cuoi.tu) { a = cuoi; b = cuoi; } else {
    for (let i = 0; i < MOC.length - 1; i += 1) {
      if (d >= MOC[i]!.tu && d <= MOC[i + 1]!.tu) { a = MOC[i]!; b = MOC[i + 1]!; break; }
    }
  }
  const khoang = b.tu - a.tu;
  const t = khoang === 0 ? 0 : (d - a.tu) / khoang;
  const c = (i: 0 | 1 | 2) => Math.round(a.mau[i] + (b.mau[i] - a.mau[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

/**
 * DẢI MÀU CỦA CẢ THANG — founder 24/08: *"làm đẹp thanh chấm phong cách, cho nó
 * thành 1 dải màu chuyển tiếp mượt cho từng mốc (để khoảnh khắc chuyển sang cầu
 * vồng rực rỡ hay lửa cháy của SSS và S nó mượt) thay vì chỉ 1 màu hard cho
 * từng mốc"*.
 *
 * ⭐ THANH TỰ NÓ LÀ CÁI THANG. Trước bản này mực thanh là MỘT màu phẳng
 * (`mauTheoDiem` của điểm hiện tại), nên cú bước sang S/SS/SSS là một cú ĐỔI
 * MÀU CẢ THANH — thanh đang xanh lá bỗng vàng rực, và lửa/cầu vồng ập vào một
 * mặt phẳng vừa đổi màu. Nay mực mang trọn dải 0→1000, nên leo tới đâu LỘ RA
 * tới đó: mép dẫn đầu chính là màu bậc đang đứng, và phần sau lưng là con đường
 * đã đi. Cú vào SSS thành cú TỚI NƠI, không phải cú lật công tắc.
 *
 * ⚠ SUY TỪ `MOC`, KHÔNG GÕ LẠI CHUỖI. Bảng mốc là nguồn chung với `mauTheoDiem`,
 * nên chỉnh một hex là cả hai đi theo — chép ra một dải thứ hai là dựng đúng
 * bản-sao-sẽ-trôi mà D61 nói tới, và cú trôi ở đây biểu hiện là "mép thanh một
 * màu, chữ hạng cạnh nó một màu khác".
 * ⚠ Mốc đặt theo % của thang 1000, tức ĐÚNG vị trí ngưỡng chữ cái nằm trên
 * thanh. Nhờ vậy chỗ dải đổi tông trùng khít chỗ hạng đổi tên — không phải một
 * dải trang trí chạy song song với một thang khác.
 */
export function daiMauThang(): string {
  const chan = MOC.map(({ tu, mau }) =>
    `rgb(${mau[0]}, ${mau[1]}, ${mau[2]}) ${((tu / 1000) * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${chan.join(', ')})`;
}

/**
 * BẬC HIỆU ỨNG — quyết định thanh được cấp thêm KÊNH CẢM GIÁC nào. Founder
 * 23/08: *"riêng từ S trở đi thanh sẽ cháy và SS thì tăng cường độ cháy còn SSS
 * thì hóa thành cầu vồng lấp lánh và chạy liên tục … từ B trở lên thì cho nó
 * hoạt ảnh lóe sáng nhẹ của kim loại"*.
 *   `thuong`    E → C+   chỉ màu
 *   `kim_loai`  B → A+   thêm vệt loé kim loại quét ngang
 *   `chay`      S → S+   thanh CHÁY
 *   `chay_manh` SS       cháy mạnh hơn
 *   `cau_vong`  SSS      cầu vồng lấp lánh, chạy liên tục
 *
 * ⚠ Suy từ ĐIỂM ĐANG CHẠY chứ không từ hạng chốt của server: thanh đang bò từ A
 * lên SS thì phải BẮT LỬA đúng lúc băng mốc S, không phải đợi hết hoạt ảnh mới
 * bùng một phát — đó là cả điểm của việc chạy tuyến tính.
 */
export type BacHieuUng = 'thuong' | 'kim_loai' | 'chay' | 'chay_manh' | 'cau_vong';

export function bacHieuUng(diem: number): BacHieuUng {
  /* ⚠ Cùng lý do như `MOC`: ngưỡng đọc từ `THANG`, không gõ số. */
  if (diem >= nguong('SSS')) return 'cau_vong';
  if (diem >= nguong('SS')) return 'chay_manh';
  if (diem >= nguong('S-')) return 'chay';
  if (diem >= nguong('B-')) return 'kim_loai';
  return 'thuong';
}

/**
 * Cú LÊN HẠNG mạnh hay nhẹ — founder: *"từ E>B thì sẽ chỉ có những bước nhảy
 * nhẹ nhưng từ A > SSS phải là hiệu ứng rung và thay thế mạnh và rõ ràng hơn"*.
 * Mốc A = 670 điểm, trùng đúng điểm lật lạnh→nóng của thang màu — một ngưỡng,
 * không phải hai.
 */
export const MOC_MANH = nguong('A-');
