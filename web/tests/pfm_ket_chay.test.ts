/**
 * PFM — DRIVER KÉT (`ket_chay.ts`, GĐ1): mảnh cuối khép vòng sao lưu/khôi phục.
 *
 * ⚠⚠ KHÔNG STUB `luuKet`/`docKet`. Bài ở đây dựng một MÁY CHỦ GIẢ ở tầng `fetch`, nói
 * đúng giao ước thật của `/pfm/luu`: `ver` server cấp · 409 `ver_cu` · 409
 * `thang_khong_song` (K10) · 429 khi hết suất · `X-Pfm-Ver` trên đường đọc. Lý do là
 * R8: hai đầu dây mỗi bên tự nhất quán mà không nối được thì mọi bài test một-bên đều
 * xanh. Stub `luuKet` là dựng lại đúng cái khoảng cách ấy ở một tầng cao hơn.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  META_VAO_KET, META_O_LAI_MAY, ID_SO_KET, metaVaoKet, gomRuot, latBan, docSoKet,
  saoLuuMotLuot, khoiPhucTuKet, latDeKhoiPhuc, soThangLui,
} from '../src/pfm/ket_chay.js';
import { ID_KHOA_KET, catChia, docChia, raByte } from '../src/pfm/ket_may.js';
import { ID_DEM_DONG_BO, ghiNhanGui } from '../src/pfm/dong_bo.js';
import { ID_HO_SO, docHoSo, ghiHoSo } from '../src/pfm/ho_so.js';
import { ID_CAI_DAT_MAY } from '../src/pfm/cai_dat_may.js';
import { KhoTrongBoNho, type BanGhi } from '../src/pfm/kho.js';
import { LAT_SONG, LAT_SONG_THANG, dongLat, moLat, thangGuiLen } from '../src/pfm/ket.js';
import { PFM } from '@config/pfm';

vi.mock('../src/lib/telemetry.js', () => ({
  ghiDo: vi.fn(),
  manCuaDuong: () => '/tai-chinh',
}));
const { ghiDo } = await import('../src/lib/telemetry.js');

const LUC = '2026-09-05T10:00:00.000Z';
const NGAY = '2026-09-05';
const SONG = '2026-09';

async function chiaGia(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false,
    ['encrypt', 'decrypt']);
}

/** Kho có sẵn chìa + một hũ (lát `song`) + một khoản (lát tháng). */
async function khoDayDu(): Promise<{ kho: KhoTrongBoNho; khoa: CryptoKey }> {
  const kho = new KhoTrongBoNho();
  const khoa = await chiaGia();
  await catChia(kho, khoa, LUC);
  await kho.ghi('hu', { id: 'h1', thang: SONG, suaLuc: LUC, d: { ten: 'Quỹ dự phòng' } });
  await kho.ghi('khoan', { id: 'k1', thang: SONG, suaLuc: LUC, d: { soTien: 35000 } });
  return { kho, khoa };
}

/* ═══ MÁY CHỦ GIẢ — nói đúng giao ước `/pfm/luu` ═══════════════════════════ */

class MayChuGia {
  lat = new Map<string, { blob: Uint8Array; ver: number; schemaV: number }>();
  thangSong = thangGuiLen(SONG);
  suat: number = PFM.SO_LAN_LUU_NGAY;
  ghiNhan: { thang: string; ver: number; byte: number }[] = [];
  /** ⚠ Đếm LƯỢT GÕ CỬA, khác `ghiNhan` (chỉ ghi lượt THÀNH CÔNG) — xem bài 429 ở §VI-ter. */
  soLanGoi = 0;
  mat = false;

  gan(): void {
    vi.stubGlobal('fetch', async (u: string, init?: RequestInit) => {
      this.soLanGoi++;
      if (this.mat) throw new TypeError('Failed to fetch');
      const url = new URL(u, 'http://may-chu-gia');
      const thang = url.searchParams.get('thang')!;
      return (init?.method === 'POST' ? this.ghi(thang, url, init) : this.doc(thang));
    });
  }

  private ghi(thang: string, url: URL, init: RequestInit): Response {
    const ver = Number(url.searchParams.get('ver'));
    // ⚠ Đúng THỨ TỰ của server (R3): soi `thang`/`ver` TRƯỚC khi tiêu suất — không thì
    //   hai cú chắc chắn 409 đốt sạch suất của cả ngày.
    if (thang !== LAT_SONG_THANG && thang !== this.thangSong) {
      return json({ error: 'thang_khong_song', ver: 0 }, 409);
    }
    const co = this.lat.get(thang);
    if (ver !== (co?.ver ?? 0)) return json({ error: 'ver_cu', ver: co?.ver ?? 0 }, 409);
    if (this.suat <= 0) return json({ error: 'rate_limited', message: 'nhiều quá' }, 429);
    this.suat--;
    const blob = new Uint8Array(init.body as ArrayBuffer);
    const moi = (co?.ver ?? 0) + 1;
    const schemaV = Number(url.searchParams.get('schema_v'));
    this.lat.set(thang, { blob, ver: moi, schemaV });
    this.ghiNhan.push({ thang, ver, byte: blob.length });
    return json({ ok: true, ver: moi }, 200);
  }

  private doc(thang: string): Response {
    const co = this.lat.get(thang);
    if (!co) return json({ error: 'khong_thay' }, 404);
    return new Response(co.blob as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Pfm-Ver': String(co.ver),
        'X-Pfm-Schema-V': String(co.schemaV),
      },
    });
  }
}

function json(o: unknown, status: number): Response {
  return new Response(JSON.stringify(o), {
    status, headers: { 'content-type': 'application/json' },
  });
}

let may: MayChuGia;
beforeEach(() => { may = new MayChuGia(); may.gan(); vi.mocked(ghiDo).mockClear(); });
afterEach(() => { vi.unstubAllGlobals(); });

