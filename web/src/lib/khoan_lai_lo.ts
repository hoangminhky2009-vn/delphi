/**
 * KHOẢN LÃI/LỖ CỦA VÒNG — MỘT nguồn cho HAI chỗ đọc (D400): khối "PHẦN TIỀN CỦA BẠN" trong bảng VÌ SAO và các hộp
 * chữ nổi ở bước LÃI/LỖ (`KhoanNoi`). Founder 24/09: *"Nhớ lưu ý màu sắc và số tiền lãi/lỗ phải trùng khớp với phần
 * lý do khi bấm vào xem chi tiết"* ⇒ không được có hai hàm dựng danh sách (D61: bản thứ hai sẽ trôi).
 *
 * Số do server phát (C4): `cua_ban.tien_theo_ma` (phần GIÁ theo mã — D336) + `cau_noi_nav` (mọi khoản làm NAV đổi
 * ngoài giá — D342). Cộng các khoản = đúng cú đổi NAV của vòng. Client chỉ xếp thứ tự và đặt chữ (D26).
 */
import type { KetQuaVongDTO, TaiSanDTO } from '@/api/holdem';

export type LoaiKhoan = 'lai' | 'lo' | 'truot';

export interface KhoanLaiLo {
  /** Khoá ổn định: mã (`khong:<mã>` cho sổ khống) hoặc `cn:<id>` cho dòng cầu nối. */
  khoa: string;
  /** Nhãn đủ — dòng trong bảng VÌ SAO. */
  nhan: string;
  /** Nhãn ngắn — hộp chữ nổi (một dòng hẹp trên màn 375px). Cùng khoản, chỉ ngắn hơn. */
  nhanNgan: string;
  /** Chip, đúng số server phát — không tính lại. */
  tien: number;
  /** Màu: lãi xanh · lỗ đỏ · trượt giá cam (founder 23/09: *"Tách riêng dòng: Trượt giá: -X% (màu đỏ/cam)"*). */
  loai: LoaiKhoan;
}

/**
 * Id dòng cầu nối là TRƯỢT GIÁ: engine gom trượt giá của mọi lệnh khớp trong vòng vào `phi_giao_dich_vong`
 * (`apLenhVongNav`), API phát thành dòng `phi_giao_dich`. Founder 23/09: *"slippage đang quá ẩn — nằm trong P&L →
 * người chơi khó nhận ra quan hệ nhân quả"* — dòng đã tách từ D342 nhưng chìm giữa các dòng tiền cùng màu đỏ.
 */
export const CAU_NOI_TRUOT_GIA = 'phi_giao_dich';

/** Khoá của một dòng cầu nối trong danh sách khoản (`cn:<id>`) — một chỗ dựng, để nơi khác trỏ đúng một khoản (D401). */
export const khoaCauNoi = (id: string): string => `cn:${id}`;

/*
 * Nhãn các dòng cầu nối NAV (id do server phát, chữ ở client — D26). Mô tả, không kê đơn (A10).
 * ⭐ D374 (founder 21/09): *"Nộp quỹ vòng và chia quỹ vòng là gì?"* — "quỹ vòng" là từ trong nhà; mỗi dòng tự nói NÓ
 * LÀ GÌ và TIỀN ĐI ĐÂU. D400: dòng trượt giá đổi chữ đầu thành "Trượt giá" — đúng từ founder dùng.
 */
export const NHAN_CAU_NOI: Readonly<Record<string, string>> = {
  huy_so: 'Huỷ sổ tiết kiệm sớm — mất phần lãi',
  [CAU_NOI_TRUOT_GIA]: 'Trượt giá khi mua bán',
  phi_bang: 'Phí mở bảng điện tử',
  nop_quy: 'Tiền cược vòng này — cả bàn cùng nộp',
  trong_vong: 'Tiền mặt: lạm phát bào · phí giữ · lãi nhận',
  // D450 — engine xếp chia quỹ theo % lãi/lỗ CỦA VÒNG (`pnl_bp`, `thuTuChia` ở engine.ts), không theo NAV: chữ cũ
  // "theo hạng NAV" nói sai luật — ghế NAV to mà vòng này lỗ thì không ăn gì.
  quy_vong: 'Ăn chia tiền cược — chia theo % lãi/lỗ của vòng',
};

