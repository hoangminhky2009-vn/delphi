/**
 * GATE — REGRESSION TẤT ĐỊNH của `replay()` TOÀN TRẬN, TRƯỚC W1 (M1, 03/09/2026).
 *
 * Fixture chụp từ engine HÔM NAY (`scripts/holdem_replay_golden.ts`, commit ghi
 * trong `chup_tai_commit`) — TRƯỚC khi W1 đổi cách `replay()` chạy (bỏ một
 * trong hai lần phát lại toàn log mỗi `POST /rounds`, xem D214). `replay(seed,
 * action_log, luat)` LÀ định nghĩa danh tính một trận: mọi trận đã lưu trên
 * prod chỉ là seed + log, và kết quả là bất cứ điều gì `replay` nói HÔM NAY.
 * Test này đỏ = TOÀN BỘ output của `replay()` cho ít nhất một trận đã đổi —
 * đúng loại đổi mà A11.3 xếp là cửa MỘT CHIỀU.
 *
 * ⚠⚠ SỬA CODE CHO TEST XANH, KHÔNG SỬA FIXTURE. Fixture chỉ được thay khi một
 * `balance_version` MỚI cố ý đổi hành vi VÀ có gate đo (Monte Carlo G1–G4) đi
 * kèm — và khi đó các phiên bản CŨ trong ma trận (`balance-v10b-nav` hiện tại)
 * vẫn phải khớp: nếu chúng không khớp nữa thì đó không phải "thêm phiên bản
 * mới", đó là "viết lại lịch sử của phiên bản cũ" — chính điều cổng
 * `balance_version` (`config/holdem_balance.ts`) dựng lên để chặn.
 *
 * Các bài dưới đây dùng CHUNG một ma trận với generator (`moiO`/`chayMotTran`/
 * `fnv1a` import thẳng từ `scripts/holdem_replay_golden.ts`, KHÔNG chép lại
 * vòng lặp lẫn công thức băm — hai bản độc lập cùng tả "ma trận" hoặc cùng tính
 * "hash" là chỗ D61 cắn đau nhất, xem comment tại `moiO`). Vì vậy bài "corpus
 * không teo tóp" ở dưới PHẢI đọc trực tiếp từ `moiO()` đang sống (không chỉ từ
 * fixture tĩnh) — nếu không, ai đó hạ `SO_SEED` xuống 2 trong generator vẫn lọt
 * qua được: những seed còn lại vẫn khớp fixture (chúng chưa từng đổi), lưới co
 * lại mà không một bài nào báo đỏ. "Fixture cũ vẫn khớp" không chứng minh
 * "lưới còn đủ rộng".
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { setImmediate as nhuongEventLoop } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import {
  canonStringify, chayMotTran, chayMotTranThat, fnv1a, moiO, moiTranThat,
  PHIEN_BAN_DO, SO_SEED, timKhacBietDauTien, trichXuat, type OTran,
} from '../scripts/holdem_replay_golden.js';

interface GoldenFixture {
  chup_tai_commit: string;
  ma_tran: {
    phien_ban: string[]; co_map: number[]; so_ghe: number[];
    so_seed: number; so_hanh_vi: number;
  };
  tong_tran: number;
  sweep: Record<string, string>;
  deep: {
    key: string; phien_ban: string; co_map: number; so_ghe: number;
    seed_idx: number; seed: number; hanh_vi_idx: number; vong_dat_duoc: number;
    digest: unknown;
  }[];
  /** B5 (docs/nhat-ky/D221.md) — 11 trận THẬT của founder. */
  that: {
    nguon: string; da_doi_chieu_prod: boolean; tong_tran: number;
    sweep: Record<string, string>;
    deep: { key: string; phien_ban: string; seed: number; so_o: number | null; digest: unknown }[];
  };
}

const golden = JSON.parse(
  readFileSync('tests/fixtures/holdem_replay_golden.json', 'utf8')) as GoldenFixture;

