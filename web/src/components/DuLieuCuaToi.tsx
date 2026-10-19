/**
 * LỚP TRƯỢT "DỮ LIỆU CỦA TÔI" (SPEC chan-truoc-beta mục 4.1; founder 11/10: xem dữ liệu = MÀN XEM + TẢI TỆP JSON).
 *
 * Giữ lời hứa của điều khoản mục `quyen`: **Xem** tụi mình đang giữ gì về bạn · **Tắt** phần nghiên cứu · **Xoá sạch sổ chi tiêu**.
 * Kể đúng thứ máy chủ trả (`GET /account/du-lieu`): hồ sơ dạng khoảng · từng ô đồng ý + số bản + vết bật/tắt · số trận · số dòng ghi
 * theo loại · số dòng telemetry · báo lỗi · dòng sổ máy chủ giữ. TẢI VỀ gom mọi trang dòng thô thành một tệp `.json` ngay trên máy.
 *
 * ⚠ XOÁ SẠCH SỔ phải với tới được kể cả khi khu Tài chính đang KHOÁ trên web (`PFM_WEB_MO`): điều khoản đã hứa, và người từng ghi sổ
 * trước khi khoá vẫn có dữ liệu. Thứ tự giữ y `CaiDatPfm`: MÁY CHỦ TRƯỚC, MÁY NÀY SAU (mất mạng giữa chừng không để lại "máy sạch, máy
 * chủ còn"). Mở kho bằng `moKhoChung` — không qua `KhoProvider`, nên không kéo theo driver đồng bộ.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, useMe } from '@/api/queries';
import { datNghienCuu, gomTepDuLieu, KHOA_DU_LIEU, luuTepJson, useDuLieuCuaToi } from '@/api/du_lieu';
import { xoaSachPfm } from '@/api/pfm';
import { moKhoChung } from '@/pfm/dung_kho';
import { xoaKhoChungCu } from '@/pfm/kho_idb';
import { AGE_BAND_LABELS, OCCUPATION_LABELS, REGION_LABELS } from '@/lib/labels';
import { formatDay } from '@/lib/time';
import { CHU_DU_LIEU, NHAN_LOAI_GHI, NHAN_VAN_BAN } from '@/lib/nghien_cuu_chu';
import { TamTruot } from '@/components/ui/TamTruot';
import { VanBanNghienCuu } from './VanBanNghienCuu';
import s from './TamDuLieu.module.css';

const BON_CUA = ['ket', 'dac_trung', 'thuong', 'noi_game'] as const;

export function TamDuLieuCuaToi({ mo, onDong }: { mo: boolean; onDong: () => void }): React.ReactElement | null {
  const qc = useQueryClient();
  const q = useDuLieuCuaToi(mo);
  // D603 — kho PFM theo tài khoản: phải biết là ai mới mở được kho của người đó.
  const chu = useMe().data?.user?.user_id ?? null;
  const [daGom, datDaGom] = useState<number | null>(null);
  const [chacXoa, datChacXoa] = useState(false);

  const doi = useMutation({
    mutationFn: (bat: boolean) => datNghienCuu(bat),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: KHOA_DU_LIEU });
    },
  });
  const tai = useMutation({
    mutationFn: async () => {
      datDaGom(0);
      const tep = await gomTepDuLieu(datDaGom);
      luuTepJson(`du-lieu-cua-toi-${new Date().toISOString().slice(0, 10)}.json`, tep);
    },
    onSettled: () => datDaGom(null),
  });
  const xoa = useMutation({
    mutationFn: async () => {
      await xoaSachPfm();
      if (chu !== null) await (await moKhoChung(chu)).xoaSach();
      // Kho CHUNG cũ (trước D603) cũng là sổ trên máy — cùng nếp `useXoaSachKho`: xoá luôn, không mở, không đọc.
      await xoaKhoChungCu();
    },
    onSuccess: () => {
      datChacXoa(false);
      void qc.resetQueries({ queryKey: ['pfm'] });
      void qc.invalidateQueries({ queryKey: queryKeys.me });
      void qc.invalidateQueries({ queryKey: KHOA_DU_LIEU });
    },
  });

  const d = q.data;
  const nhom = d
    ? [d.ho_so.age_band && (AGE_BAND_LABELS as Record<string, string>)[d.ho_so.age_band],
      d.ho_so.region && (REGION_LABELS as Record<string, string>)[d.ho_so.region],
      d.ho_so.occupation_band && (OCCUPATION_LABELS as Record<string, string>)[d.ho_so.occupation_band]]
      .filter(Boolean).join(' · ')
    : '';
  const tongPfm = d ? d.pfm_may_chu.reduce((a, x) => a + x.n, 0) : 0;
  const nghienCuuBat = doi.isPending ? doi.variables === true : d?.dong_y.nghien_cuu.bat === true;

  return (
    <TamTruot
      mo={mo}
      onDong={() => { datChacXoa(false); onDong(); }}
      nhan={CHU_DU_LIEU.nhan}
      dau="du-lieu-cua-toi"
      cao="lon"
      chan={d ? (
        <button type="button" className={s.nut} disabled={tai.isPending} onClick={() => tai.mutate()} data-nut="tai-du-lieu">
          {tai.isPending ? `${CHU_DU_LIEU.dangTai} ${daGom ?? 0}` : CHU_DU_LIEU.taiVe}
        </button>
      ) : undefined}
    >
      <h2 className={s.dau}>{CHU_DU_LIEU.tieuDe}</h2>
      <p className={s.mo}>{CHU_DU_LIEU.mo}</p>
      {q.isError && (
        <>
          <p className={s.loi} role="alert">{CHU_DU_LIEU.loiDoc}</p>
          <button type="button" className={s.nut} onClick={() => void q.refetch()}>{CHU_DU_LIEU.thuLai}</button>
        </>
      )}
      {tai.isError && <p className={s.loi} role="alert">{CHU_DU_LIEU.loiTai}</p>}
      {d && (
        <>
          <div className={s.nhom}>
            <span className={s.nhomTen}>{CHU_DU_LIEU.dongY}</span>
            <VanBanNghienCuu />
            <label className={s.congTac}>
              <input
                type="checkbox"
                checked={nghienCuuBat}
                disabled={doi.isPending}
                onChange={(e) => doi.mutate(e.target.checked)}
                data-o="cong-tac-nghien-cuu"
              />
              <span>{CHU_DU_LIEU.nghienCuu} — {nghienCuuBat ? CHU_DU_LIEU.dangBat : CHU_DU_LIEU.dangTat}</span>
            </label>
            {doi.isError && <p className={s.loi} role="alert">{CHU_DU_LIEU.loiTai}</p>}
            {BON_CUA.map((c) => (
              <div key={c} className={s.dong}>
                <span>{NHAN_VAN_BAN[`pfm_${c}`]}</span>
                <b>{d.dong_y.pfm[c] ? CHU_DU_LIEU.dangBat : CHU_DU_LIEU.dangTat}</b>
              </div>
            ))}
          </div>

          <div className={s.nhom}>
            <span className={s.nhomTen}>{CHU_DU_LIEU.vet}</span>
            {d.vet_dong_y.length === 0 ? <p className={s.phu}>{CHU_DU_LIEU.chuaCoVet}</p> : d.vet_dong_y.map((v, i) => (
              <div key={`${v.luc}-${i}`} className={s.dong} data-vet={v.loai}>
                <span>{NHAN_VAN_BAN[v.van_ban_id ?? ''] ?? v.van_ban_id ?? v.loai} · {formatDay(v.luc)}</span>
                <b>{NHAN_LOAI_GHI[v.loai] ?? v.loai}{v.phien_ban ? ` · ${v.phien_ban}` : ''}</b>
              </div>
            ))}
          </div>

          <div className={s.nhom}>
            <span className={s.nhomTen}>{CHU_DU_LIEU.hoSo}</span>
            {d.email && <div className={s.dong}><span>{CHU_DU_LIEU.email}</span><b>{d.email}</b></div>}
            <div className={s.dong}><span>{CHU_DU_LIEU.ten}</span><b>@{d.ho_so.handle}</b></div>
            <div className={s.dong}><span>{CHU_DU_LIEU.nhom}</span><b>{nhom || CHU_DU_LIEU.chuaKhai}</b></div>
            <div className={s.dong}><span>{CHU_DU_LIEU.thamGia}</span><b>{formatDay(d.ho_so.created_at)}</b></div>
          </div>

          <div className={s.nhom}>
            <span className={s.nhomTen}>{CHU_DU_LIEU.daGhi}</span>
            <div className={s.dong}><span>{CHU_DU_LIEU.soTran}</span><b data-so="tran">{d.so_tran}</b></div>
            <div className={s.dong}><span>{CHU_DU_LIEU.telemetry}</span><b data-so="telemetry">{d.telemetry}</b></div>
            <div className={s.dong}><span>{CHU_DU_LIEU.baoLoi}</span><b data-so="bao-loi">{d.bao_loi}</b></div>
            <div className={s.dong}><span>{CHU_DU_LIEU.pfmMayChu}</span><b data-so="pfm">{tongPfm}</b></div>
            <span className={s.phu}>{CHU_DU_LIEU.dongGhi}</span>
            {d.events.map((e) => (
              <div key={e.loai} className={s.dong} data-loai-ghi={e.loai}>
                <span>{NHAN_LOAI_GHI[e.loai] ?? e.loai}</span><b>{e.n}</b>
              </div>
            ))}
          </div>

          {!d.ho_so.la_khach && (
            <div className={s.nhom}>
              <span className={s.nhomTen}>{CHU_DU_LIEU.xoaSo}</span>
              <p className={s.phu}>{CHU_DU_LIEU.xoaSoGiai}</p>
              <button
                type="button"
                className={s.nutNguy}
                disabled={xoa.isPending}
                onClick={() => { if (chacXoa) xoa.mutate(); else datChacXoa(true); }}
                data-nut="xoa-so"
              >
                {chacXoa ? CHU_DU_LIEU.xoaSoChac : CHU_DU_LIEU.xoaSo}
              </button>
              {xoa.isSuccess && <p className={s.tot} role="status">{CHU_DU_LIEU.daXoaSo}</p>}
              {xoa.isError && <p className={s.loi} role="alert">{CHU_DU_LIEU.loiXoaSo}</p>}
            </div>
          )}
          <Link className={s.lienKet} to="/dieu-khoan">Điều khoản &amp; dữ liệu →</Link>
        </>
      )}
    </TamTruot>
  );
}
