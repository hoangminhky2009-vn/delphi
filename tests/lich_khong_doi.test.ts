/**
 * D302 — hai lỗi lộ ra khi đo bàn tập 12 ô bằng CHÍNH `replay()` (không phải `sinhMap`):
 *
 * 1. ĐÁM ĐÔNG ĐÈ LÊN Ô KỲ HỌP. Bản đồ in ⚖ KỲ HỌP lên ô úp từ đầu trận và API gửi
 *    `chinh_sach` cho ô đó, nhưng phản thân (v20) vẫn thay được nó: dưới v36, ô ⚖ 9
 *    TĂNG LÃI của bàn tập thành HACK SÀN. Sửa bằng cổng `balance-v40-lichcodinh`
 *    (cờ `lichKhongDoi`) — đổi replay là cửa một chiều (A11.3), v36 prod giữ nguyên
 *    cho tới khi founder lật.
 * 2. BÀN TẬP KỂ SAI. Lời Oracle bước `chuyen-v9` ("ngân hàng dập bong bóng") kể một
 *    ô đã bị đổi; bài `coach_ban_tap` xanh vì đối chiếu map tĩnh. Sửa bằng
 *    `luatChoTran`: seed bàn tập 12 ô tắt phản thân + bẻ chuỗi ⇒ dãy ô thật == `sinhMap`.
 *
 * Bài này là bằng chứng của cả hai: mục II làm lỗi 1 HIỆN RA trước khi chứng minh cờ
 * chặn được nó (tiêm lỗi ngược nằm sẵn trong bài — A11.6), mục III làm lỗi 2 hiện ra
 * qua `luatCua` thẳng rồi chứng minh `luatChoTran` cho dãy ô cố định.
 */
import { describe, expect, it } from 'vitest';
import {
  BO_LUAT_THEO_PHIEN_BAN, HOLDEM_BALANCE_VERSION, HOLDEM_DECISIONS, luatCua, seedManTap,
} from '../config/holdem.js';
import { luatChoTran, replay, soDoGhe } from '../server/holdem_api.js';
import { tuyChonSinhMap } from '../server/holdem/engine.js';
import { sinhMap } from '../server/holdem/map.js';

const V36 = 'balance-v36-regime';
const V39 = 'balance-v39-thucte';
const V40 = 'balance-v40-lichcodinh';
/** Seed 12 ô của D300 — bằng chứng lỗi đo dưới v36 (dãy ô của nó chỉ đúng ở v36–v38). */
const SEED_12_V36 = HOLDEM_DECISIONS.MAN_TAP_SEED_12;
/*
 * Seed bàn tập 12 ô KỂ CHUYỆN CỐ ĐỊNH (D302/D303). D527 — bàn tập mặc định sang v58 6 ô, luật ấy tự tắt phản thân/bẻ chuỗi nên không
 * cần `luatChoTran` vá ⇒ mục III canh bàn 12 ô của khoá v54 ĐÍCH DANH (trận tập v54 dở vẫn replay bằng nó).
 */
const KHOA_TAP_12 = 'balance-v54-ngare';
const SEED_TAP = seedManTap(KHOA_TAP_12);
const SO_O = HOLDEM_DECISIONS.MAN_TAP_SO_O;

const soCua = (k: string) => Number(/^balance-v(\d+)/.exec(k)?.[1] ?? NaN);

/** 12 dòng log "ngồi im" — bot vẫn chơi theo seed, đủ để phe dồn đủ ngưỡng. */
const logNgoiIm = () => Array.from({ length: SO_O - 1 }, (_, i) => ({ // D383 — 12 ô ⇒ 11 vòng
  vong: i + 1, khao_sat_lai: 0, mua: [], hanh_dong: 'giu_vi_the' as const, them: 0, cuoc: [],
}));

const chay = (luat: ReturnType<typeof luatCua>, seed = SEED_TAP) =>
  replay(seed, logNgoiIm() as never, false, soDoGhe(seed, 'u-tap') as never,
    luat, 0, false, SO_O);