/* ═══ §I — NGĂN `meta` KHÔNG ĐI CẢ NẮM VÀO KÉT ════════════════════════════ */

describe("§I — ⭐⭐⭐ ngăn `meta` phải được PHÂN LOẠI, không đi cả nắm", () => {
  it('⭐⭐⭐ MỌI id `meta` của repo đều được phân loại — quên một cái là bài này đỏ', () => {
    /*
     * ⚠⚠ Đây là bài canh thật sự của cả §I. `KIEU_LAT.meta = 'song'` nên `gomLat` vốc
     * cả ngăn `meta` vào lát; hôm nay cả ba id trong đó đều là đồ của MÁY NÀY, và một
     * trong ba (`khoa_ket`) mà lọt vào két thì cú khôi phục sẽ ghi `{}` đè lên chìa
     * thật — tự tay phá cái chìa vừa dùng để khôi phục.
     * ⇒ Thêm một id `meta` mới mà không nói nó thuộc bên nào thì phải ĐỎ, không phải
     *   im lặng rơi vào mặc định. Cùng khuôn với `BANG_PHU_DU` của `backup.ts`.
     */
    /*
     * ⚠ Quét TOÀN `web/src`, không chỉ `src/pfm/` (D295): id `cai_dat_may` được ghi từ
     * `components/pfm/CaiDatPfm.tsx` — bản quét một thư mục đã để nó lọt qua mà vẫn xanh.
     * Một danh sách cho phép chỉ canh được khi bài quét nhìn thấy MỌI người gọi `kho.ghi`.
     */
    const goc = join(__dirname, '..', 'src');
    const tepNguon: string[] = [];
    const duyet = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const duong = join(d, e.name);
        if (e.isDirectory()) duyet(duong);
        else if (/\.tsx?$/.test(e.name)) tepNguon.push(duong);
      }
    };
    duyet(goc);
    const id = new Set<string>();
    for (const t of tepNguon) {
      const nguon = readFileSync(t, 'utf8');
      // `kho.ghi('meta', { id: X` với X là chuỗi hằng hoặc một hằng ID_*.
      for (const m of nguon.matchAll(/'meta',\s*\{\s*id:\s*(?:'([^']+)'|(ID_[A-Z_]+))/g)) {
        id.add(m[1] ?? m[2]!);
      }
    }
    expect(id.size, 'không quét ra id nào ⇒ biểu thức đã lạc, không phải repo sạch')
      .toBeGreaterThanOrEqual(4);

    /*
     * ⚠ Quét ra HAI dạng: chuỗi hằng (`'dong_bo_dem'`) và TÊN hằng (`ID_SO_KET`). Quy
     * tên về giá trị bằng chính hằng đã import — đừng chép danh sách tên vào đây, vì một
     * hằng bị trỏ sang giá trị khác thì bản chép tay vẫn "khớp" và bài mất tác dụng.
     * Quên thêm hằng mới vào bảng này thì tên thô không tra được ⇒ vẫn ĐỎ (hỏng đóng).
     */
    const HANG: Record<string, string> = {
      ID_KHOA_KET, ID_DEM_DONG_BO, ID_SO_KET, ID_HO_SO, ID_CAI_DAT_MAY,
    };
    const daBiet = new Set([...META_VAO_KET, ...META_O_LAI_MAY]);
    expect([...id].filter((x) => !daBiet.has(HANG[x] ?? x)),
      'id `meta` chưa phân loại: thêm vào META_VAO_KET hoặc META_O_LAI_MAY').toEqual([]);
  });

  it('bốn id đang có đều nằm ở phía "ở lại máy"', () => {
    for (const x of [ID_KHOA_KET, ID_DEM_DONG_BO, ID_SO_KET, ID_CAI_DAT_MAY]) {
      expect(META_O_LAI_MAY, x).toContain(x);
      expect(metaVaoKet(x), x).toBe(false);
    }
  });

  it('⭐⭐⭐ chìa KHÔNG lọt vào ruột lát `song` — và nếu lọt thì nó là `{}`', async () => {
    /*
     * Vế sau của tên bài là thứ làm ca này chết người: `JSON.stringify(CryptoKey)` là
     * `{}` (đo được), nên nếu lọt, nó KHÔNG hỏng lúc ghi — nó hỏng lúc khôi phục, im
     * lặng, đúng vào ngày người dùng vừa mất máy.
     */
    const { kho } = await khoDayDu();
    await ghiNhanGui(kho, NGAY, 'ket', LUC);          // để `dong_bo_dem` cũng có mặt
    const ruot = await gomRuot(kho, LAT_SONG);

    expect(ruot.meta, 'không đồ-của-máy nào lọt vào').toEqual([]);
    expect(JSON.stringify(ruot)).not.toContain(ID_KHOA_KET);
    expect(JSON.stringify(ruot)).not.toContain(ID_DEM_DONG_BO);
    expect(ruot.hu, 'hũ thì PHẢI vào — lọc là lọc `meta`, không phải lọc cả lát')
      .toHaveLength(1);
  });

  it('⭐⭐⭐ và PHÍA CÒN LẠI: hồ sơ hoàn cảnh PHẢI đi được sang máy mới', async () => {
    /*
     * ⚠⚠ BÀI NÀY BÙ ĐÚNG CHỖ MÙ CỦA BÀI PHÂN LOẠI Ở TRÊN. Bài kia chỉ hỏi *"id này đã
     * được xếp vào một trong hai danh sách chưa"* — nên xếp NHẦM BÊN thì nó vẫn xanh.
     * Tiêm lỗi đã chứng minh: dời `ho_so` sang `META_O_LAI_MAY` ⇒ **0/53 bài đỏ**.
     * Mà hậu quả của cú xếp nhầm ấy có thật và im lặng: hồ sơ không vào két ⇒ máy mới
     * mất ba câu tự khai ⇒ mọi gói đặc trưng từ máy đó thiếu `ctx_*`, tức mọi so sánh
     * cohort của người ấy hỏng, mà không có gì báo.
     * ⇒ Một danh sách CHO PHÉP cần hai bài: một canh "đã phân loại chưa", một canh
     *   "phân loại có ĐÚNG không". Bài thứ hai phải đi qua đường THẬT (lưu → khôi phục).
     */
    const { kho, khoa } = await khoDayDu();
    await ghiHoSo(kho, { tuLap: 'ban_tu_lap', khung: 'kakeibo' }, LUC);

    const luu = await saoLuuMotLuot(kho, NGAY, '2026-09-05T10:00:01.000Z', SONG);
    expect(luu.daLuu).toContain(LAT_SONG);

    const moi = new KhoTrongBoNho();                   // máy mới, kho trống
    await khoiPhucTuKet(moi, khoa, [LAT_SONG], LUC);
    expect(await docHoSo(moi), 'ba câu tự khai phải sống sót qua máy mới')
      .toEqual({ tuLap: 'ban_tu_lap', khung: 'kakeibo' });
  });

  it('⭐⭐ lọc CẢ CHIỀU ĐỌC: một lát chở `khoa_ket` không phá được chìa của máy này',
    async () => {
      /*
       * Lọc lúc ghi giữ cho KÉT sạch; lọc lúc đọc giữ cho MÁY NÀY sống. Không thừa: một
       * lát ghi bởi bản app cũ (trước bản vá này) vẫn nằm trên server và vẫn đọc được.
       */
      const { kho, khoa } = await khoDayDu();
      const banDoc: BanGhi<unknown>[] = [
        { id: ID_KHOA_KET, thang: SONG, suaLuc: '2099-01-01T00:00:00.000Z', d: {} },
      ];
      const lat = await dongLat(LAT_SONG, { meta: banDoc, hu: [] }, khoa);
      may.lat.set(LAT_SONG_THANG, { blob: raByte(lat), ver: 3, schemaV: 2 });

      const kq = await khoiPhucTuKet(kho, khoa, [LAT_SONG], LUC);
      expect(kq.lat).toEqual([LAT_SONG]);
      expect(kq.them + kq.thay, 'bản ghi độc phải bị bỏ, không được trộn vào').toBe(0);
      const van = await docChia(kho);
      expect(van, 'chìa vẫn là CryptoKey thật, không phải `{}`').toBeInstanceOf(CryptoKey);
      expect(await moLat(lat, van!), 'và nó vẫn mở được két').toBeTruthy();
    });
});

