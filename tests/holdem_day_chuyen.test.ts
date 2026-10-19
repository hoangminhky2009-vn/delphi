/**
 * DÂY CHUYỀN SỰ KIỆN — thị trường phải có TRÍ NHỚ NHÂN QUẢ.
 *
 * Founder 20/07: "cơ chế tương tác giữa các thẻ sự kiện và mùa thị trường hiện
 * tại hơi nghèo nàn". Đúng: trước đó mỗi ô sự kiện rút độc lập và đều nhau, nên
 * chiến tranh nổ ra rồi vòng sau có thể là "hack sàn" chẳng liên quan gì.
 *
 * File này đo bằng TẦN SUẤT trên nhiều nghìn map, không phải khẳng định từng
 * map — dây chuyền là XÁC SUẤT nghiêng, không phải luật cứng. Nếu viết test
 * kiểu "map này phải có chuỗi X" thì nó vừa mong manh vừa mô tả sai cơ chế.
 */
import { describe, expect, it } from 'vitest';
import { sinhMap } from '../server/holdem/map.js';
import { BONG_BONG, HOLDEM_DECISIONS, MT_SU_KIEN_KE_TIEP, SU_KIEN } from '../config/holdem.js';

const SIZE = HOLDEM_DECISIONS.MAP_SIZE;

/** Đếm: sau sự kiện THẬT `tu`, sự kiện kế tiếp là `den` bao nhiêu lần. */
function doChuyenTiep(tu: string, den: string, soMap = 4000): { khop: number; tong: number } {
  let khop = 0; let tong = 0;
  for (let seed = 0; seed < soMap; seed += 1) {
    const m = sinhMap(seed, SIZE);
    const sk = m.o
      .map((o, i) => ({ o, i }))
      .filter((x) => x.o.kind === 'su_kien');
    for (let k = 0; k + 1 < sk.length; k += 1) {
      const a = sk[k]!.o;
      const b = sk[k + 1]!.o;
      if (a.kind !== 'su_kien' || b.kind !== 'su_kien') continue;
      if (a.la_tin_gia || a.su_kien !== tu) continue;
      tong += 1;
      if (b.su_kien === den) khop += 1;
    }
  }
  return { khop, tong };
}

describe('1. CHUỖI NHÂN QUẢ — sự kiện kéo theo sự kiện', () => {
  const NEN = 1 / SU_KIEN.length;   // nếu rút đều thì mỗi sự kiện ~1/7

  it('🔴 CHIẾN TRANH → LẠM PHÁT trội hẳn so với rút đều', () => {
    const { khop, tong } = doChuyenTiep('chien_tranh', 'lam_phat');
    expect(tong, 'phải có mẫu để đo').toBeGreaterThan(30);
    expect(khop / tong).toBeGreaterThan(NEN * 1.8);
  });

  it('🔴 LẠM PHÁT → TĂNG LÃI SUẤT trội hẳn', () => {
    const { khop, tong } = doChuyenTiep('lam_phat', 'tang_lai_suat');
    expect(tong).toBeGreaterThan(30);
    expect(khop / tong).toBeGreaterThan(NEN * 1.8);
  });

  it('🔴 HẠ LÃI SUẤT → BONG BÓNG trội hẳn', () => {
    const { khop, tong } = doChuyenTiep('ha_lai_suat', 'bong_bong');
    expect(tong).toBeGreaterThan(30);
    expect(khop / tong).toBeGreaterThan(NEN * 1.8);
  });

  it('TIN GIẢ KHÔNG kéo được dây chuyền — nếu không thì hết đường phân biệt', () => {
    // Đây là ràng buộc giữ cho gate G4 còn nghĩa: nếu tin bịa vẫn đẻ ra hệ quả
    // thật thì "hiệu chỉnh theo tỷ lệ tin giả" không còn là kỹ năng nào cả.
    let khopGia = 0; let tongGia = 0;
    for (let seed = 0; seed < 4000; seed += 1) {
      const m = sinhMap(seed, SIZE);
      const sk = m.o.filter((o) => o.kind === 'su_kien');
      for (let k = 0; k + 1 < sk.length; k += 1) {
        const a = sk[k]!; const b = sk[k + 1]!;
        if (a.kind !== 'su_kien' || b.kind !== 'su_kien') continue;
        if (!a.la_tin_gia || a.su_kien !== 'chien_tranh') continue;
        tongGia += 1;
        if (b.su_kien === 'lam_phat') khopGia += 1;
      }
    }
    if (tongGia >= 20) {
      const { khop, tong } = doChuyenTiep('chien_tranh', 'lam_phat');
      expect(khopGia / tongGia, 'tin giả phải yếu hơn tin thật rõ rệt')
        .toBeLessThan(khop / tong);
    }
  });

  it('mọi sự kiện trong bảng dây chuyền đều là id có thật', () => {
    const ids = new Set(SU_KIEN.map((x) => x.id));
    for (const [tu, den] of Object.entries(MT_SU_KIEN_KE_TIEP)) {
      expect(ids.has(tu as never), `${tu} không tồn tại`).toBe(true);
      for (const k of Object.keys(den ?? {})) {
        expect(ids.has(k as never), `${k} không tồn tại`).toBe(true);
      }
    }
  });
});

