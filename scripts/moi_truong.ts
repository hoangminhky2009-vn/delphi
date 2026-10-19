/**
 * ĐANG NỐI VÀO DB NÀO — hai dòng canh cho mọi lệnh CLI chạm tiền hoặc schema.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ CA THẬT (06/09/2026, D289) — VÌ SAO TỆP NÀY TỒN TẠI
 *
 * Founder chạy để rót vốn cho prod:
 *
 *     npm run migrate --env-file=.env.prod        ⚠ KHÔNG chạy trên prod
 *
 * `--env-file` là cờ của **node/tsx**, KHÔNG phải của `npm run`. npm không hiểu
 * nó, in một dòng `npm warn Unknown cli config` rồi **chạy tiếp trên `.env`** —
 * tức DB dev. Ba lệnh (migrate · rót 2.000 T · audit) đều báo ✔ và đều nói về
 * một cái DB khác với cái người gõ đang nghĩ tới. Không có gì sai ở đâu cả:
 * mỗi lệnh làm đúng việc của nó, chỉ trên nhầm máy.
 *
 * Rồi lệnh rót chạy **hai lần** — vì cả hai lần đều "thành công", không có gì
 * trong đầu ra nói lần này khác lần trước. Trên dev thì vô hại; trên prod đó là
 * 4.000 T rời Kho bạc, và sổ quỹ là APPEND-ONLY nên không có đường lùi.
 *
 * ⇒ Hai hàng rào ở đây, cả hai đều rẻ và cả hai đều nhắm đúng ca đã xảy ra:
 *   1. `chanEnvFileBiNuot()` — bắt đúng chữ npm đã nuốt và DỪNG, kèm lệnh đúng.
 *   2. `inDb()` — mọi lệnh in ra host/tên DB **trước khi làm gì**. Một dòng đó
 *      là thứ duy nhất phân biệt được "✔ trên prod" với "✔ trên dev".
 *
 * ⚠ KHÔNG in mật khẩu/user. Đây là dòng sẽ bị dán vào chat và ảnh chụp màn hình.
 */

/** Cờ npm đã nuốt: `--env-file=x` ở `npm run` trở thành biến này. */
const BIEN_NPM_NUOT = 'npm_config_env_file';

/** `host:port/tên-db` — không kèm thông tin đăng nhập. `?` khi URL không đọc được. */
export function moTaDb(url: string | undefined = process.env.DATABASE_URL): string {
  if (url === undefined || url === '') return '(chưa có DATABASE_URL)';
  try {
    const u = new URL(url);
    const cong = u.port === '' ? '' : `:${u.port}`;
    return `${u.hostname}${cong}${u.pathname}`;
  } catch {
    return '(DATABASE_URL không phân tích được)';
  }
}

/**
 * `true` khi đích đến KHÔNG phải máy này — dùng để đổi màu, không dùng để quyết
 * định. Một cái tên miền lạ chưa chắc là prod, và `127.0.0.1` chưa chắc là dev
 * (đường hầm SSH). Nên đây là gợi ý cho MẮT người đọc, không phải một cái cổng.
 */
export function coVeTuXa(url: string | undefined = process.env.DATABASE_URL): boolean {
  const ten = moTaDb(url);
  return !/^(127\.0\.0\.1|localhost|::1)\b/.test(ten) && !ten.startsWith('(');
}

/**
 * In một dòng "đang nối vào đâu". Gọi ĐẦU TIÊN trong mọi lệnh chạm tiền/schema.
 *
 * ⚠ In ra `stderr` có chủ ý: nhiều lệnh ở đây có đầu ra được đọc bằng mắt lẫn
 * bằng `grep`, và một dòng tiêu đề lọt vào `stdout` sẽ làm hỏng cái sau.
 */
export function inDb(nhan: string): void {
  const ten = moTaDb();
  const dau = coVeTuXa() ? '\x1b[33m⚠ TỪ XA\x1b[0m' : 'cục bộ';
  process.stderr.write(`→ ${nhan} trên \x1b[1m${ten}\x1b[0m (${dau})\n`);
}

/**
 * DỪNG nếu người gọi gõ `npm run <script> --env-file=…`.
 *
 * Trả về câu lỗi (để test đọc được) hoặc `null` khi sạch. Caller in ra rồi thoát
 * — hàm này không tự `process.exit` để còn test được (D26 cùng tinh thần: hàm
 * trả dữ liệu, vỏ CLI quyết định làm gì).
 */
export function chanEnvFileBiNuot(
  env: NodeJS.ProcessEnv = process.env, tenScript = '<script>',
): string | null {
  const v = env[BIEN_NPM_NUOT];
  if (v === undefined || v === '') return null;
  return [
    `✖ \`--env-file=${v}\` KHÔNG có tác dụng ở \`npm run\` — npm nuốt nó và lệnh này`,
    `  đang trỏ vào ${moTaDb()}, KHÔNG phải ${v}.`,
    '',
    '  `--env-file` là cờ của node/tsx, phải nằm TRƯỚC tên script:',
    `      npx tsx --env-file=${v} scripts/${tenScript}.ts`,
    '  hoặc dùng script đã gắn sẵn môi trường (xem package.json, đuôi `:prod`).',
  ].join('\n');
}

/**
 * SỔ ĐĂNG KÝ ĐÓNG — lệnh CLI mà một NGƯỜI chạy tay vào một DB thật.
 *
 * Mỗi tệp ở đây phải gọi CẢ HAI hàng rào trên. `tests/moi_truong.test.ts` quét
 * mã nguồn đối chiếu, cùng khuôn ba sổ đăng ký đã có (`cua_tieu.ts` ·
 * `so_vat.ts` · `kho_bac_chan_khach.test.ts`).
 *
 * ⚠ Tiêu chí vào danh sách hẹp và rõ: **lệnh có thể chạy vào prod bằng tay**.
 * Script chỉ chạy ở dev (seed, dev_db) hoặc chỉ chạy tự động (scheduler) không
 * thuộc đây — thêm bừa vào sẽ làm danh sách dài ra và mất tác dụng.
 */
export const SO_DANG_KY_LENH_THAT: ReadonlyArray<{ tep: string; viSao: string }> = [
  { tep: 'scripts/migrate.ts', viSao: 'đổi schema của một DB thật — cửa một chiều, không revert được bằng lệnh' },
  { tep: 'scripts/nap_quy_cho.ts', viSao: 'chuyển T từ Kho bạc sang quỹ chợ — append-only, không lùi được' },
  { tep: 'scripts/bootstrap_genesis.ts', viSao: 'bút toán MINT duy nhất ngoài signup (A3.4)' },
  { tep: 'scripts/audit_supply.ts', viSao: 'phán quyết CÂN/LỆCH — một chữ ✔ không nói DB nào là một chữ ✔ vô nghĩa' },
  { tep: 'scripts/audit_vat.ts', viSao: 'như trên, cho sổ vật — CÂN của một DB không nói gì về DB kia' },
  { tep: 'scripts/bat_dieu_phoi.ts', viSao: 'trao quyền tạo bàn buổi đo cho một người thật trên DB thật (D333)' },
  { tep: 'scripts/dem_nguoi.ts', viSao: 'mẫu số của mùa (A11.1) — một con số người thật không nói DB nào là con số bịa' },
];