/* ═══ §II — VÒNG ĐẦY ĐỦ: LƯU RỒI KHÔI PHỤC TRÊN MÁY MỚI ═══════════════════ */

describe('§II — ⭐⭐⭐ sao lưu rồi khôi phục trên MÁY MỚI', () => {
  it('hai lát đi lên, và máy mới (kho trống) dựng lại được cả hũ lẫn khoản', async () => {
    const { kho, khoa } = await khoDayDu();

    const luu = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(luu.vuong).toBeUndefined();
    expect(luu.daLuu, 'tháng đang sống đi TRƯỚC lát `song`').toEqual([SONG, LAT_SONG]);
    expect(may.lat.size).toBe(2);

    const moi = new KhoTrongBoNho();                   // máy mới, chưa có gì
    const kq = await khoiPhucTuKet(moi, khoa, [LAT_SONG, SONG], LUC);
    expect(kq.vuong).toBeUndefined();
    expect(kq.them).toBe(2);                           // 1 hũ + 1 khoản
    expect((await moi.doc('hu', 'h1'))?.d).toEqual({ ten: 'Quỹ dự phòng' });
    expect((await moi.doc('khoan', 'k1'))?.d).toEqual({ soTien: 35000 });
  });

  it('⭐⭐ nhặt `ver` lúc khôi phục ⇒ cú lưu ĐẦU TIÊN sau đó đi thẳng, không 409', async () => {
    const { kho, khoa } = await khoDayDu();
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);         // server: cả hai lát ver = 1

    const moi = new KhoTrongBoNho();
    await catChia(moi, khoa, LUC);
    await khoiPhucTuKet(moi, khoa, [LAT_SONG, SONG], LUC);
    expect((await docSoKet(moi)).ver[SONG], 'ver server nói ra ở X-Pfm-Ver').toBe(1);

    may.suat = PFM.SO_LAN_LUU_NGAY;                    // sang ngày mới
    await moi.ghi('khoan', { id: 'k2', thang: SONG, suaLuc: '2026-09-06T01:00:00.000Z', d: {} });
    const lai = await saoLuuMotLuot(moi, '2026-09-06', '2026-09-06T01:00:00.000Z', SONG);
    expect(lai.vuong, 'không 409 — máy đã biết mình cầm bản nào').toBeUndefined();
    expect(lai.daLuu).toContain(SONG);
  });

  it('⭐ bia mộ đi theo két — cú xoá LAN được sang máy mới', async () => {
    /*
     * `gomLat` lấy cả bia mộ, và đó là chỗ DUY NHẤT cần chúng. Không mang đi thì bản ghi
     * user đã xoá sẽ "sống lại" trên máy khác.
     */
    const { kho, khoa } = await khoDayDu();
    await kho.xoa('hu', 'h1', '2026-09-05T11:00:00.000Z');
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);

    const moi = new KhoTrongBoNho();
    await moi.ghi('hu', { id: 'h1', thang: SONG, suaLuc: LUC, d: { ten: 'bản cũ' } });
    await khoiPhucTuKet(moi, khoa, [LAT_SONG], LUC);
    expect(await moi.doc('hu', 'h1'), 'bia mộ mới hơn ⇒ thắng').toBeNull();
  });

  it('⭐⭐ trộn CÓ ĐỔI ⇒ xoá mốc đã-lưu, để phần chênh còn đường đẩy lên', async () => {
    /*
     * ⚠⚠ MÁY ĐÍCH PHẢI ĐÃ TỪNG SAO LƯU, không thì bài này rỗng — bản đầu tôi khôi phục
     * lên một kho trắng, mà kho trắng thì `luuToi` vốn đã trống nên `delete` là lệnh
     * không làm gì: xoá hẳn dòng `delete` đi bài vẫn xanh.
     * Ca thật cần canh: máy B đã sao lưu tới 10:00; khôi phục két của máy A vào, trong
     * đó có một cái hũ mốc 08:00 (CŨ hơn). `hoaGiai` thêm hũ ấy vào B — nhưng mốc mới
     * nhất của lát `song` trên B vẫn là 10:00, nên không xoá `luuToi` thì lát trông như
     * sạch và **cái hũ vừa khôi phục không bao giờ được đẩy lên**; cú sao lưu sau của B
     * còn ghi đè lên dòng `pfm_luu` chung mà không có nó. Hũ biến mất khỏi két.
     */
    // MÁY B: có hũ riêng `hb` mốc 10:00, đã sao lưu xong ⇒ có mốc đã-lưu = 10:00.
    const b = new KhoTrongBoNho();
    const khoa = await chiaGia();
    await catChia(b, khoa, LUC);
    await b.ghi('hu', { id: 'hb', thang: SONG, suaLuc: '2026-09-05T10:00:00.000Z', d: {} });
    await saoLuuMotLuot(b, NGAY, '2026-09-05T10:00:01.000Z', SONG);
    expect((await docSoKet(b)).luuToi[LAT_SONG], 'B đã có mốc đã-lưu')
      .toBe('2026-09-05T10:00:00.000Z');

    // KÉT chở thêm `h9` mốc 08:00 — CŨ HƠN mốc đã-lưu của B. Đây là mấu chốt.
    const cu = await dongLat(LAT_SONG, {
      hu: [{ id: 'h9', thang: SONG, suaLuc: '2026-09-01T08:00:00.000Z', d: { ten: 'cũ' } }],
    }, khoa);
    may.lat.set(LAT_SONG_THANG, { blob: raByte(cu), ver: 9, schemaV: 2 });

    await khoiPhucTuKet(b, khoa, [LAT_SONG], LUC);
    expect(await b.doc('hu', 'h9'), 'h9 đã được trộn vào B').not.toBeNull();
    expect((await latBan(b, await docSoKet(b))).map((x) => x.lat),
      'và lát phải bẩn lại để h9 có đường lên két').toContain(LAT_SONG);
  });

  it('⭐⭐ trộn KHÔNG đổi gì (12 tháng đã đóng) ⇒ KHÔNG làm chúng bẩn vĩnh viễn', async () => {
    /*
     * Xoá mốc vô điều kiện là làm mọi lát vừa đọc thành bẩn mãi mãi — kể cả tháng đã
     * đóng mà K10 không bao giờ cho ghi lại. Lúc đó mỗi lần mở app là chúng được đếm
     * lại, và con số R5 đo thành "số lượt × số lát" thay vì "số tháng muốn ghi vào".
     */
    const { kho, khoa } = await khoDayDu();
    await saoLuuMotLuot(kho, NGAY, '2026-09-05T10:00:01.000Z', SONG);

    // Khôi phục lên CHÍNH máy đó: nội dung y hệt ⇒ hoà giải không thêm/thay gì.
    const truoc = (await docSoKet(kho)).luuToi[SONG];
    const kq = await khoiPhucTuKet(kho, khoa, [SONG], LUC);
    expect(kq.them + kq.thay).toBe(0);
    expect((await docSoKet(kho)).luuToi[SONG], 'mốc phải còn nguyên').toBe(truoc);
  });
});