/**
 * Nhãn ngắn của cùng các dòng ấy cho hộp chữ nổi. `trong_vong` gom ba thứ ngược chiều (lạm phát bào · phí giữ · lãi
 * nhận) nên nhãn ngắn đi THEO DẤU — soi màn thật 24/09: hộp "Tiền mặt −279" không nói tiền đi đâu (`nhanNganCauNoi`).
 */
export const NHAN_CAU_NOI_NGAN: Readonly<Record<string, string>> = {
  huy_so: 'Huỷ sổ sớm',
  [CAU_NOI_TRUOT_GIA]: 'Trượt giá',
  phi_bang: 'Phí bảng',
  nop_quy: 'Tiền cược',
  quy_vong: 'Ăn chia cược',
};

/** Nhãn ngắn của một dòng cầu nối — `trong_vong` âm là lạm phát/phí thắng, dương là lãi tiền mặt thắng. */
export function nhanNganCauNoi(id: string, tien: number): string {
  if (id === 'trong_vong') return tien < 0 ? 'Lạm phát · phí giữ' : 'Lãi tiền mặt';
  return NHAN_CAU_NOI_NGAN[id] ?? NHAN_CAU_NOI[id] ?? id;
}

/**
 * Danh sách khoản theo đúng thứ tự bảng VÌ SAO: các mã trước (mã đáp trước trong dây chuyền đứng trước, mã không có
 * dòng nào xuống cuối), rồi các dòng cầu nối theo thứ tự server phát.
 */
export function khoanLaiLo(
  kq: Pick<KetQuaVongDTO, 'cua_ban' | 'cau_noi_nav'>,
  taiSan: readonly Pick<TaiSanDTO, 'id' | 'label'>[],
): KhoanLaiLo[] {
  const chain = kq.cua_ban?.chain ?? [];
  const thuTu = (ma: string): number => {
    const goc = ma.startsWith('khong:') ? ma.slice(6) : ma;
    const i = chain.findIndex((m) => (m as { id?: string }).id === goc || (m as { ma?: string }).ma === goc);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const theoMa = Object.entries(kq.cua_ban?.tien_theo_ma ?? {})
    .sort((a, b) => thuTu(a[0]) - thuTu(b[0]))
    .map(([ma, tien]): KhoanLaiLo => {
      const khong = ma.startsWith('khong:');
      const goc = khong ? ma.slice(6) : ma;
      const nhan = `${taiSan.find((x) => x.id === goc)?.label ?? goc}${khong ? ' · khống' : ''}`;
      return { khoa: ma, nhan, nhanNgan: nhan, tien, loai: tien >= 0 ? 'lai' : 'lo' };
    });
  const cauNoi = (kq.cau_noi_nav ?? []).map((d): KhoanLaiLo => ({
    khoa: khoaCauNoi(d.id),
    nhan: NHAN_CAU_NOI[d.id] ?? d.id,
    nhanNgan: nhanNganCauNoi(d.id, d.tien),
    tien: d.tien,
    loai: d.id === CAU_NOI_TRUOT_GIA ? 'truot' : d.tien >= 0 ? 'lai' : 'lo',
  }));
  return [...theoMa, ...cauNoi];
}

/**
 * Hộp chữ nổi của một vòng: bỏ khoản 0 chip (không có gì để nói); quá `toiDa` khoản thì giữ `toiDa − 1` khoản LỚN
 * nhất (vẫn theo thứ tự bảng VÌ SAO) và gộp phần còn lại thành một hộp "Khoản khác" — tổng vẫn đúng từng chip.
 */
export function khoanNoiCuaVong(ds: readonly KhoanLaiLo[], toiDa: number): KhoanLaiLo[] {
  const co = ds.filter((k) => k.tien !== 0);
  if (co.length <= toiDa) return co;
  const giu = new Set([...co].sort((a, b) => Math.abs(b.tien) - Math.abs(a.tien)).slice(0, toiDa - 1).map((k) => k.khoa));
  const conLai = co.filter((k) => !giu.has(k.khoa)).reduce((a, k) => a + k.tien, 0);
  return [
    ...co.filter((k) => giu.has(k.khoa)),
    { khoa: 'khac', nhan: 'Các khoản nhỏ khác', nhanNgan: 'Khoản khác', tien: conLai, loai: conLai >= 0 ? 'lai' : 'lo' },
  ];
}