/*
 * ⚠ HẠN THỨ HAI MÀ BÀI QUÉT MA TRẬN ĐỤNG PHẢI (D461) — hạn RPC của chính vitest, không phải
 * hạn của bài. Mọi lời gọi từ worker sang tiến trình chính (`onTaskUpdate`…) có hạn 60 giây:
 * birpc `DEFAULT_TIMEOUT = 6e4` trong `node_modules/vitest/dist/chunks/index.*.js` (vitest
 * 3.2.7 không mở chỗ chỉnh). Hạn ấy đếm bằng một `setTimeout` NGAY TRONG worker, nên worker
 * bị chặn đồng bộ quá 60 giây là đủ chết: phản hồi của tiến trình chính về từ sớm nhưng nằm
 * chờ ở hàng I/O, và lúc worker nhả ra thì Node chạy pha TIMER trước pha I/O ⇒ hẹn giờ bắn
 * trước ⇒ `Error: [vitest-worker]: Timeout calling "onTaskUpdate"`, bài nào cũng xanh mà
 * tệp vẫn thoát rc=1.
 */
const HAN_RPC_VITEST_MS = 60_000;

/**
 * Chạy `f` và trả về đoạn event loop bị chặn LIỀN lâu nhất trong lúc chạy (ms). Đo bằng một
 * nhịp `setInterval` ĐỘC LẬP với chỗ nhường bên trong `f` — nên gỡ `await` hay viết lại vòng
 * lặp thành đồng bộ thì phép đo vẫn thấy: nhịp không chạy được lần nào, và đoạn CUỐI (từ nhịp
 * cuối tới lúc `f` xong) dài bằng cả bài. Đoạn cuối là chỗ DUY NHẤT bắt được ca đó.
 */
async function doChanEventLoop(f: () => Promise<void>): Promise<number> {
  let lanCuoi = performance.now();
  let lauNhat = 0;
  const nhip = setInterval(() => {
    const bayGio = performance.now();
    lauNhat = Math.max(lauNhat, bayGio - lanCuoi);
    lanCuoi = bayGio;
  }, 50);
  try {
    await f();
  } finally {
    clearInterval(nhip);
  }
  return Math.max(lauNhat, performance.now() - lanCuoi);
}