/* ═══ §III — VÒNG LẶP TỰ THAM CHIẾU ═══════════════════════════════════════ */

describe('§III — ⭐⭐⭐ lưu hai lần liền không sinh vòng lặp', () => {
  it('không đổi gì ⇒ lượt hai KHÔNG gửi gì', async () => {
    /*
     * ⚠⚠ ĐÂY LÀ BÀI BẮT VÒNG LẶP TỰ THAM CHIẾU, và nó bắt được nhờ đúng một quyết định:
     * `ket_so` (sổ ver) nằm ở `meta` và `meta` thuộc lát `song`. Nếu `meta` đi cả nắm
     * vào két thì: lưu xong ⇒ ghi sổ ⇒ `song` bẩn lại ⇒ lưu lại ⇒ mãi mãi, đốt sạch
     * suất mỗi ngày mà không ai thấy vì mỗi cú lưu đều "thành công".
     * ⇒ Bài này xanh CHỈ KHI sổ nằm ngoài két. Nó là bài khoá của cả §I.
     */
    /*
     * ⚠⚠ `luc` PHẢI MUỘN HƠN MỌI BẢN GHI, và đó là điều bản đầu của bài này làm sai:
     * nó dùng cùng một hằng `LUC` cho cả bản ghi lẫn `luc`, nên `ket_so` ghi ra có mốc
     * ĐÚNG BẰNG mốc đã lưu ⇒ `LUC > LUC` sai ⇒ bài xanh **kể cả khi bỏ cả ba id vào
     * `META_VAO_KET`**. Nó không canh gì cả.
     * ⇒ Ngoài đời `luc` luôn muộn hơn (nó được lấy SAU khi người dùng gõ), nên chỉ cần
     *   một giây là vòng lặp hiện ra. Bài này giờ mới đúng là bài khoá của §I.
     */
    const { kho } = await khoDayDu();                  // bản ghi mốc 10:00:00
    const mot = await saoLuuMotLuot(kho, NGAY, '2026-09-05T10:00:01.000Z', SONG);
    expect(mot.daLuu).toHaveLength(2);

    may.suat = PFM.SO_LAN_LUU_NGAY;                    // suất không phải thứ đang đo
    const hai = await saoLuuMotLuot(kho, '2026-09-06', '2026-09-06T01:00:00.000Z', SONG);
    expect(hai.vuong).toBe('khong_co_gi_moi');
    expect(hai.daLuu).toEqual([]);
    expect(may.ghiNhan, 'server không nhận thêm cú nào').toHaveLength(2);
  });

  it('⭐ rèn chìa xong KHÔNG làm lát `song` bẩn', async () => {
    // `khoa_ket` là bản ghi `meta` mới nhất sau lễ tạo mã. Nếu `latBan` đếm nó thì lát
    // `song` bẩn vĩnh viễn: cú lưu gửi đi một lát KHÔNG chứa nó, nên mốc không đuổi kịp.
    const { kho } = await khoDayDu();
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    await catChia(kho, await chiaGia(), '2026-09-07T00:00:00.000Z');
    expect(await latBan(kho, await docSoKet(kho))).toEqual([]);
  });
});