describe('2. BONG BÓNG — một lá ép được NHIỀU vòng sau', () => {
  it('🔴 sau bong bóng THẬT luôn là chuỗi PHỒNG hoặc chuỗi VỠ, không lửng lơ', () => {
    let soCa = 0;
    for (let seed = 0; seed < 3000 && soCa < 60; seed += 1) {
      const m = sinhMap(seed, SIZE);
      for (let i = 0; i + 2 < m.o.length; i += 1) {
        const o = m.o[i]!;
        if (o.kind !== 'su_kien' || o.su_kien !== 'bong_bong' || o.la_tin_gia) continue;
        const a = m.o[i + 1]!; const b = m.o[i + 2]!;
        if (a.kind !== 'giai_doan' || b.kind !== 'giai_doan') continue;
        soCa += 1;
        const chuoi = [a.giai_doan, b.giai_doan].join(',');
        expect(
          [BONG_BONG.CHUOI_PHONG.join(','), BONG_BONG.CHUOI_VO.join(',')],
          `seed ${seed} ra chuỗi lạ: ${chuoi}`,
        ).toContain(chuoi);
      }
    }
    expect(soCa, 'phải gặp đủ ca bong bóng để đo').toBeGreaterThan(20);
  });

  it('CẢ HAI nhánh đều xảy ra — bong bóng phải là canh bạc, không phải lời hứa', () => {
    let phong = 0; let vo = 0;
    for (let seed = 0; seed < 4000; seed += 1) {
      const m = sinhMap(seed, SIZE);
      for (let i = 0; i + 1 < m.o.length; i += 1) {
        const o = m.o[i]!;
        if (o.kind !== 'su_kien' || o.su_kien !== 'bong_bong' || o.la_tin_gia) continue;
        const ke = m.o[i + 1]!;
        if (ke.kind !== 'giai_doan') continue;
        if (ke.giai_doan === BONG_BONG.CHUOI_PHONG[0]) phong += 1;
        else if (ke.giai_doan === BONG_BONG.CHUOI_VO[0]) vo += 1;
      }
    }
    expect(phong, 'phải có ca phồng').toBeGreaterThan(10);
    expect(vo, 'phải có ca vỡ — không thì bong bóng thành tiền miễn phí')
      .toBeGreaterThan(10);
  });

  it('KHÔNG chen sự kiện mới vào giữa chuỗi hệ quả', () => {
    for (let seed = 0; seed < 2000; seed += 1) {
      const m = sinhMap(seed, SIZE);
      for (let i = 0; i + 1 < m.o.length; i += 1) {
        const o = m.o[i]!;
        if (o.kind !== 'su_kien' || o.su_kien !== 'bong_bong' || o.la_tin_gia) continue;
        expect(m.o[i + 1]!.kind, `seed ${seed}: chuỗi bị cắt ngang`).toBe('giai_doan');
      }
    }
  });
});

describe('3. TẤT ĐỊNH vẫn nguyên sau khi map có trí nhớ', () => {
  it('cùng seed → map giống hệt, kể cả chuỗi hệ quả', () => {
    for (const seed of [0, 7, 99, 4242, 65535]) {
      expect(sinhMap(seed, SIZE).o).toEqual(sinhMap(seed, SIZE).o);
    }
  });
});