describe('I. bảng luật — cờ lichKhongDoi', () => {
  it('false ở mọi khoá < 40 (bật ở bản cũ = đổi replay trận đã lưu), true từ v40', () => {
    for (const [ten, luat] of Object.entries(BO_LUAT_THEO_PHIEN_BAN)) {
      if (soCua(ten) >= 40) expect(luat.lichKhongDoi, `"${ten}" phải bật`).toBe(true);
      else expect(luat.lichKhongDoi, `"${ten}" bật cờ`).toBe(false);
    }
    expect(luatCua(null).lichKhongDoi).toBe(false);
    expect(luatCua(HOLDEM_BALANCE_VERSION).lichKhongDoi, 'mặc định đã lật (D303)').toBe(true);
  });

  it('v40 khác v39 đúng MỘT cờ (quy ước bảng: bản mới xếp chồng mọi cờ cũ)', () => {
    const a = luatCua(V39) as unknown as Record<string, boolean>;
    const b = luatCua(V40) as unknown as Record<string, boolean>;
    const khac = Object.keys(b).filter((k) => a[k] !== b[k]);
    expect(khac).toEqual(['lichKhongDoi']);
  });
});

describe('II. ô kỳ họp miễn nhiễm đám đông', () => {
  it('BẰNG CHỨNG LỖI: dưới v36 (luatCua thẳng), phản thân đổi ô ⚖ 9 của bàn tập', () => {
    const r = chay(luatCua(V36), SEED_12_V36);
    const t9 = r.st.map.trang_thai?.[8];
    expect(t9?.o_lich, 'ô 9 bàn 12 phải là kỳ họp (O_THEO_MAP[12] = [4, 9])').toBe(true);
    const doi9 = r.st.phan_than?.find((x) => x.vong === 9);
    expect(doi9, 'v36: ô kỳ họp bị phản thân đổi — đây là lỗi bài này chặn').toBeDefined();
    expect(doi9!.tu).toBe('tang_lai_suat');
  });

  it('cùng luật + lichKhongDoi: ô ⚖ 9 giữ nguyên, ô 6 (không phải lịch) VẪN đổi — cờ chặn đúng chỗ, không tắt cả máy', () => {
    const r = chay({ ...luatCua(V36), lichKhongDoi: true }, SEED_12_V36);
    expect(r.st.lich_khong_doi).toBe(true);
    expect(r.st.phan_than?.find((x) => x.vong === 9)).toBeUndefined();
    expect(r.st.map.o[8]?.kind === 'su_kien' ? r.st.map.o[8].su_kien : null).toBe('tang_lai_suat');
    const doi6 = r.st.phan_than?.find((x) => x.vong === 6);
    expect(doi6, 'ô 6 không phải lịch — phản thân vẫn phải đổi được').toBeDefined();
    expect(r.st.map.trang_thai?.[5]?.o_lich).toBe(false);
  });
});

describe('III. bàn tập kể chuyện cố định (luatChoTran)', () => {
  it('trận thường: luatChoTran y hệt luatCua', () => {
    expect(luatChoTran(V36, 123456)).toEqual(luatCua(V36));
    expect(luatChoTran(null, SEED_TAP + 1)).toEqual(luatCua(null));
  });

  it('seed bàn tập 12 ô: tắt phản thân + bẻ chuỗi, cờ khác giữ nguyên', () => {
    const l = luatChoTran(V36, SEED_TAP);
    expect(l.phanThan).toBe(false);
    expect(l.beChuoiVon).toBe(false);
    const { phanThan: _a, beChuoiVon: _b, ...conLai } = l;
    const { phanThan: _c, beChuoiVon: _d, ...goc } = luatCua(V36);
    expect(conLai).toEqual(goc);
  });

  it('BẰNG CHỨNG LỖI rồi SỬA: luatCua thẳng ⇒ 2 cú đổi ô; luatChoTran ⇒ 0 cú, 12 ô thật == sinhMap', () => {
    const hong = chay(luatCua(V36), SEED_12_V36);
    expect((hong.st.phan_than?.length ?? 0) + (hong.st.be_chuoi?.length ?? 0),
      'bàn tập dưới luatCua thẳng phải có cú đổi ô — nếu 0 thì bài này không canh gì').toBeGreaterThan(0);

    const luat = luatChoTran(KHOA_TAP_12, SEED_TAP);
    const r = chay(luat);
    expect(r.st.phan_than ?? []).toEqual([]);
    expect(r.st.be_chuoi ?? []).toEqual([]);
    const tinh = sinhMap(SEED_TAP, SO_O, tuyChonSinhMap(luat));
    const id = (o: { kind: string; su_kien?: string; giai_doan?: string }) =>
      o.kind === 'su_kien' ? o.su_kien : o.giai_doan;
    expect(r.st.map.o.map(id)).toEqual(tinh.o.map(id));
  });
});