/* ═══ §IV — K10: THÁNG ĐÃ ĐÓNG ════════════════════════════════════════════ */

describe('§IV — ⭐⭐ tháng đã đóng: bỏ tại chỗ, ĐẾM, và không tiêu suất', () => {
  it('lát tháng trước bị bỏ + phát `pfm_ket_thang_dong{lui}`, tháng sống vẫn lưu được',
    async () => {
      /*
       * ⚠ Cốt lõi: trần chỉ 2 lần/ngày. Gửi một lát mà K10 chắc chắn từ chối là đốt một
       * suất cho một câu trả lời đã biết trước — và lát tháng đang sống (chở khoản chi
       * vừa gõ) là thứ trả giá.
       */
      const { kho } = await khoDayDu();
      await kho.ghi('khoan', { id: 'cu', thang: '2026-07', suaLuc: LUC, d: {} });
      await kho.ghi('khoan', { id: 'cu2', thang: '2026-08', suaLuc: LUC, d: {} });

      const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
      expect(kq.thangDong).toBe(2);
      expect(kq.daLuu, 'hai lát ghi được vẫn đi trọn').toEqual([SONG, LAT_SONG]);
      expect(may.ghiNhan.map((g) => g.thang), 'KHÔNG gửi tháng đã đóng lên')
        .toEqual([thangGuiLen(SONG), LAT_SONG_THANG]);

      const lui = vi.mocked(ghiDo).mock.calls
        .filter((c) => c[0] === 'pfm_ket_thang_dong')
        .map((c) => (c[1] as { chi_tiet: { lui: number } }).chi_tiet.lui);
      expect(lui.sort()).toEqual([1, 2]);   // 2026-08 lùi 1 · 2026-07 lùi 2
    });

  it('soThangLui vắt qua mốc năm', () => {
    expect(soThangLui('2025-12', '2026-01')).toBe(1);
    expect(soThangLui('2025-01', '2026-01')).toBe(12);
  });

  it('server nói `thang_khong_song` (máy đoán sai) ⇒ vẫn đếm', async () => {
    // Máy lệch múi giờ quanh mốc sang tháng. Không đếm ca này thì con số R5 chỉ đếm
    // được những lần máy tự đoán ra, tức đếm thiếu đúng phần khó thấy nhất.
    const { kho } = await khoDayDu();
    may.thangSong = '2026-10-01';
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.thangDong).toBe(1);
    expect(vi.mocked(ghiDo).mock.calls.some((c) => c[0] === 'pfm_ket_thang_dong')).toBe(true);
  });
});

/* ═══ §V — ĐƯỜNG HỎNG: KHÔNG BAO GIỜ NÉM, KHÔNG BAO GIỜ NÓI DỐI SỔ ═══════ */

