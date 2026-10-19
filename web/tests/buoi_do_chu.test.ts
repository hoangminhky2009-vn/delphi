/**
 * VĂN BẢN ĐỒNG Ý — GHIM CHỮ ↔ PHIÊN BẢN BẰNG HASH (D329). Trả món nợ `07-pfm-cai-dat-va-consent.md` §7:
 * *"ghim CHỮ ↔ PHIÊN BẢN bằng hash"*, điều kiện kích hoạt ghi sẵn là *"lần sửa câu chữ consent đầu tiên"* —
 * văn bản `buoi_do` là lần ấy.
 *
 * ⚠⚠ VÌ SAO LÀ HASH, không phải "nhớ tăng phiên bản": `config/pfm_consent.ts` và `pfm_chu.ts` đều viết
 * *"sửa một chữ ⇒ tăng phiên bản"* bằng chữ HOA — và không gì kiểm câu ấy. Vết đồng ý trong `events` trỏ
 * về (id, phiên bản); sửa chữ mà giữ phiên bản thì mọi vết cũ trỏ về một nội dung chưa ai từng đọc.
 *
 * ⚠ Khi bài này đỏ vì bạn CỐ Ý sửa chữ: tăng phiên bản ở `config/pfm_consent.ts`, THÊM bản mới vào
 * `CONSENT_LICH_SU`, THÊM một dòng hash mới vào `GHIM` dưới đây — KHÔNG sửa dòng hash cũ. Dòng cũ là bằng
 * chứng của thứ người dùng đã đọc.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CONSENT_LICH_SU, CONSENT_PHIEN_BAN, CUA_PFM, vanBanCua } from '@config/pfm_consent';
import { VAN_BAN_CONSENT, type VanBanConsent } from '../src/lib/pfm_chu';
import { CHU_BUOI_DO, VAN_BAN_BUOI_DO } from '../src/lib/buoi_do_chu';
import { VAN_BAN_NGHIEN_CUU } from '../src/lib/nghien_cuu_chu';
import { tuKeDonTrong } from '../src/lib/khoanh_khac';

/** `id@phiên bản` → 12 ký tự hex đầu của sha-256 toàn văn năm vế, đúng thứ tự vế. */
const GHIM: Readonly<Record<string, string>> = {
  // Ghim 13/09 (D329) trên đúng chữ đang ship của bốn cửa PFM — chưa đổi một chữ nào của chúng.
  'pfm_ket@v1': '0339ebd9a8d5',
  'pfm_dac_trung@v1': 'f7171ae30d3a',
  'pfm_thuong@v1': '6e4b2ed7d96c',
  'pfm_noi_game@v1': 'b70e7f25de06',
  // 13/09 — v2 (founder chọn A): chữ gọi tên đúng năm mã gm_* + thẻ + ba dấu. Dòng v1 ở trên GIỮ NGUYÊN.
  // ⏳ Chưa lên prod, chưa ai đồng ý v2: founder sửa chữ trước khi ship thì cập nhật TẠI CHỖ dòng này.
  'pfm_noi_game@v2': 'd8fa49280ff8',
  // 13/09 — v1. GIỮ NGUYÊN dù chưa ai bấm: nó đã ship trong bản 0.0.13+, tức đã có người ĐỌC được nó.
  'buoi_do@v1': '2e0cd7d2092b',
  /*
   * 20/09 — v2 (D361): v1 hứa *"không có dòng nào nói về một người"* trong khi đợt tester này nhóm làm
   * app đọc dòng từng người. Đo prod trước khi đổi: 0 vết đồng ý, 0 bàn `buoi_do` ⇒ không ai phải hỏi lại.
   * ⏳ Founder chưa đọc từng câu: sửa chữ TRƯỚC người đầu tiên bấm thì cập nhật TẠI CHỖ dòng này.
   */
  'buoi_do@v2': '254adb14c381',
  /*
   * 24/09 — v3 (D392): v2 tả sai dòng dữ liệu sau D370 (bài giấy · mã tham gia · "tiền trên giấy ở lại trên
   * giấy"). Chưa ai bấm v2 trên prod, nhưng lên bản mới để máy giữ web cũ không ghi được vết v2 kèm chữ cũ.
   */
  'buoi_do@v3': 'd203ac529e35',
  /*
   * 11/10 — v1 của ô ĐỒNG Ý NGHIÊN CỨU (SPEC chan-truoc-beta, migration 0079). Trước đó ô này là boolean trần, không văn bản có số.
   * ⏳ Chưa ai đồng ý bản này trên prod (chưa ship): founder sửa chữ trước khi ship thì cập nhật TẠI CHỖ dòng này.
   */
  'nghien_cuu@v1': '4298bb7b6416',
};

