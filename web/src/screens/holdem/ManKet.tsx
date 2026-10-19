/**
 * MÀN KẾT TRẬN — BENTO KHÔNG CUỘN (SPEC `docs/spec/alpha-draft-tang-khong-gian.md` phần A; demo CHỐT
 * `docs/ui-ux/demo/alpha-draft-tang-khong-gian.html`, founder 11/10). Tách khỏi `AlphaDraftMatch.tsx` (nhánh `sanSangKet`) để màn trận
 * 4000 dòng không phải chở thêm một khung bố cục; mọi DỮ LIỆU vẫn từ `GET /holdem/matches/:id/autopsy` (server trả ID + số, chữ ở client).
 *
 * Một khung KHÔNG cuộn: **ô của mình** (hạng · vốn · lá đã cầm) + **ô PHONG CÁCH lớn nhất** (founder 13/09: *"phong cách cá nhân phải là nổi bật
 * nhất để flex"* — thanh chấm điểm THẬT của `PhongCachKet`, thang E→SSS, không phải thanh tĩnh của demo) + **bốn ô nhỏ** (LẬT BÀI · BẢN ĐỒ ·
 * KHOE · ĐỘI) → mỗi ô chạm là MỘT lớp trượt (`TamTruot` dùng chung với Hub — A11.5). VỀ SẢNH ở đáy (nút chính).
 *
 * Mọi khối của màn kết cũ còn tới được trong ≤ 1 chạm (SPEC mục 5): ghế mình · phong cách + GHI VÀO THẺ + HÔM NAY VỪA CHẠM (lớp PHONG CÁCH) ·
 * lật bài · bản đồ trận · thẻ kết trận · dấu mốc + ĐỘI/thử thách ngày.
 *
 * ⚠ GIỮ KIỂU LÁ HIỆN CÓ của game (founder 11/10): `LaNho` nền tối, viền họ màu — mặt giấy kem chưa đổi.
 * ⚠ Ô của mình KHÔNG có hạng huy hiệu (cửa sổ huy hiệu gắn sau — `docs/spec/huy-hieu-hang-sticker.md`); không vẽ hạng giả.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  dinhDangChip, linkBan, type AutopsyDTO, type BanDTO, type CatalogDTO, type NhiemVuKyNgoDTO,
} from '@/api/holdem';
import type { NangLucId } from '@config/nang_luc';
import { DauMocKhoi } from '@/components/holdem/DauMoc';
import { DoiBan } from '@/components/holdem/DoiBan';
import { GheAvatarKet } from '@/components/holdem/BotAvatar';
import { GhiVaoThe } from '@/components/holdem/GhiVaoThe';
import { LaNho } from '@/components/holdem/LaNho';
import { PhaoGiay } from '@/components/holdem/PhaoGiay';
import { PhongCachKet } from '@/components/holdem/PhongCachKet';
import { TheKetTran } from '@/components/holdem/TheKetTran';
import { DauKyNangTinh, laIdKyNang } from '@/components/HangKyNang';
import { NutChinh, OBento, PixelIcon, TamTruot, type PixelIconName } from '@/components/ui';
import { CHU_CHE_DO_TESTER } from '@/lib/buoi_do_chu';
import { CHU_KET } from '@/lib/sanh_chu';
import { THE_KHOANH_KHAC } from '@/lib/khoanh_khac';
import { TamDau } from '@/screens/hub/TamDau';
import t from '@/screens/hub/HubTam.module.css';
import s from './ManKet.module.css';

type Ghe = AutopsyDTO['xep_hang'][number];
type TamLoai = 'tay' | 'pc' | 'lat' | 'ban' | 'khoe' | 'doi';

const iconKyNgo = (x: string): x is 'target' | 'chart' | 'bolt' | 'candle' =>
  x === 'target' || x === 'chart' || x === 'bolt' || x === 'candle';
/** Tên con đường tra TỪ CATALOG, không gõ lại bảng bốn nhiệm vụ ở client (D61). */
const tenDuong = (icon: string, bang: readonly NhiemVuKyNgoDTO[] | undefined) =>
  bang?.find((x) => x.icon === icon)?.ten ?? '';