describe('§V — đường hỏng', () => {
  it('chưa có chìa ⇒ `chua_co_chia`, không gọi mạng', async () => {
    const kho = new KhoTrongBoNho();
    await kho.ghi('hu', { id: 'h1', thang: SONG, suaLuc: LUC, d: {} });
    expect((await saoLuuMotLuot(kho, NGAY, LUC, SONG)).vuong).toBe('chua_co_chia');
    expect(may.ghiNhan).toHaveLength(0);
  });

  it('⭐⭐⭐ MẤT MẠNG ⇒ sổ KHÔNG đánh dấu đã lưu, lượt sau gửi lại', async () => {
    /*
     * Đây là "bỏ món khỏi hàng đợi chỉ khi server đã trả lời" của phía két: đánh dấu
     * `luuToi` cho một lát chưa tới nơi là mất lát ấy vĩnh viễn — nó sẽ không bao giờ
     * bẩn lại, nên không bao giờ được gửi lần nữa.
     */
    const { kho } = await khoDayDu();
    may.mat = true;
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.vuong).toBe('chua_toi_may_chu');
    expect(kq.daLuu).toEqual([]);

    may.mat = false;
    const lai = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(lai.daLuu, 'vẫn còn nguyên để gửi lại').toEqual([SONG, LAT_SONG]);
  });

  it('⭐⭐ 409 `ver_cu` ⇒ nhớ `ver` THẬT, lượt sau đi thẳng', async () => {
    const { kho, khoa } = await khoDayDu();
    // Máy khác đã ghi lát này rồi: server đang ở ver 4, máy này tưởng 0.
    may.lat.set(thangGuiLen(SONG),
      { blob: raByte(await dongLat(SONG, {}, khoa)), ver: 4, schemaV: 2 });

    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    /*
     * ⚠ `vuong` là `ver_lech` CHỈ KHI cả lượt không lưu nổi gì. Ở đây lát `song` vẫn
     * đi được (409 là phán quyết về RIÊNG lát tháng), nên lượt này có thành quả thật.
     */
    expect(kq.daLuu).toEqual([LAT_SONG]);
    expect((await docSoKet(kho)).ver[SONG], 'ver thật đã vào sổ').toBe(4);

    may.suat = PFM.SO_LAN_LUU_NGAY;
    const lai = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(lai.daLuu, 'lượt sau khớp ver ⇒ ghi được').toContain(SONG);
  });

  it('hết suất NGÀY ở phía máy ⇒ dừng trước khi gửi lát thứ hai', async () => {
    const { kho } = await khoDayDu();
    // Đốt trước suất, chừa đúng một lượt.
    for (let i = 0; i < PFM.SO_LAN_LUU_NGAY - 1; i++) await ghiNhanGui(kho, NGAY, 'ket', LUC);
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.daLuu, 'ưu tiên tháng đang sống — khoản chi vừa gõ không dựng lại được')
      .toEqual([SONG]);
    expect(kq.vuong).toBe('het_suat_ngay');
    expect(kq.conBan).toBe(1);
  });

  it('⭐⭐ mốc `luuToi` là mốc của THỨ ĐÃ GỬI, không phải giờ chạy — đồng hồ lùi vẫn đúng',
    async () => {
      /*
       * ⚠⚠ HAI MỐC NÀY TRÙNG NHAU KHI ĐỒNG HỒ CHẠY TỚI, nên bài đầu tôi viết cho ca này
       * **không phân biệt được gì** (tiêm lỗi: 0/23 đỏ). Chỗ chúng tách nhau là chỗ đồng
       * hồ máy LÙI — điện thoại đồng bộ NTP và nhảy về sau vài phút, đúng lúc người dùng
       * đang gõ. Ca ấy có thật và nó là ca duy nhất đáng canh:
       *   · mốc = thứ ĐÃ GỬI (10:00) ⇒ khoản 10:10 mới hơn ⇒ còn được sao lưu. ✔
       *   · mốc = GIỜ CHẠY (10:30) ⇒ khoản 10:10 trông như cũ ⇒ **mất vĩnh viễn**, im
       *     lặng, vì lát ấy sẽ không bao giờ bẩn lại.
       * ⇒ Đánh dấu bằng thứ mình đã gửi thì không phải giả định gì về đồng hồ cả — mà
       *   chính tệp này đã khai đồng hồ là thứ không nên tựa vào.
       */
      const { kho } = await khoDayDu();          // bản ghi đang có: mốc 10:00
      const goc = globalThis.fetch;
      vi.stubGlobal('fetch', async (u: string, init?: RequestInit) => {
        await kho.ghi('khoan',
          { id: 'dong-ho-lui', thang: SONG, suaLuc: '2026-09-05T10:10:00.000Z', d: {} });
        return (goc as typeof fetch)(u, init);
      });

      await saoLuuMotLuot(kho, NGAY, '2026-09-05T10:30:00.000Z', SONG);
      expect((await latBan(kho, await docSoKet(kho))).map((b) => b.lat),
        'khoản gõ lúc 10:10 vẫn phải còn đường lên két').toContain(SONG);
    });

  it('khôi phục lúc mất mạng ⇒ dừng, không dựng một bản khuyết trông như đầy đủ',
    async () => {
      const { kho, khoa } = await khoDayDu();
      await saoLuuMotLuot(kho, NGAY, LUC, SONG);
      may.mat = true;
      const kq = await khoiPhucTuKet(new KhoTrongBoNho(), khoa, [LAT_SONG, SONG], LUC);
      expect(kq.vuong).toBe('chua_toi_may_chu');
      expect(kq.lat).toEqual([]);
    });

  it('sai chìa ⇒ `khong_mo_duoc`, KHÔNG ném và không đụng vào kho', async () => {
    const { kho } = await khoDayDu();
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    const moi = new KhoTrongBoNho();
    const kq = await khoiPhucTuKet(moi, await chiaGia(), [LAT_SONG], LUC);
    expect(kq.vuong).toBe('khong_mo_duoc');
    expect(await moi.dem('hu')).toBe(0);
  });

  it('chưa từng sao lưu ⇒ khôi phục trả rỗng, không lỗi', async () => {
    const kq = await khoiPhucTuKet(new KhoTrongBoNho(), await chiaGia(), [LAT_SONG], LUC);
    expect(kq).toMatchObject({ lat: [], them: 0 });
    expect(kq.vuong).toBeUndefined();
  });
});

/* ═══ §VI-bis — ⭐⭐⭐ LỖI CỦA MỘT LÁT KHÔNG ĐƯỢC BỎ ĐÓI LÁT SAU ══════════ */

