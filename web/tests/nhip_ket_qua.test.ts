/**
 * D398 — NHỊP KẾT QUẢ MỘT HÀNG (luật A11.26).
 *
 * Founder 24/09: *"hiện tại chúng ta có hiệu ứng nhưng chúng đang bị giẫm chân nhau, nên chia thứ tự rõ ràng và
 * áp luôn quy tắc cho sau này: Chốt vòng > Chia quỹ vòng > Thẻ bài lật > Lãi lỗ (Bản cải tiến) Nhảy > Thanh chấm
 * điểm phong cách và lửa monument thay đổi"* — *"đừng làm quá nhiều hiệu ứng khác nhau cùng 1 khoảng thời gian
 * ngắn, ko ai thấy được cùng lúc đâu"*.
 *
 * Canh hai tầng: LỊCH (`lichKetQua` — một nguồn) và DÂY NỐI (màn trận thật sự chạy theo lịch ấy, không còn hẹn
 * giờ riêng). Hành vi trên màn thật được soi bằng ảnh chụp từng bước (D398 §Nghiệm thu).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUOC_KET_QUA, daToiBuoc, lichKetQua, NHIP, PHA_CUA_BUOC, type BuocKetQua, type BuocLich,
} from '../src/lib/nhip';

const ms = (l: BuocLich[], b: BuocKetQua) => l.find((x) => x.buoc === b)!.ms;

describe('1. lịch — đúng câu founder, một hàng', () => {
  it('⭐ thứ tự PHA đúng câu: Chia quỹ > Thẻ bài lật > Lãi lỗ > Phong cách (Chốt là cú bấm mở màn)', () => {
    const pha = BUOC_KET_QUA.map((b) => PHA_CUA_BUOC[b]).filter((p, i, a) => i === 0 || p !== a[i - 1]);
    expect(pha).toEqual(['chia_quy', 'the_bai_lat', 'lai_lo', 'phong_cach', 'xong']);
    // Trong "Thẻ bài lật": lá lật trước, rồi băng tin, rồi NỀN bàn thẻ đổi (D442 — lá vừa lật là cái gây ra), rồi dải 6 mã.
    expect(BUOC_KET_QUA.filter((b) => PHA_CUA_BUOC[b] === 'the_bai_lat'))
      .toEqual(['lat_la', 'tin', 'moi_truong', 'thi_truong']);
  });

  it('⭐ không hai bước nào chồng nhau: bước sau mở ĐÚNG lúc bước trước xong', () => {
    for (const coTin of [true, false]) {
      for (const soGheNop of [0, 5, 8]) {
        const l = lichKetQua({ coTin, soGheNop, giamChuyenDong: false });
        expect(l.map((x) => x.buoc)).toEqual([...BUOC_KET_QUA]);
        expect(l[0]!.batDau).toBe(0);
        for (let i = 1; i < l.length; i += 1) expect(l[i]!.batDau).toBe(l[i - 1]!.batDau + l[i - 1]!.ms);
      }
    }
  });

  it('mỗi bước đủ dài cho tiêu điểm của nó; bước không có hiệu ứng = 0 ms (không bắt chờ khoảng trống)', () => {
    const coTin = lichKetQua({ coTin: true, giamChuyenDong: false });
    const khongTin = lichKetQua({ coTin: false, giamChuyenDong: false });
    expect(ms(coTin, 'lat_la')).toBeGreaterThanOrEqual(NHIP.LAT_SU_KIEN);   // lá lật trọn
    expect(ms(coTin, 'tin')).toBeGreaterThanOrEqual(NHIP.BANG_RON);          // băng tin diễn trọn, dải chờ nó
    expect(ms(khongTin, 'tin')).toBe(0);
    expect(ms(khongTin, 'chia_quy')).toBe(0);                                // không ghế nào nộp xu vào GIẢI
    // D401 — Giải Vòng: có ghế nộp thì bước chia quỹ đủ cho ít nhất một viên xu bay trọn.
    expect(ms(lichKetQua({ coTin: false, soGheNop: 5, giamChuyenDong: false }), 'chia_quy'))
      .toBeGreaterThanOrEqual(NHIP.XU_VAO_GIAI);
    expect(ms(coTin, 'thi_truong')).toBeGreaterThanOrEqual(2 * NHIP.NHICH_LA); // hai nhịp mũi tên
    expect(ms(coTin, 'phong_cach')).toBeGreaterThanOrEqual(NHIP.BAT_DEN_PHONG_CACH);
  });

  it('⭐ cả chuỗi (kể cả ô tin + có chia quỹ) nằm gọn trong pha ĐỌC 15 s của server', () => {
    const l = lichKetQua({ coTin: true, soGheNop: 8, giamChuyenDong: false });
    expect(l[l.length - 1]!.batDau).toBeLessThan(15_000);
  });

  /*
   * D442 lượt 3 (founder 28/09: "phân thứ tự xuất hiện hay thời gian của tất cả các hiệu ứng từ sau khi bấm chốt vòng …
   * cân bằng thời gian nữa để còn vừa kịp nhìn hiệu ứng mà cũng vừa đủ thời gian suy nghĩ") — bước MÔI TRƯỜNG: có mặt
   * CHỈ khi xu hướng đổi, đủ dài cho đổi màu + rung; và CA XẤU NHẤT (tin + 8 ghế nộp + đổi nền + đủ 6 hộp khoản) vẫn nằm
   * trong pha ĐỌC — phần còn lại của vòng là giờ nghĩ.
   */
  it('⭐ D442 — bước MÔI TRƯỜNG: 0 ms khi xu hướng giữ nguyên; đủ cho đổi màu + rung khi đổi', () => {
    expect(ms(lichKetQua({ coTin: false, giamChuyenDong: false }), 'moi_truong')).toBe(0);
    expect(ms(lichKetQua({ coTin: false, giamChuyenDong: false, doiMoiTruong: true }), 'moi_truong'))
      .toBeGreaterThanOrEqual(NHIP.MT_DOI + NHIP.MT_RUNG);
    expect(ms(lichKetQua({ coTin: true, giamChuyenDong: true, doiMoiTruong: true }), 'moi_truong'), 'giảm chuyển động')
      .toBe(0);
  });

  it('⭐ D442 — ca xấu nhất (tin + 8 ghế nộp + đổi nền + đủ hộp khoản) vẫn gọn trong pha ĐỌC 15 s', () => {
    const l = lichKetQua({ coTin: true, soGheNop: 8, giamChuyenDong: false, doiMoiTruong: true, soKhoan: 6 });
    expect(l[l.length - 1]!.batDau).toBeLessThan(15_000);
  });

  it('giảm chuyển động: GIỮ THỨ TỰ, bỏ thời lượng', () => {
    const l = lichKetQua({ coTin: true, giamChuyenDong: true });
    expect(l.map((x) => x.buoc)).toEqual([...BUOC_KET_QUA]);
    expect(l.every((x) => x.ms === 0 && x.batDau === 0)).toBe(true);
  });

  it('daToiBuoc so theo thứ tự lịch', () => {
    expect(daToiBuoc('lat_la', 'lai_lo')).toBe(false);
    expect(daToiBuoc('lai_lo', 'lai_lo')).toBe(true);
    expect(daToiBuoc('xong', 'phong_cach')).toBe(true);
    expect(daToiBuoc('thi_truong', 'phong_cach')).toBe(false);
  });
});