describe('golden — replay() TOÀN TRẬN không đổi (lưới trước W1)', () => {
  /*
   * ⚠ Đọc từ `moiO()`/`PHIEN_BAN_DO`/`SO_SEED` ĐANG SỐNG, không phải từ
   * `golden.ma_tran` đã lưu — xem docstring đầu tệp vì sao hai nguồn này
   * KHÔNG thể thay nhau ở đúng bài này (một cái canh generator bị teo tóp,
   * cái kia canh fixture bị sửa tay — hai lỗi khác nhau, hai bài khác nhau).
   */
  it('sổ sinh KHÔNG bị teo tóp — ≥3 balance_version, ≥100 tổ hợp, ngay trên generator sống', () => {
    expect(PHIEN_BAN_DO.length, 'PHIEN_BAN_DO').toBeGreaterThanOrEqual(3);
    expect(new Set(PHIEN_BAN_DO).size, 'PHIEN_BAN_DO phải là 3 khoá KHÁC NHAU').toBeGreaterThanOrEqual(3);
    expect(SO_SEED, 'SO_SEED').toBeGreaterThanOrEqual(20);
    const o = moiO();
    expect(o.length, 'tổng số tổ hợp moiO()').toBeGreaterThanOrEqual(100);
    expect(new Set(o.map((x) => x.phienBan)).size).toBeGreaterThanOrEqual(3);
  });

  it('fixture ĐÃ LƯU cũng không teo tóp (phòng ai sửa tay JSON)', () => {
    expect(golden.ma_tran.phien_ban.length).toBeGreaterThanOrEqual(3);
    expect(new Set(golden.ma_tran.phien_ban).size).toBeGreaterThanOrEqual(3);
    expect(Object.keys(golden.sweep).length).toBeGreaterThanOrEqual(100);
    expect(golden.tong_tran).toBe(Object.keys(golden.sweep).length);
    expect(golden.deep.length).toBeGreaterThanOrEqual(3);
    expect(golden.deep.length).toBeLessThanOrEqual(5);
  });

  /*
   * ⚠ NGÂN SÁCH GIỜ RIÊNG (D351). Bài này quét TOÀN MA TRẬN và mất ~130 giây trên máy
   * founder, trong khi trần chung của repo là 30 giây (vitest.config.ts) — tức nó ĐỎ VÌ HẾT
   * GIỜ mỗi lần chạy cả suite, bất kể hash có khớp hay không.
   *
   * Đó là kiểu hỏng tệ nhất một golden test có thể mắc: nó không nói sai, nó chỉ **luôn đỏ**,
   * và thứ luôn đỏ thì người ta thôi đọc. Bài canh cửa-một-chiều mà bị ngó lơ thì bằng không.
   * Lộ ra 19/09 khi truy bài đỏ thứ hai của suite root: chạy riêng với giờ rộng ⇒ 9/9 xanh,
   * hash khớp nguyên — chưa bao giờ là lỗi replay.
   * ⚠ Nâng giờ, KHÔNG cắt ma trận: cắt ô là cắt đúng thứ bài này tồn tại để canh.
   *
   * ⚠ VÀ NHƯỜNG EVENT LOOP SAU MỖI Ô (D461). Giờ riêng chữa được hạn của BÀI, không chữa được
   * hạn RPC 60 giây của vitest (xem `HAN_RPC_VITEST_MS`). Ma trận lớn dần theo mỗi khoá luật —
   * 03/10 là 18 balance_version × 120 = 2.160 ô — và quét liền một mạch thì chặn worker 85–180
   * giây ⇒ 9/9 xanh mà tệp vẫn thoát rc=1 vì một dòng `Errors 1 error`. Lại đúng kiểu "luôn đỏ"
   * ở trên, chỉ dời từ dòng Tests sang dòng Errors; trong lượt chạy cả bộ nó làm cả LÔ báo rc=1.
   * ⇒ `await` một nhịp `setImmediate` sau mỗi ô: đoạn đồng bộ dài nhất còn lại là MỘT ô (đo
   * 03/10: trung vị 63 ms, dài nhất 630 ms), không phải cả ma trận. Vẫn từng ô, vẫn so hash —
   * không ô nào bị cắt, không hạn nào bị nới.
   * ⚠ Bài tự đo đoạn chặn lâu nhất và ĐỎ khi chạm nửa hạn RPC: không có phép đo ấy thì lần sau ai
   * viết lại vòng lặp thành đồng bộ, lỗi sẽ quay về dưới dạng một dòng Errors khó hiểu cạnh 9/9 xanh.
   *
   * ⚠ VÀ CHIA MỘT BÀI MỖI balance_version (11/10). Ma trận tới 27 khoá × 120–160 = 3.400 ô, một bài
   * quét liền ~437 s khi máy rảnh — trần 600 s chỉ còn dư 1,4 lần, nên máy bận việc khác là hết giờ
   * (CI lô lo/20261011-1212 trên runner laptop: 311/312 tệp xanh, đỏ đúng bài này; CI còn chạy lại
   * một lần ⇒ hai lần chờ 600 s). Nay mỗi phần là MỘT khoá (~16 s), trần 600 s giữ nguyên, không
   * nới. Nhóm lấy thẳng từ `moiO()` sống: mỗi ô nằm đúng một phần, khoá mới vào `PHIEN_BAN_DO` thì
   * tự có phần mới — không có danh sách phần thứ hai để trôi (D61). Khẳng định từng ô và phép đo
   * chặn event loop giữ nguyên trong từng phần; đỏ thì tên bài nói luôn khoá nào lệch.
   */
  const oTheoPhienBan = new Map<string, OTran[]>();
  for (const o of moiO()) {
    const nhom = oTheoPhienBan.get(o.phienBan);
    if (nhom) nhom.push(o);
    else oTheoPhienBan.set(o.phienBan, [o]);
  }
  for (const [phienBan, dsO] of oTheoPhienBan) {
    it(`quét ma trận ${phienBan} (${dsO.length} ô) — hash của replay() khớp fixture, từng ô một`, async () => {
      const chanLauNhat = await doChanEventLoop(async () => {
        for (const o of dsO) {
          const { r } = chayMotTran(o.coMap, o.soGhe, o.seed, o.phienBan, o.hanhViIdx);
          const hash = fnv1a(canonStringify(trichXuat(r)));
          expect(hash,
            `map=${o.coMap} ghế=${o.soGhe} seed=${o.seed} (seedIdx=${o.seedIdx}) phiên_bản=${o.phienBan}`)
            .toBe(golden.sweep[o.key]);
          await nhuongEventLoop();
        }
      });
      expect(chanLauNhat,
        `event loop bị chặn liền ${Math.round(chanLauNhat)} ms — chạm nửa hạn RPC của vitest `
        + `(${HAN_RPC_VITEST_MS} ms); vòng quét phải nhường event loop sau mỗi ô (D461)`)
        .toBeLessThan(HAN_RPC_VITEST_MS / 2);
    }, 600_000);
  }

  it('DEEP snapshot khớp từng trường — mismatch in ra field path đầu tiên lệch', () => {
    for (const d of golden.deep) {
      const { r } = chayMotTran(d.co_map, d.so_ghe, d.seed, d.phien_ban, d.hanh_vi_idx);
      // JSON round-trip vế MỚI để so cùng "kiểu" với vế fixture (đã qua JSON
      // lúc lưu) — tránh lệch giả do undefined/NaN/Infinity chỉ biến mất ở
      // MỘT bên nếu so trực tiếp object sống với object đã qua JSON.parse.
      const moi = JSON.parse(canonStringify(trichXuat(r))) as unknown;
      const duong = timKhacBietDauTien(moi, d.digest);
      expect(duong,
        `map=${d.co_map} ghế=${d.so_ghe} seed=${d.seed} phiên_bản=${d.phien_ban} `
        + `— field lệch đầu tiên: ${duong}`)
        .toBeNull();
    }
  });
});

