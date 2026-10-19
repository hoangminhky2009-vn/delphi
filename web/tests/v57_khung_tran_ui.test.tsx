/**
 * v57 (D457) — BƯỚC 2a Ở PHÍA WEB: trận bàn 12 (đồng hồ nhịp ngắn: đọc kết quả 5 s) thôi diễn khoảnh khắc từng vòng.
 *
 * Cùng nếp `v57_bo_co_che_ui.test.tsx`: màn trận đọc MỘT cờ server (`dong_ho_minigame`), không phân nhánh theo phiên bản, nên bài
 * canh quét đúng chỗ nối dây. Phần hành vi thật của server (DTO có cờ, đồng hồ 15 + 5) canh ở `tests/v57_khung_tran.test.ts`.
 *
 * Vì sao phải tắt ở web: lớp phủ khoảnh khắc khoá MỌI nút tới ~2,1 s mỗi cái (trần 12 s) — gấp đôi cả pha đọc 5 s, nên người chơi
 * sẽ mất giờ đặt lệnh để xem hiệu ứng. Founder 03/10 chọn: khoảnh khắc dồn về màn cuối trận.
 *
 *   §I   màn trận: danh sách khoảnh khắc `kk` rỗng khi DTO báo `dong_ho_minigame` — và VẪN dựng đủ hai nguồn ở trận cũ
 *   §II  hợp đồng kiểu: cờ DTO là TÙY CHỌN, kiểu `true` — vắng = luật cũ, trận ≤ v56 và bundle cũ không đổi
 *   §III server là nguồn cờ: web không tự suy "trận ngắn" từ số ô hay tên khoá luật
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const doc = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8');
const MAN = doc('src/screens/holdem/AlphaDraftMatch.tsx');
const API = doc('src/api/holdem.ts');

describe('§I — màn trận ngắn không diễn khoảnh khắc từng vòng', () => {
  it('⭐ `kk` rỗng khi DTO báo `dong_ho_minigame === true`', () => {
    expect(MAN).toMatch(/const kk = tt\.dong_ho_minigame === true \? \[\] : \[/);
  });

  it('vế ngược: nhánh còn lại vẫn dựng ĐỦ hai nguồn như trước (mốc hàng + khoảnh khắc từ kết quả vòng)', () => {
    const i = MAN.indexOf('const kk = tt.dong_ho_minigame === true');
    expect(i, 'không tìm thấy chỗ dựng `kk`').toBeGreaterThan(-1);
    const khoi = MAN.slice(i, i + 400);
    expect(khoi).toMatch(/\.\.\.\(noMoc \? \[khoanhKhacHang\(mocMoi\)\] : \[\]\)/);
    expect(khoi).toMatch(/\.\.\.\(tt\.ket_qua_vong \? timKhoanhKhac\(tt\.ket_qua_vong, st\.doi_thu\) : \[\]\)/);
  });

  it('`kk` vẫn được chuyển nguyên cho `apDung` — danh sách rỗng đi qua đường cũ, không có nhánh riêng', () => {
    expect(MAN).toMatch(/apDung\(tt, vonTruoc, navTruoc, st, kk\);/);
  });
});

describe('§II — hợp đồng kiểu', () => {
  it('cờ DTO `dong_ho_minigame` là TÙY CHỌN, kiểu `true`', () => {
    expect(API).toMatch(/dong_ho_minigame\?: true;/);
  });
});

describe('§III — server là nguồn cờ', () => {
  it('web không tự suy trận ngắn từ tên khoá luật hay cỡ bàn', () => {
    expect(MAN).not.toMatch(/balance-v57/);
    expect(MAN).not.toMatch(/tong_vong\s*(?:===|<=|<)\s*1[0-2]\b/);
  });
});