describe('2. dây nối — màn trận chạy theo lịch, không còn hẹn giờ riêng', () => {
  const man = readFileSync(resolve(process.cwd(), 'src/screens/holdem/AlphaDraftMatch.tsx'), 'utf8');
  const khongChuThich = man.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it('⭐ màn trận gọi `lichKetQua`; hẹn giờ lật riêng (setTimeout … CUA_SO_LAT) không còn', () => {
    expect(khongChuThich).toContain('lichKetQua(');
    expect(khongChuThich).not.toMatch(/setTimeout\([^;]*NHIP\.CUA_SO_LAT/);
  });

  it('⭐ khoảnh khắc KHÔNG diễn trước khi lá lật: cú chốt áp kết quả ngay, khoảnh khắc đi vào bước của nó', () => {
    expect(khongChuThich).toContain('apDung(tt, vonTruoc, navTruoc, st, kk)');
    // Đường cũ: xếp hàng khoảnh khắc rồi GIỮ kết quả chờ nó diễn xong (lên hạng SSS nổ khi lá còn úp).
    expect(khongChuThich).not.toMatch(/setChoDienXong\(true\);\s*setKetQuaCho\(/);
  });

  it('⭐ số lãi/lỗ và thanh phong cách đọc ẢNH GIỮ tới đúng bước; VÌ SAO mở từ bước lãi/lỗ', () => {
    expect(khongChuThich).toMatch(/useSoChay\(stSo\?\.ban\.nav/);
    expect(khongChuThich).toMatch(/thanhPhongCachCua\(stPc/);
    expect(khongChuThich).toMatch(/daToiBuoc\(buocKq, 'lai_lo'\) && moLyDo/);
  });
});