/**
 * B5 (03/09/2026, docs/nhat-ky/D221.md) — TRẬN THẬT của founder trên prod, nạp
 * cạnh corpus synthetic ở trên. Xem docstring "TRẬN THẬT" trong
 * `scripts/holdem_replay_golden.ts` vì sao cần khối này: synthetic tự khai
 * KHÔNG dựng được `lenh`/`khop_truoc`/`gan`/`ky_ngo`/`tu_dong`/`mo_bang`/
 * `du_bao`/chuỗi `cuoc`/`dau_hang` — 11 trận thật có đủ, vì người thật đã bấm.
 */
describe('golden — TRẬN THẬT không đổi (B5, 11 trận của founder trên prod)', () => {
  /*
   * ⚠ Đọc từ `moiTranThat()` ĐANG SỐNG, không phải từ `golden.that` đã lưu —
   * cùng lý do khối synthetic ở trên đọc `moiO()` sống, không phải
   * `golden.ma_tran`: nếu ai đó xoá bớt trận khỏi `holdem_tran_that.json`, các
   * trận CÒN LẠI vẫn khớp fixture (chúng chưa từng đổi), và một bài chỉ so
   * hash-với-fixture sẽ không báo gì — corpus co lại trong im lặng, đúng cách
   * D215 từng co hẹp mà không ai biết cho tới khi founder hỏi B5.
   */
  it('sổ trận THẬT KHÔNG bị teo tóp — ≥11 trận, ≥10 balance_version khác nhau, ngay trên loader sống', () => {
    const tran = moiTranThat();
    expect(tran.length, 'số trận thật').toBeGreaterThanOrEqual(11);
    expect(new Set(tran.map((t) => t.phienBan)).size, 'số balance_version khác nhau')
      .toBeGreaterThanOrEqual(10);
  });

  it('fixture ĐÃ LƯU cũng không teo tóp (phòng ai sửa tay JSON)', () => {
    expect(golden.that, 'fixture golden thiếu khối `that` — chạy lại generator').toBeDefined();
    expect(golden.that.tong_tran).toBeGreaterThanOrEqual(11);
    expect(Object.keys(golden.that.sweep).length).toBeGreaterThanOrEqual(11);
    expect(golden.that.deep.length).toBeGreaterThanOrEqual(1);
    expect(golden.that.deep.length).toBeLessThanOrEqual(2);
  });

  it('quét toàn bộ trận THẬT — hash của replay() khớp fixture, từng trận một', () => {
    for (const t of moiTranThat()) {
      const r = chayMotTranThat(t);
      const hash = fnv1a(canonStringify(trichXuat(r)));
      expect(hash, `phiên_bản=${t.phienBan} seed=${t.seed}`).toBe(golden.that.sweep[t.key]);
    }
  });

  it('DEEP snapshot (TRẬN THẬT) khớp từng trường — mismatch in ra field path đầu tiên lệch', () => {
    const dsTranThat = moiTranThat();
    for (const d of golden.that.deep) {
      const t = dsTranThat.find((x) => x.key === d.key);
      expect(t, `${d.key} biến mất khỏi holdem_tran_that.json`).toBeDefined();
      const r = chayMotTranThat(t!);
      const moi = JSON.parse(canonStringify(trichXuat(r))) as unknown;
      const duong = timKhacBietDauTien(moi, d.digest);
      expect(duong,
        `phiên_bản=${d.phien_ban} seed=${d.seed} — field lệch đầu tiên: ${duong}`)
        .toBeNull();
    }
  });

  /*
   * ⚠ Đây là bài "vì sao B5 tồn tại". Chín hình dạng dưới đây là đúng những
   * thứ synthetic (describe ở trên) khai KHÔNG dựng được. Nếu bài này đỏ, nó
   * không chỉ báo "thiếu dữ liệu" — nó nêu ĐÚNG hình dạng nào vừa mất, để ai
   * đó dọn fixture theo bản năng "corpus nhỏ chạy nhanh hơn" biết ngay mình
   * vừa xoá mất chính lý do B5 được thêm vào (task gốc: "nếu ai đó trim fixture
   * xuống 'chỉ vài trận', bài này phải đỏ và gọi tên thứ bị mất").
   */
  it('corpus THẬT phủ đủ hình dạng mà B5 thêm nó để phủ '
    + '(lenh/khop_truoc/gan/ky_ngo/tu_dong/mo_bang/du_bao/cuoc/dau_hang)', () => {
    const co = new Set<string>();
    for (const t of moiTranThat()) {
      for (const l of t.log) {
        if (Array.isArray(l.lenh) && l.lenh.length > 0) co.add('lenh');
        if (Array.isArray(l.khop_truoc) && l.khop_truoc.length > 0) co.add('khop_truoc');
        if (l.gan && Object.keys(l.gan).length > 0) co.add('gan');
        if (typeof l.ky_ngo === 'string' && l.ky_ngo.length > 0) co.add('ky_ngo');
        if (l.tu_dong === true) co.add('tu_dong');
        if (typeof l.mo_bang === 'number' && l.mo_bang > 0) co.add('mo_bang');
        if (l.du_bao === true) co.add('du_bao');
        if (Array.isArray(l.cuoc) && l.cuoc.length > 0) co.add('cuoc');
        if (l.hanh_dong === 'dau_hang') co.add('dau_hang');
      }
    }
    const canCo = [
      'lenh', 'khop_truoc', 'gan', 'ky_ngo', 'tu_dong', 'mo_bang', 'du_bao', 'cuoc', 'dau_hang',
    ];
    const thieu = canCo.filter((x) => !co.has(x));
    expect(thieu,
      `mất coverage: ${thieu.join(', ')} — đây là toàn bộ lý do B5 thêm 11 trận thật `
      + '(docs/nhat-ky/D221.md)')
      .toEqual([]);
  });
});