describe('§VI-bis — ⭐⭐⭐ `song` đứng CUỐI hàng nên mọi cú dừng nhầm đều giết đúng nó', () => {
  /** Kho có một tháng khổng lồ (vượt trần) + một hũ. */
  async function khoNang(): Promise<{ kho: KhoTrongBoNho; khoa: CryptoKey }> {
    const { kho, khoa } = await khoDayDu();
    /*
     * ⚠ PHẢI LÀ RÁC THẬT. Bản đầu tôi dùng `(i * 7919) % 251` — một dãy TUẦN HOÀN, nên
     * gzip nuốt gọn và lát chưa bao giờ vượt trần: bài đỏ ở `quaLon = 0`. `dongLat` nén
     * TRƯỚC khi mã hoá (đúng thứ tự, xem `ket.ts`), nên muốn dựng một lát quá cỡ thì
     * phải dựng thứ **không nén được**.
     */
    // ⚠ `getRandomValues` trần 65 536 byte một lượt — đổ theo khúc.
    const rac: number[] = [];
    while (rac.length < PFM.BLOB_MAX * 3) {
      rac.push(...crypto.getRandomValues(new Uint8Array(65_536)));
    }
    await kho.ghi('khoan', { id: 'to', thang: SONG, suaLuc: LUC, d: { rac } });
    return { kho, khoa };
  }

  it('⭐⭐⭐ tháng QUÁ LỚN ⇒ vẫn lưu được `song`, và tháng đó được ĐẾM', async () => {
    /*
     * ⚠⚠ Ca tệ nhất cả tệp, và bản đầu của tôi dính đúng nó (`break` thay vì đi tiếp):
     * một tháng dày quá trần chặn đứng `song` cho tới hết tháng — mà `song` chở HŨ, thứ
     * `config/pfm.ts` gọi là *"thứ duy nhất trong sổ mà mất đi thì không dựng lại nổi từ
     * đâu"*. Rồi sang tháng sau, chính tháng dày ấy thành tháng đóng và mất luôn.
     * ⇒ HAI lát mất vì MỘT lát to. Bài này khoá đúng chuyện đó.
     */
    const { kho } = await khoNang();
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);

    expect(kq.quaLon).toBe(1);
    expect(kq.daLuu, 'hũ vẫn phải lên được két').toEqual([LAT_SONG]);
    expect(kq.vuong, 'một lát to không phải lỗi của cả lượt').toBeUndefined();
    expect(vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'pfm_ket_qua_lon'))
      .toHaveLength(1);
  });

  it('⭐⭐ `ver` LỆCH ở tháng ⇒ `song` vẫn lưu được', async () => {
    const { kho, khoa } = await khoDayDu();
    may.lat.set(thangGuiLen(SONG),
      { blob: raByte(await dongLat(SONG, {}, khoa)), ver: 4, schemaV: 2 });

    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.vuong, '409 là phán quyết về MÓN NÀY, không phải cả lượt').toBeUndefined();
    expect(kq.daLuu).toEqual([LAT_SONG]);
    expect((await docSoKet(kho)).ver[SONG], 'ver thật vẫn vào sổ').toBe(4);
  });

  it('MẤT MẠNG ở lát đầu ⇒ DỪNG (lát sau chắc chắn cũng hỏng)', async () => {
    const { kho } = await khoDayDu();
    may.mat = true;
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.vuong).toBe('chua_toi_may_chu');
    expect(kq.conBan, 'cả hai lát còn nguyên').toBe(2);
  });
});

/* ═══ §VI-ter — HÌNH THÁNG, PHẢN HỒI LẠ, CHÌA HỎNG ═══════════════════════ */

