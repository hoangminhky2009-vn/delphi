/**
 * ORACLE GIÚP 5/5 — **"tiền đi tới ngày nào"** trên màn GƯƠNG (D365).
 * Demo đã chốt (A11.25): `pfm-ngay-dau.html` màn `tuan` — bong bóng + dải lịch + hai nút
 * `CÓ ÍCH` / `KHÔNG`, và dòng phụ *"Phép chia trên chính sổ của bạn. Tôi chỉ đoán nhịp;
 * số tiền là của bạn gõ."*
 *
 * ⚠⚠ ĐÂY LÀ NGOẠI SUY, VÀ NÓ PHẢI TỰ NÓI RA GIẢ ĐỊNH (A10 🔒). Câu luôn mang vế "giữ nhịp
 * N ngày qua thì…" — bỏ vế ấy đi là biến một phép chia thành lời tiên tri. `tienToiNgay`
 * tự im khi chưa có lần tiền về, chưa đủ ngày, hoặc nhịp = 0 (P7 ⇒ `null`).
 * ⚠ Hai nút là CÂU TRẢ LỜI, không phải chấm điểm: cả hai đều hợp lệ, cất trên máy, và
 * chưa nối vào thuật toán chọn nào (đó là GĐ C). P5/P6 — không thưởng cho lựa chọn nào.
 */
import { useMemo, useState } from 'react';
import type React from 'react';
import { CHU_GIUP, CHU_MAN_SO } from '@/lib/pfm_chu';
import { useGhiKho, useSoTatCa } from '@/pfm/dung_kho';
import { docPhanHoiNhip, ghiPhanHoiNhip, usePhanHoiNhip } from '@/pfm/nhip_giup';
import { tienToiNgay } from '@/pfm/tien_toi_ngay';
import { bayGio, homNay } from '@/pfm/thoi_gian';
import { BongOracle } from './BongOracle';
import s from './TienToiNgay.module.css';

/** Ô lịch: mốc tiền về · ngày đã qua · hôm nay · ngày phần còn lại chạm 0. */
type OLich = 've' | 'qua' | 'nay' | 'het' | 'thuong';

/** Dải lịch từ ngày tiền về tới ngày hết (kẹp 21 ô để không tràn ngang trên máy hẹp). */
export function daiLich(ngayVe: string, nay: string, het: string | null): { ngay: number; loai: OLich }[] {
  const moc = Date.parse(`${ngayVe}T00:00:00Z`);
  const soNgay = Math.min(21, Math.max(
    Math.round((Date.parse(`${nay}T00:00:00Z`) - moc) / 86_400_000) + 3,
    het === null ? 0 : Math.round((Date.parse(`${het}T00:00:00Z`) - moc) / 86_400_000) + 1,
  ));
  const ra: { ngay: number; loai: OLich }[] = [];
  for (let i = 0; i < soNgay; i++) {
    const d = new Date(moc + i * 86_400_000).toISOString().slice(0, 10);
    const loai: OLich = d === ngayVe ? 've'
      : d === nay ? 'nay'
        : het !== null && d === het ? 'het'
          : d < nay ? 'qua' : 'thuong';
    ra.push({ ngay: Number(d.slice(8, 10)), loai });
  }
  return ra;
}

export function TienToiNgay(): React.ReactElement | null {
  const ghi = useGhiKho();
  const { data: tatCa } = useSoTatCa();
  const { data: phanHoi, dangTai } = usePhanHoiNhip();
  const [vuaDap, datVuaDap] = useState<boolean | null>(null);

  const nay = homNay();
  const r = useMemo(() => tienToiNgay(tatCa, nay), [tatCa, nay]);

  if (r === null) return <span data-testid="nhip-vung" aria-busy={dangTai ? 'true' : 'false'} hidden />;

  const daDap = vuaDap ?? phanHoi;
  async function dap(ich: boolean): Promise<void> {
    datVuaDap(ich);
    await ghi(['nhip'], (kho) => ghiPhanHoiNhip(kho, ich, bayGio()));
  }
  async function doiY(): Promise<void> {
    datVuaDap(null);
    await ghi(['nhip'], (kho) => ghiPhanHoiNhip(kho, null, bayGio()));
  }

  const lich = daiLich(r.ngayVe, nay, r.ngayHet);
  const soNgayVe = Number(r.ngayVe.slice(8, 10));
  const dinhDang = (n: number): string => n.toLocaleString('vi-VN');

  return (
    <div className={s.khoi} data-testid="nhip-the">
      <BongOracle
        nhan={CHU_GIUP.nhipTen}
        loi={(
          <>
            {CHU_GIUP.nhipTuPre} <b>{soNgayVe}</b>, {CHU_GIUP.nhipDaTieuPre}{' '}
            <b>{Math.round(r.tyLeDaTieu * 100)}%</b>
            {r.ngayHet === null ? (
              <>. {CHU_GIUP.nhipHetRoi}</>
            ) : (
              <>
                . {CHU_GIUP.nhipGiuPre} <b>{r.nhipNgay}</b> {CHU_GIUP.nhipGiuHau}{' '}
                <b>{Number(r.ngayHet.slice(8, 10))}</b>.
              </>
            )}
          </>
        )}
      >
        <div className={s.lich} aria-hidden="true">
          {lich.map((o, i) => (
            <i key={`${o.ngay}-${i}`} className={s[o.loai]}>{o.ngay}</i>
          ))}
        </div>
        <p className={s.chuThich}>{CHU_GIUP.nhipChuThich}</p>
        <p className={s.vi}>
          {CHU_GIUP.nhipVi} {CHU_GIUP.nhipConLaiPre} {dinhDang(Math.max(0, r.conLai))}
          {CHU_MAN_SO.hauDong}.
        </p>

        {daDap === null ? (
          <div className={s.nut}>
            <button type="button" className={s.chinh} onClick={() => void dap(true)}>
              {CHU_GIUP.nhipCoIch}
            </button>
            <button type="button" onClick={() => void dap(false)}>{CHU_GIUP.nhipKhong}</button>
          </div>
        ) : (
          <p className={s.gon} data-testid="nhip-da-dap">
            <span>{daDap ? CHU_GIUP.nhipDaCoIch : CHU_GIUP.nhipDaKhong}</span>
            <button type="button" className={s.doi} onClick={() => void doiY()}>
              {CHU_GIUP.lapDoi}
            </button>
          </p>
        )}
      </BongOracle>
    </div>
  );
}

export { docPhanHoiNhip };
