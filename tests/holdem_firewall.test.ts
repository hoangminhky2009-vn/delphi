/**
 * TƯỜNG LỬA CHIP ẢO ↔ Q/T — test CI VĨNH VIỄN, D24 luật số một.
 *
 * "Mọi tài nguyên TRONG ván là chip ảo, reset mỗi trận, KHÔNG BAO GIỜ là Q hay
 *  T, không quy đổi, không giá trị mặt tiền. […] Có test CI vĩnh viễn assert:
 *  không đường code nào nối chip-trận ↔ Q/T."
 *
 * Vì sao đây là test CẤU TRÚC chứ không phải test hành vi: một đường quy đổi
 * chỉ cần tồn tại là đã hỏng, kể cả khi chưa endpoint nào gọi tới. Tính hợp
 * pháp của cả thiết kế (chip = điểm số, không phải cờ bạc) dựa vào việc đường
 * đó KHÔNG TỒN TẠI, không phải vào việc nó chưa được dùng.
 *
 * Soi CÂU LỆNH IMPORT sau khi tước comment — không grep thô. Bản grep thô của
 * tường lửa sandbox từng đỏ vì khớp đúng dòng chú thích nói "file này KHÔNG
 * import config/economy".
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const FILE_HOLDEM = ['config/holdem.ts'];
const THU_MUC_HOLDEM = 'server/holdem';

/** Module thuộc ĐƯỜNG TIỀN — chạm vào là phá tường lửa. */
const DUONG_TIEN = [
  'config/economy', 'economy.js', 'economy.ts',
  'wallet', 'ledger', 'treasury', 'bankroll', 'parimutuel', 'payout',
];

/** Định danh thuộc đường tiền — không được xuất hiện trong code holdem. */
const DINH_DANH_CAM = [
  'bankroll', 'quest_points', 'wallet_ledger', 'treasury_ledger',
  'burn_ledger', 'STARTING_BANKROLL', 'RAKE_BURN', 'RAKE_TREASURY',
];

function tuocComment(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

/** Lấy đường dẫn module của mọi câu lệnh import/export-from. */
function duongDanImport(src: string): string[] {
  const code = tuocComment(src);
  const out: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\b[^;'"]*from\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) out.push(m[1]!);
  // import('...') động
  const re2 = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = re2.exec(code)) !== null) out.push(m[1]!);
  return out;
}

async function fileHoldem(): Promise<string[]> {
  const ds = await readdir(THU_MUC_HOLDEM, { withFileTypes: true });
  return [
    ...FILE_HOLDEM,
    ...ds.filter((d) => d.isFile() && d.name.endsWith('.ts'))
      .map((d) => path.join(THU_MUC_HOLDEM, d.name)),
  ];
}