export interface ManKetProps {
  du: AutopsyDTO;
  cat: CatalogDTO;
  /** Art lá (server cấp, `useHoldemArt`) — vắng thì lá chỉ có tên. */
  art: Record<string, string> | undefined;
  /** Số ô của trận (`st.tong_vong`) — in lên thẻ khoe. */
  tongVong: number;
  /** Mã bàn chung/bàn ngày của trận (nếu có). */
  banMa: string | null;
  /** Bảng đội của bàn chung (GHOST cho đường NAV ở thẻ khoe). */
  doiBan: BanDTO['doi'] | undefined;
  onVeSanh: () => void;
}

export function ManKet({ du, cat: c, art, tongVong, banMa, doiBan, onVeSanh }: ManKetProps): React.ReactElement {
  const [tam, datTam] = useState<TamLoai>('tay');
  const [mo, datMo] = useState(false);
  const moTam = (x: TamLoai): void => { datTam(x); datMo(true); };

  /*
   * Khung không-cuộn cần `min-height` của vỏ = `100dvh` (không phải `100vh`: thanh địa chỉ trình duyệt làm `vh` > `dvh` ⇒ trang cuộn thừa).
   * AppShell không biết trận đã kết (cùng một route với bàn đấu) ⇒ đánh dấu ở gốc tài liệu khi màn này đang sống; `AppShell.module.css`
   * đọc `html[data-man-ket]`. Dọn khi rời màn — bàn đấu thường không bị ảnh hưởng.
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-man-ket', '');
    return () => document.documentElement.removeAttribute('data-man-ket');
  }, []);

  const xep = du.xep_hang;
  const toi = xep.find((h) => h.ghe_id === 'ban');
  const conLai = xep.filter((h) => h.ghe_id !== 'ban');
  const thang = toi?.hang === 1;
  const soTinGia = du.map_da_lo.filter((o) => o.kind === 'su_kien' && o.la_tin_gia).length;
  const tenTaiSan = (id: string): string => c.tai_san.find((x) => x.id === id)?.label ?? id;
  const tenLoi = (id: string): string => c.chien_thuat.find((x) => x.id === id)?.label ?? id;

  const veLa = (h: Ghe, gon: boolean): ReactNode => (
    [...h.danh_muc.tai_san, ...h.danh_muc.chien_thuat].length === 0 ? (
      <span className={s.laTrong}>{CHU_KET.khongCamLa}</span>
    ) : (
      <>
        {h.danh_muc.tai_san.map((id, i) => <LaNho key={`t-${id}-${i}`} id={id} art={art} ten={tenTaiSan(id)} gon={gon} />)}
        {h.danh_muc.chien_thuat.map((id, i) => <LaNho key={`c-${id}-${i}`} id={id} art={art} ct ten={tenLoi(id)} gon={gon} />)}
      </>
    )
  );
  const veDuong = (h: Ghe): ReactNode => (
    h.ky_ngo_icon && iconKyNgo(h.ky_ngo_icon) ? (
      <span className={s.chip}>
        <PixelIcon name={h.ky_ngo_icon} size={8} />
        {tenDuong(h.ky_ngo_icon, c.nhiem_vu_ky_ngo)}
      </span>
    ) : null
  );

  // ── ghế mình ──
  const pnl = toi ? Math.round(((toi.von - c.luat.START_VON) / c.luat.START_VON) * 100) : 0;
  const diem = toi && toi.diem_sau !== null && toi.diem_sau !== undefined ? toi.diem_sau - (toi.diem_truoc ?? 0) : null;
  const dongDiem = toi
    ? (diem === null
      ? CHU_KET.dauTuDo
      : `${diem >= 0 ? '+' : ''}${diem} điểm · thu từ ${toi.hang ? xep.length - toi.hang : 0} người xếp dưới`)
    : '';

  // ── GHI VÀO THẺ (dải kỹ năng + vừa chạm) — nằm TRONG lớp PHONG CÁCH ──
  const ghiVaoThe = du.the_dang_giu === true ? (
    <p className={s.theDangGiu} data-testid="the-dang-giu">{CHU_CHE_DO_TESTER.theDangGiu}</p>
  ) : (
    <GhiVaoThe the={du.nang_luc} khoanhKhac={du.khoanh_khac} rieng={!du.phong_cach} />
  );

  /** Lá mình cầm: tài sản trước, lõi (chiến thuật) sau — cùng thứ tự `veLa`. */
  const laCam = toi
    ? [...toi.danh_muc.tai_san.map((id) => ({ id, ct: false })), ...toi.danh_muc.chien_thuat.map((id) => ({ id, ct: true }))]
    : [];

  /** Ba dấu kỹ năng của trận, TĨNH (không nút — ô PHONG CÁCH là một nút, không lồng nút trong nút): cùng hình với dải GHI VÀO THẺ trong lớp. */
  const kyNang = du.the_dang_giu === true ? [] : (du.nang_luc?.nang_luc ?? []).filter((n): n is typeof n & { id: NangLucId } => laIdKyNang(n.id));
  const dauKy = kyNang.length > 0
    ? <div className={s.dauKy}>{kyNang.map((n) => <DauKyNangTinh key={n.id} id={n.id} bac={n.bac} />)}</div>
    : null;

  // ── RUỘT LỚP TRƯỢT ──
  let ruot: ReactNode;
  let nhan: string = CHU_KET.hangPhongCach;
  if (tam === 'tay' && toi) {
    nhan = `Hạng ${toi.hang}/${xep.length}`;
    ruot = (
      <>
        <TamDau
          icon={<GheAvatarKet loai={toi.loai} ten={toi.ten} laToi size={32} />}
          ten={`HẠNG ${toi.hang}/${xep.length}`}
          tag={toi.vong_chay ? `${CHU_KET.chay} · VÒNG ${toi.vong_chay}` : dongDiem.toUpperCase()}
        />
        <div className={t.chiTiet}>
          <p className={t.chonDau}>{CHU_KET.layBai}</p>
          {laCam.length === 0
            ? <p className={t.ghiChu}>{CHU_KET.khongCamLa}</p>
            : laCam.map(({ id, ct }, i) => (
              <div key={`${id}-${i}`} className={t.dong}>
                <span className={s.dongLa}><LaNho id={id} art={art} ct={ct} gon ten={ct ? tenLoi(id) : tenTaiSan(id)} />{ct ? tenLoi(id) : tenTaiSan(id)}</span>
                <b>{ct ? 'lõi' : 'tài sản'}</b>
              </div>
            ))}
          {veDuong(toi) !== null && <div className={t.dong}><span>ĐƯỜNG KỲ NGỘ</span><b>{tenDuong(toi.ky_ngo_icon ?? '', c.nhiem_vu_ky_ngo)}</b></div>}
          <div className={t.dong}><span>BẬC</span><b>{toi.bac_rank}</b></div>
        </div>
      </>
    );
  } else if (tam === 'pc') {
    ruot = du.phong_cach
      ? <PhongCachKet pc={du.phong_cach}>{ghiVaoThe}</PhongCachKet>
      : ghiVaoThe;
  } else if (tam === 'lat') {
    nhan = CHU_KET.lat;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="user" size={32} />} ten={CHU_KET.lat} tag={`${conLai.length} ${CHU_KET.conLaiGhe.toUpperCase()}`} />
        <div className={t.chiTiet}>
          {conLai.map((h) => (
            <div key={h.ghe_id} className={s.gheLat}>
              <div className={t.dong}>
                <span className={s.gheTen}>
                  <b>{h.hang}</b>
                  <GheAvatarKet loai={h.loai} ten={h.ten} laToi={false} size={32} />
                  <span>{h.ten}<i className={s.bac}>{h.bac_rank}</i></span>
                </span>
                <span className={t.vang}>
                  <PixelIcon name="coin" size={8} /> {dinhDangChip(h.von)}
                </span>
              </div>
              <div className={s.hangLa}>
                {h.vong_chay ? <span className={`${s.chip} ${s.chipChay}`}>{CHU_KET.chay} · VÒNG {h.vong_chay}</span> : null}
                {veDuong(h)}
                {veLa(h, true)}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  } else if (tam === 'ban') {
    nhan = CHU_KET.banDoTen;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="news" size={32} />} ten={CHU_KET.banDoTen} tag={`${du.map_da_lo.length} Ô · ${soTinGia} TIN BỊA`} />
        <div className={s.banDo}>
          {du.map_da_lo.map((o, i) => {
            const sk = o.kind === 'su_kien';
            const gia = sk && o.la_tin_gia === true;
            const ten = sk
              ? (c.su_kien.find((e) => e.id === o.su_kien)?.label ?? String(o.su_kien ?? '?'))
              : (c.giai_doan.find((g) => g.id === o.giai_doan)?.label ?? String(o.giai_doan ?? '?'));
            return (
              <span key={i} className={`${s.oMap} ${sk ? s.oMapSk : ''} ${gia ? s.oMapGia : ''}`}>
                <b className={s.oMapSo}>{i + 1}</b>
                <span className={s.oMapTen}>{ten}</span>
                {gia && <span className={s.oMapDau}>{CHU_KET.tinGia}</span>}
              </span>
            );
          })}
        </div>
        <p className={t.tamMo}><b>{soTinGia}</b> {CHU_KET.tinGiaNoi}</p>
      </>
    );
  } else if (tam === 'khoe') {
    nhan = CHU_KET.theKetTran;
    ruot = (
      <TheKetTran du={{
        hang: toi?.hang ?? xep.length,
        tong: xep.length,
        nav: toi?.von ?? c.luat.START_VON,
        navDau: c.luat.START_VON,
        duong: (du.nav_theo_vong ?? []).map((v) => v.nav.ban ?? 0),
        /*
         * Nền của đường mình: các ghế máy trong trận + GHOST bạn cùng bàn (server chỉ gửi khi mình đã chốt xong — A3.1).
         * Ghost là thứ biến "bàn chung" thành một cái đề có người khác đã làm.
         */
        daiDoiThu: [
          ...xep.filter((h) => h.ghe_id !== 'ban').map((h) => (du.nav_theo_vong ?? []).map((v) => v.nav[h.ghe_id] ?? 0)),
          ...(doiBan ?? []).filter((m) => !m.la_toi && Array.isArray(m.duong)).map((m) => m.duong!),
        ].filter((d) => d.length > 0),
        conDuong: (du.ky_ngo ?? []).filter((k) => k.chon).map((k) => ({
          ten: c.nhiem_vu_ky_ngo?.find((n) => n.id === k.chon)?.ten ?? String(k.chon),
          xong: k.xong_o_vong !== null && k.xong_o_vong !== undefined,
        })),
        daCham: (du.khoanh_khac ?? [])
          .map((k) => THE_KHOANH_KHAC[k.id as keyof typeof THE_KHOANH_KHAC]?.ten)
          .filter((x): x is string => !!x),
        banMa,
        soO: tongVong,
        link: banMa ? linkBan(banMa) : `${window.location.origin}/arena`,
      }} />
    );
  } else {
    nhan = CHU_KET.dauMocDoi;
    ruot = (
      <>
        <TamDau icon={<PixelIcon name="shield" size={32} />} ten={CHU_KET.dauMocDoi} tag={banMa ? `BÀN ${banMa.toUpperCase()}` : CHU_KET.doiPhu.toUpperCase()} />
        {/* DẤU MỐC KỸ NĂNG (§5.1) — ghi nhận VỀ SAU: khen kỹ năng, không khen tư thế rủi ro (§1.2), không kê đơn (A10). Rỗng ⇒ im. */}
        <DauMocKhoi danhSach={du.dau_moc} />
        {/* BÀN CHUNG (16/08): bảng ĐỘI — số người khác lộ SAU khi mình xong (server quyết, A3.1). Bàn ngày: phân vị, không tên (D32). */}
        <DoiBan ma={banMa} />
      </>
    );
  }

  const oNho: { k: TamLoai; ten: string; phu: string; icon: PixelIconName }[] = [
    { k: 'lat', ten: CHU_KET.lat, phu: `${conLai.length} ghế`, icon: 'user' },
    { k: 'ban', ten: CHU_KET.ban, phu: `${soTinGia} tin bịa`, icon: 'news' },
    { k: 'khoe', ten: CHU_KET.khoe, phu: CHU_KET.khoePhu, icon: 'medal' },
    { k: 'doi', ten: CHU_KET.doi, phu: CHU_KET.doiPhu, icon: 'shield' },
  ];

  return (
    <div className={s.ket} data-testid="man-ket">
      {/*
        §XII — pháo giấy CHỈ khi thắng. Bắn cho hạng 4 là chế nhạo người chơi. Component tự tôn trọng reduced-motion và tự dọn hạt sau khi rơi.
      */}
      <PhaoGiay bat={thang} />
      <div className={s.nen} aria-hidden="true" />
      <div className={s.khung}>
        <div className={s.luoi}>
          {/* ── Ô CỦA MÌNH: hạng · vốn · lá đã cầm ── */}
          {toi && (
            <OBento className={s.oToi} nhan="Chi tiết kết quả của bạn" dau="toi" onChon={() => moTam('tay')}>
              <span className={s.cotTrai}><GheAvatarKet loai={toi.loai} ten={toi.ten} laToi size={64} /></span>
              <span className={s.cotPhai} data-testid="ket-toi">
                <span className={`${s.hangTo} ${thang ? s.thang : ''}`}>
                  {/* Huy chương trên lưới 16 hàng ⇒ cỡ là bội số của 16, cỡ lẻ bị làm tròn IM LẶNG. */}
                  {thang && <PixelIcon name="medal" size={32} />}
                  {toi.hang}<small>/{xep.length}</small>
                </span>
                <span className={s.von}>
                  <PixelIcon name="coin" size={8} />
                  <b>{dinhDangChip(toi.von)}</b>
                  <i className={pnl >= 0 ? s.lai : s.lo}>{pnl >= 0 ? '+' : ''}{pnl}%</i>
                </span>
                <span className={s.tay}>{veLa(toi, true)}</span>
                <span className={s.dongChip}>
                  {toi.vong_chay
                    ? <span className={`${s.chip} ${s.chipChay}`}>{CHU_KET.chay} · VÒNG {toi.vong_chay}</span>
                    : <span className={`${s.chip} ${diem === null ? '' : s.chipVang}`}>{dongDiem}</span>}
                </span>
              </span>
            </OBento>
          )}

          {/* ── Ô PHONG CÁCH — lớn nhất: hạng E→SSS + thanh chấm điểm thật + ba trục ── */}
          <OBento className={s.oPc} nhan="Chi tiết phong cách cả trận" dau="pc" onChon={() => moTam('pc')}>
            {du.phong_cach
              ? <PhongCachKet pc={du.phong_cach} gon>{dauKy}</PhongCachKet>
              : <span className={s.khongPc}><span className={s.nhan}>{CHU_KET.hangPhongCach}</span><span className={s.duoi}>trận này chưa có hạng phong cách</span></span>}
          </OBento>

          {/* ── BỐN Ô NHỎ → bốn lớp trượt ── */}
          {oNho.map((o) => (
            <OBento key={o.k} className={s.oNho} nhan={o.ten} dau={o.k} onChon={() => moTam(o.k)}>
              <PixelIcon name={o.icon} size={32} />
              <b className={s.tenNho}>{o.ten}</b>
              <span className={s.phuNho}>{o.phu}</span>
            </OBento>
          ))}
        </div>

        <NutChinh dau="ve-sanh" onChon={onVeSanh}>{CHU_KET.veSanh}</NutChinh>
      </div>

      <TamTruot mo={mo} onDong={() => datMo(false)} nhan={nhan} dau={tam} cao={tam === 'khoe' || tam === 'pc' ? 'lon' : 'vua'}>
        {ruot}
      </TamTruot>
    </div>
  );
}