const bam = (v: VanBanConsent): string => createHash('sha256')
  .update(JSON.stringify([v.tieuDe, v.tomTat, v.roiMay, v.mayChuKhongDoc, v.chot]))
  .digest('hex').slice(0, 12);

const TAT_CA: Record<string, VanBanConsent> = { ...VAN_BAN_CONSENT, buoi_do: VAN_BAN_BUOI_DO, nghien_cuu: VAN_BAN_NGHIEN_CUU };

describe('§I — ⭐⭐⭐ chữ ↔ phiên bản', () => {
  it('⭐⭐⭐ mọi văn bản ĐANG hiệu lực khớp hash đã ghim ở đúng phiên bản của nó', () => {
    for (const [id, pb] of Object.entries(CONSENT_PHIEN_BAN)) {
      const khoa = `${id}@${pb}`;
      expect(TAT_CA[id], `${id} đăng ký phiên bản mà không có chữ`).toBeDefined();
      expect(GHIM[khoa], `${khoa} chưa có hash ghim — văn bản/phiên bản mới: THÊM một dòng vào GHIM`)
        .toBeDefined();
      expect(bam(TAT_CA[id]!),
        `${id}: câu chữ đã đổi mà vẫn ở ${pb} — đổi chữ ⇒ tăng phiên bản ở config/pfm_consent.ts, `
        + 'thêm bản mới vào CONSENT_LICH_SU và một dòng hash mới; không xoá bản cũ')
        .toBe(GHIM[khoa]);
    }
  });

  it('mọi dòng GHIM trỏ một phiên bản có trong lịch sử — không ghim thứ chưa từng tồn tại', () => {
    for (const khoa of Object.keys(GHIM)) {
      const [id, pb] = khoa.split('@') as [string, string];
      expect(CONSENT_LICH_SU[id], khoa).toContain(pb);
    }
  });
});

describe('§II — văn bản buổi đo', () => {
  it('buoi_do không phải một cửa PFM', () => {
    expect(CUA_PFM.map(vanBanCua)).not.toContain('buoi_do');
    expect(Object.keys(VAN_BAN_CONSENT)).not.toContain('buoi_do');
  });

  it('⭐ D392 — văn bản hiện hành tả ĐÚNG dòng dữ liệu sau D370: không giấy, không mã tham gia', () => {
    const toanVan = [VAN_BAN_BUOI_DO.tomTat, VAN_BAN_BUOI_DO.roiMay, VAN_BAN_BUOI_DO.mayChuKhongDoc,
      VAN_BAN_BUOI_DO.chot].join(' ').toLocaleLowerCase('vi-VN');
    // Bài giấy đã thay bằng ba Google Form; phiếu nối bằng MÃ BUỔI ĐO, không phải mã tham gia (theo trận).
    expect(toanVan).not.toMatch(/giấy/);
    expect(toanVan).not.toMatch(/mã tham gia/);
    expect(toanVan).toMatch(/mã buổi đo/);
    expect(toanVan).toMatch(/phiếu/);
  });

  it('⭐ không chữ kê đơn trong văn bản lẫn chữ quanh nó', () => {
    for (const c of [...Object.values(VAN_BAN_BUOI_DO), ...Object.values(CHU_BUOI_DO)]) {
      expect(tuKeDonTrong(c), `"${c}"`).toEqual([]);
    }
  });

  it('văn bản KHÔNG ghi cứng sàn mẫu: sàn là PLAYTEST-TUNE, mỗi lần chỉnh sẽ thành một phiên bản mới', () => {
    expect(VAN_BAN_BUOI_DO.mayChuKhongDoc).not.toMatch(/\d/);
  });
});
