/**
 * v57 (D456) — BƯỚC 1 Ở PHÍA WEB: trận khoá `balance-v57-minigame` ẩn Bảng điện tử + dòng "~N giả", và tester có lối vào khoá ấy.
 *
 * Cùng nếp `bo_bai_tat.test.tsx`: màn trận đọc MỘT cờ server (không phân nhánh theo phiên bản), nên bài canh quét đúng chỗ nối
 * dây. Phần hành vi thật của server (403 `luat_tat`, DTO có cờ) canh ở `tests/v57_bo_co_che.test.ts` (suite gốc).
 *
 *   §I   màn trận: khối Bảng điện tử chỉ vẽ khi DTO ghế KHÔNG mang `khong_bang_dien_tu`; "~N giả" ẩn khi `the_luon_that`
 *   §II  lối vào cho tester: `?luat=` ở sảnh → PhongCho → `ep_balance` ở body tạo trận, lọc hình dạng ĐÚNG như server
 *   §III hợp đồng kiểu: hai cờ là TÙY CHỌN trong DTO (vắng = luật cũ, trận ≤ v56 và bundle cũ không đổi)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const doc = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8');
const MAN = doc('src/screens/holdem/AlphaDraftMatch.tsx');
const SANH = doc('src/screens/holdem/AlphaDraftLobby.tsx');
const PHONG = doc('src/components/holdem/PhongCho.tsx');
const API = doc('src/api/holdem.ts');
const SERVER = readFileSync(resolve(process.cwd(), '..', 'server/holdem_api.ts'), 'utf8');

describe('§I — màn trận đọc hai cờ của server', () => {
  it('⭐ khối Bảng điện tử chỉ vẽ khi DTO ghế không mang `khong_bang_dien_tu` (và vẫn giữ hai điều kiện cũ)', () => {
    expect(MAN).toMatch(/bang=\{!b\.da_chay && b\.tu_the !== 'all_in' && !b\.khong_bang_dien_tu \? \(/);
  });

  it('⭐ "~N giả" biến mất khi `bo_bai_con_lai.the_luon_that`; trận cũ vẫn in đúng dòng như trước', () => {
    expect(MAN).toMatch(/stBan\.bo_bai_con_lai\.the_luon_that \? '' : ` · ~\$\{stBan\.bo_bai_con_lai\.tin_gia_ky_vong\} giả`/);
    // Vế ngược: dòng cũ còn nguyên trong nhánh còn lại — không ai lỡ xoá luôn chữ "giả" của trận ≤ v56.
    expect(MAN).toMatch(/còn \{stBan\.bo_bai_con_lai\.con_lai\} ô · \{stBan\.bo_bai_con_lai\.so_su_kien\} tin/);
  });
});

describe('§II — tester vào khoá đang dựng bằng `?luat=`', () => {
  it('⭐ sảnh đọc `?luat=`, lọc đúng hình dạng server, đưa vào phòng chờ và đưa vào nhóm "có việc khác"', () => {
    expect(SANH).toMatch(/thamSoUrl\.get\('luat'\)/);
    expect(SANH).toMatch(/epBalance: epBalanceUrl/);
    expect(SANH).toMatch(/epBalance=\{phongCho\.epBalance\}/);
    expect(SANH).toMatch(/epBalanceUrl !== undefined \|\| docDiemQuayVe\(\) !== null/);
  });

  it('⭐ phòng chờ chuyển `epBalance` cho `useTaoTran`, và body gửi `ep_balance`', () => {
    expect(PHONG).toMatch(/\.\.\.\(epBalance !== undefined \? \{ epBalance \} : \{\}\)/);
    expect(API).toMatch(/\.\.\.\(opts\?\.epBalance !== undefined \? \{ ep_balance: opts\.epBalance \} : \{\}\)/);
  });

  it('⭐ MỘT hình dạng khoá luật: regex lọc ở sảnh GIỐNG HỆT regex `ep_balance` của server (không hai bản để trôi)', () => {
    const lay = (nguon: string, neo: RegExp): string => {
      const m = neo.exec(nguon);
      expect(m, `không tìm thấy regex ${neo}`).not.toBeNull();
      return m![1]!;
    };
    const o_sanh = lay(SANH, /raw !== null && \/(\^balance-[^/]+\$)\/\.test\(raw\)/);
    const o_server = lay(SERVER, /if \(!\/(\^balance-[^/]+\$)\/\.test\(epBalanceRaw\)\)/);
    expect(o_sanh).toBe(o_server);
  });

  it('không có ô nhập hay nút nào cho người chơi thường — chỉ đọc từ URL (nếp `?seed=`)', () => {
    expect(SANH).not.toMatch(/<(input|select|textarea)[^>]*(luat|balance)/i);
    expect(PHONG).not.toMatch(/<(input|select|textarea)[^>]*(luat|balance)/i);
  });
});

describe('§III — hợp đồng kiểu', () => {
  it('hai cờ DTO là TÙY CHỌN, kiểu `true` — vắng = luật cũ', () => {
    expect(API).toMatch(/khong_bang_dien_tu\?: true;/);
    expect(API).toMatch(/the_luon_that\?: true;/);
  });
});