describe('§VI-ter — ba cái bẫy im lặng', () => {
  it('⭐⭐⭐ `thangSong` hình `YYYY-MM-01` (hình của server) vẫn chạy đúng', async () => {
    /*
     * ⚠⚠ Server và `/me` nói bằng hình `-01` (`laThangHopLe`), mã lát trong máy là
     * `'YYYY-MM'`. Một tham số `string` nhận nhầm hình thì `b.lat === thangSong` sai với
     * MỌI tháng ⇒ toàn bộ khoản chi rơi vào nhánh "tháng đã đóng", không lát nào gửi đi,
     * mà hàm vẫn trả `vuong: undefined` — **hỏng sạch nhưng trông y như thành công**.
     * Đây là mìn cho đúng cái commit nối `/me` vào sau này.
     */
    const { kho } = await khoDayDu();
    const kq = await saoLuuMotLuot(kho, NGAY, LUC, '2026-09-01');
    expect(kq.thangDong, 'KHÔNG được coi tháng đang sống là tháng đã đóng').toBe(0);
    expect(kq.daLuu).toEqual([SONG, LAT_SONG]);
  });

  it('⭐⭐ 200 mà thân KHÔNG phải JSON ⇒ không ném, không ghi `ver` rác', async () => {
    /*
     * `api()` đọc thân bằng `res.json().catch(() => null)`, nên một 200 kèm HTML trả về
     * `null` — trang chặn wifi khách sạn, trang lỗi CDN, service worker trả vỏ app. Đọc
     * thẳng `dap.ver` là ném từ một hàm đã hứa không ném; ghi `ver` không phải số vào sổ
     * còn tệ hơn: lượt sau gửi `ver=NaN` rồi ăn 400 mãi mãi.
     */
    const { kho } = await khoDayDu();
    vi.stubGlobal('fetch', async () => new Response('<html>Đăng nhập wifi</html>',
      { status: 200, headers: { 'content-type': 'text/html' } }));

    const kq = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(kq.vuong).toBe('may_chu_tu_choi');
    expect((await docSoKet(kho)).ver[SONG], 'không ghi ver rác').toBeUndefined();
  });

  it('⭐⭐ chìa đã hỏng thành `{}` (máy dính bản lỗi cũ) ⇒ `chua_co_chia`, KHÔNG ném',
    async () => {
      // `docChia` trả một object rỗng KHÔNG null, nên `!== null` cho qua và `dongLat`
      // ném một lỗi mật mã. Kiểm `instanceof` mới là kiểm đúng thứ mình cần.
      const { kho } = await khoDayDu();
      await kho.ghi('meta', { id: ID_KHOA_KET, thang: SONG, suaLuc: LUC, d: {} });
      expect((await saoLuuMotLuot(kho, NGAY, LUC, SONG)).vuong).toBe('chua_co_chia');
    });

  it('⭐⭐ 429 của server ⇒ máy ghi nhận hết suất, KHÔNG gõ cửa lại cả ngày', async () => {
    /*
     * Bộ đếm suất là của MÁY, trần thật là của TÀI KHOẢN — hai máy, hay một kho vừa bị
     * xoá, là máy tưởng còn suất trong khi server đã hết. Không đồng bộ lại thì driver
     * gõ cửa ở MỌI lần mở app suốt phần còn lại của ngày, mỗi lần lại ăn 429.
     * ⚠ Phải đếm LƯỢT GÕ CỬA (`soLanGoi`), không phải lượt ghi được. Bản đầu tôi đếm
     *   `ghiNhan` — mà `ghiNhan` chỉ ghi lượt THÀNH CÔNG, nên nó rỗng dù có gọi hay
     *   không: tiêm lỗi ra 0/34, bài chứng minh đúng con số không.
     */
    const { kho } = await khoDayDu();
    may.suat = 0;
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(may.soLanGoi, 'lượt đầu có gõ cửa và ăn 429').toBeGreaterThan(0);

    may.soLanGoi = 0;
    const lai = await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(lai.vuong).toBe('het_suat_ngay');
    expect(may.soLanGoi, 'lượt sau KHÔNG được gõ cửa nữa').toBe(0);
  });

  it('⭐ két méo (JSON hợp lệ nhưng sai hình) ⇒ bỏ ngăn đó, KHÔNG ném cả cú khôi phục',
    async () => {
      /*
       * `moLat` là `JSON.parse(...) as RuotLat` — một khẳng định kiểu, không phải phép
       * kiểm. Một lát có `"hu": {}` làm `hoaGiai` ném từ trong vòng `for...of`, và lưới
       * cuối sẽ nuốt nguyên cú khôi phục thay vì bỏ đúng một ngăn.
       */
      const khoa = await chiaGia();
      const meo = await dongLat(LAT_SONG,
        { hu: {} as never, luat: [{ id: 'l1', thang: SONG, suaLuc: LUC, d: {} }] }, khoa);
      may.lat.set(LAT_SONG_THANG, { blob: raByte(meo), ver: 1, schemaV: 2 });

      const moi = new KhoTrongBoNho();
      const kq = await khoiPhucTuKet(moi, khoa, [LAT_SONG], LUC);
      expect(kq.them, 'ngăn `luat` lành vẫn về được').toBe(1);
      expect(await moi.doc('luat', 'l1')).not.toBeNull();
    });

  it('⭐⭐ két ghi bởi kho MỚI HƠN ⇒ từ chối, không trộn hình lạ vào kho cũ', async () => {
    const khoa = await chiaGia();
    may.lat.set(LAT_SONG_THANG, {
      blob: raByte(await dongLat(LAT_SONG, { hu: [] }, khoa)),
      ver: 1, schemaV: 99,
    });
    const kq = await khoiPhucTuKet(new KhoTrongBoNho(), khoa, [LAT_SONG], LUC);
    expect(kq.hong).toBe(1);
    expect(kq.lat).toEqual([]);
    expect(kq.vuong).toBe('khong_mo_duoc');
  });

  it('⭐⭐ khôi phục KHUYẾT phải đếm được — không trông như đầy đủ', async () => {
    /*
     * `song` mở được, lát tháng hỏng: người dùng thấy lại hũ, thấy sổ trống, và không có
     * gì trên màn hình nói rằng một lát đã thất bại. `hong` tồn tại để màn Cài đặt (GĐ5)
     * CÓ THỂ nói ra — không có con số thì không có cách nào nói, kể cả khi muốn.
     */
    const { kho, khoa } = await khoDayDu();
    await saoLuuMotLuot(kho, NGAY, '2026-09-05T10:00:01.000Z', SONG);
    may.lat.set(thangGuiLen(SONG),
      { blob: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]), ver: 9, schemaV: 2 });

    const kq = await khoiPhucTuKet(new KhoTrongBoNho(), khoa, [LAT_SONG, SONG], LUC);
    expect(kq.lat, '`song` vẫn về được').toEqual([LAT_SONG]);
    expect(kq.hong, 'và lát tháng hỏng phải ĐẾM ĐƯỢC').toBe(1);
    expect(kq.vuong, 'không phải "hỏng hết" nên không có vuong — nhưng `hong` > 0')
      .toBeUndefined();
  });

  it('lát KẸT chỉ kêu MỘT LẦN mỗi ngày, dù mở app bao nhiêu lượt', async () => {
    // Driver chạy mỗi lần mở app; một lát kẹt thì kẹt mãi. Đếm vô điều kiện là 12 dòng
    // telemetry mỗi lần mở app cho mỗi người — và con số R5 thành vô nghĩa.
    const { kho } = await khoDayDu();
    await kho.ghi('khoan', { id: 'cu', thang: '2026-07', suaLuc: LUC, d: {} });
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    may.suat = PFM.SO_LAN_LUU_NGAY;
    await saoLuuMotLuot(kho, NGAY, LUC, SONG);
    expect(vi.mocked(ghiDo).mock.calls.filter((c) => c[0] === 'pfm_ket_thang_dong'))
      .toHaveLength(1);
  });
});

/* ═══ §VI — DANH SÁCH LÁT KHÔI PHỤC ═══════════════════════════════════════ */

describe('§VI — latDeKhoiPhuc', () => {
  it('`song` đi TRƯỚC, rồi 12 tháng lùi dần, vắt qua mốc năm', () => {
    const ds = latDeKhoiPhuc('2026-02', 3);
    expect(ds).toEqual([LAT_SONG, '2026-02', '2026-01', '2025-12']);
  });

  it('mặc định 12 tháng + lát sống', () => {
    expect(latDeKhoiPhuc('2026-09')).toHaveLength(13);
  });
});