describe('Tường lửa: chip ảo KHÔNG chạm đường tiền (D24 luật số một)', () => {
  it('không file holdem nào import module thuộc đường tiền', async () => {
    for (const f of await fileHoldem()) {
      const src = await readFile(f, 'utf8');
      for (const imp of duongDanImport(src)) {
        for (const cam of DUONG_TIEN) {
          expect(
            imp.toLowerCase().includes(cam.toLowerCase()),
            `${f} import "${imp}" — chạm đường tiền "${cam}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('không định danh tiền tệ nào xuất hiện trong code holdem', async () => {
    for (const f of await fileHoldem()) {
      const code = tuocComment(await readFile(f, 'utf8'));
      for (const dd of DINH_DANH_CAM) {
        expect(
          new RegExp(`\\b${dd}\\b`).test(code),
          `${f} có định danh "${dd}" — chip ảo không được chạm Q/T`,
        ).toBe(false);
      }
    }
  });

  it('vé vào bằng Q đang KHOÁ (0) — bật là phí phẳng, không bao giờ pot P2P', async () => {
    const { HOLDEM_DECISIONS } = await import('../config/holdem.js');
    expect(HOLDEM_DECISIONS.ENTRY_TICKET_Q).toBe(0);
  });

  /*
   * ── CHIỀU NGƯỢC LẠI (founder 25/07 §1.1) ────────────────────────────────
   *
   * Bốn test trên canh chiều "chip trận → đường tiền". Chiều còn lại chưa ai
   * canh: **Shop → ví trận**. Tab Shop tiêu token T (sau này thêm Q); Vốn/Quỹ
   * vòng là chip ảo reset mỗi trận. Một dòng `import … from '@/api/holdem'`
   * trong màn Shop là đủ để dựng đường "mua đồ ngoài trận bằng chip trận" —
   * chính đường mà tường lửa A3.5 cấm vĩnh viễn.
   *
   * Canh bằng IMPORT, không bằng hành vi: đường chỉ cần TỒN TẠI là đã hỏng.
   */
  const MODULE_TRAN = ['api/holdem', 'api/arena', 'components/holdem', 'components/arena'];

  it('màn Shop KHÔNG import module trong-trận nào (chip trận không mua đồ ngoài trận)', async () => {
    const src = await readFile('web/src/screens/Shop.tsx', 'utf8');
    for (const imp of duongDanImport(src)) {
      for (const cam of MODULE_TRAN) {
        expect(
          imp.includes(cam),
          `Shop.tsx import "${imp}" — nối Shop với ví TRẬN qua "${cam}"`,
        ).toBe(false);
      }
    }
  });

  it('màn Shop không có định danh chip-trận nào (von/quy_vong/cam_ket)', async () => {
    const code = tuocComment(await readFile('web/src/screens/Shop.tsx', 'utf8'));
    for (const dd of ['quy_vong', 'cam_ket', 'match_id', 'dinhDangChip']) {
      expect(
        new RegExp(`\\b${dd}\\b`).test(code),
        `Shop.tsx có định danh trong-trận "${dd}"`,
      ).toBe(false);
    }
  });

  it('không màn nào trong web/src vừa đọc ví T vừa đọc ví trận', async () => {
    // Cách rò rỉ tinh vi hơn: không phải Shop, mà một màn TRUNG GIAN import cả
    // hai rồi làm cầu. Quét toàn bộ screens/ cho chắc.
    const goc = 'web/src/screens';
    async function liet(d: string): Promise<string[]> {
      const es = await readdir(d, { withFileTypes: true });
      const out: string[] = [];
      for (const e of es) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) out.push(...await liet(full));
        else if (e.name.endsWith('.tsx')) out.push(full);
      }
      return out;
    }
    for (const f of await liet(goc)) {
      const imps = duongDanImport(await readFile(f, 'utf8'));
      const coViT = imps.some((i) => i.includes('api/queries'));
      const coViTran = imps.some((i) => i.includes('api/holdem') || i.includes('api/arena'));
      expect(
        coViT && coViTran,
        `${f} import CẢ ví token T (api/queries) LẪN ví trận — đây là chỗ dựng cầu quy đổi`,
      ).toBe(false);
    }
  });

  /*
   * ── KÊNH ĐỌC THUẦN `api/tinh_cach` (08/08) ──────────────────────────────
   *
   * Trang Tài chính cá nhân cần hồ sơ hành vi (đo từ trận) + dòng token (ví
   * T) trên CÙNG một màn — mà bài "không màn nào import cả hai ví" ở trên cấm
   * cầm `api/holdem` chung với `api/queries`. Lời giải KHÔNG phải đục lỗ luật
   * mà là một module thứ ba KHÔNG CÓ KHẢ NĂNG GIAO DỊCH: chỉ useQuery đọc
   * chỉ số. Hai bài dưới giữ cho nó mãi mãi đúng vai đó — ai thêm mutation
   * hay import ví trận vào là đỏ ngay tại đây.
   */
  it('api/tinh_cach là kênh ĐỌC THUẦN: không import ví trận, không mutation', async () => {
    const src = await readFile('web/src/api/tinh_cach.ts', 'utf8');
    for (const imp of duongDanImport(src)) {
      for (const cam of MODULE_TRAN) {
        expect(imp.includes(cam),
          `api/tinh_cach import "${imp}" — kênh đọc thuần chạm ví trận qua "${cam}"`)
          .toBe(false);
      }
      expect(imp.includes('api/queries'),
        'api/tinh_cach import ví T — kênh đọc thuần phải đứng ngoài CẢ HAI ví')
        .toBe(false);
    }
    expect(/\buseMutation\b/.test(tuocComment(src)),
      'api/tinh_cach có mutation — nó chỉ được ĐỌC').toBe(false);
  });

  it('test này soi IMPORT chứ không grep thô — comment nhắc tên module không làm đỏ', () => {
    const gia = `
      /* File này KHÔNG import config/economy và không đụng wallet_ledger. */
      // cũng không dùng bankroll
      import { x } from './map.js';
    `;
    expect(duongDanImport(gia)).toEqual(['./map.js']);
    expect(tuocComment(gia)).not.toContain('bankroll');
  });
});
