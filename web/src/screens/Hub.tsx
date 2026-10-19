/**
 * HUB — KHUNG BENTO KHÔNG CUỘN (SPEC `docs/spec/ui-tang-khong-gian.md` đợt 1; demo CHỐT `docs/ui-ux/demo/hub-tang-khong-gian.html`,
 * founder 11/10: *"Hub này nét v** rồi đấy, bê nguyên lên web chính cũng được"*). Luật chung: `docs/ui-ux/09-tang-khong-gian.md`.
 *
 * ─── BA LỚP TRÊN TRỤC Z ───────────────────────────────────────────────────────────────────────────────────────────────
 *  NỀN (vignette, chỉ số tổng + hình khối) → Ô NỔI (`OBento`, bóng pixel cứng, MỘT việc chính khi chạm) → LỚP TRƯỢT (`TamTruot`,
 *  chi tiết · luồng nhiều bước, chỉ hiện khi chạm). Hai linh kiện nằm ở `components/ui/` DÙNG CHUNG — Alpha Draft và PFM dùng lại.
 *
 * ─── LỊCH SỬ LUẬT (đọc trước khi "dọn") ──────────────────────────────────────────────────────────────────────────────
 *  · 25/07 gỡ Oracle Core, 22/08 gỡ khối lộ trình: Hub từng là CỬA — *"không con số"* (§XIX: một số không in ở hai nơi).
 *  · 10/10 (SPEC mục 6) THAY luật ấy: **Hub CÓ SỐ nhưng 0 REQUEST MỚI**. Nguồn duy nhất của số: `/auth/me` (đã gọi) ·
 *    `KEY_LO_TRINH` (BottomNav đã gọi — cùng khoá cache nên Hub không thêm request) · sổ chi tiêu TRÊN MÁY (IndexedDB).
 *    Vẫn cấm in một số ở hai nơi: ví token nay ở ĐẦU SẢNH, nên route Hub tắt header chung của AppShell (`dauSanh`).
 *  · D86: Đấu trường đứng ĐẦU và to nhất; Predict hạ xuống ô nhỏ MỜ nhưng vẫn bấm được; Lab khoá, bấm ra lý do.
 *  · 10/10: việc chính 1 chạm (VÀO TRẬN); mô tả / lý do khoá / luồng nhiều bước dồn vào lớp trượt — KHÔNG còn chữ mô tả trên mặt ô.
 *
 * ─── TRẠNG THÁI KHÔNG ĐƯỢC NÓI DỐI (D62 · SPEC 5b.2) ─────────────────────────────────────────────────────────────────
 *  Đang tải = CHỖ GIỮ SẴN cùng khung (gạch, không số 0); lỗi = chữ nói rõ + nút thử lại; khách / chưa có sổ = icon, không số.
 *  Chunk nặng (banner bách khoa · sổ Tài chính) NẠP TRỄ: trong lúc về, ô giữ nguyên chiều cao.
 *
 * HUY HIỆU HẠNG ở đầu sảnh (founder 11/10 "thêm luôn cả rank", đúng demo: hạng + token bên phải) — `user.bac` của `/auth/me`
 *  (SPEC `huy-hieu-hang-sticker`); chưa xếp bậc (`null`) ⇒ không vẽ gì, không bậc giả (D62).
 */
import { Suspense, lazy, useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { useDiemDanh, useLoTrinh, type LoTrinhDTO } from '@/api/nhiem_vu';
import { Avatar, NutChinh, OBento, PixelIcon, TamTruot, useLunVung } from '@/components/ui';
import { docCheDo, ghiCheDo, type CheDoOTaiChinh } from '@/lib/hub_che_do';
import { CHU_HUB, NHAN_MUA } from '@/lib/hub_chu';
import { formatT } from '@/lib/money';
import {
  DESC_ARENA, DESC_FINANCE, DESC_PREDICT,
  NAME_ARENA_UPPER, NAME_FINANCE_UPPER, NAME_LAB_UPPER, NAME_PREDICT_UPPER,
  ROUTE_ARENA, ROUTE_HANH_TRINH, ROUTE_PREDICT, ROUTE_TAI_CHINH, ROUTE_TOKEN,
  TAGLINE_ARENA, TAGLINE_FINANCE, TAGLINE_LAB, TAGLINE_PREDICT, duongBachKhoa,
} from '@/lib/vocab';
import { ChunkBoundary } from './hub/ChunkBoundary';
import { Nac } from './hub/Nac';
import { RuotCho } from './hub/RuotCho';
import { TamDau } from './hub/TamDau';
import bn from './hub/HubBanner.module.css';
import o from './hub/HubO.module.css';
import t from './hub/HubTam.module.css';
import s from './Hub.module.css';
import { PFM_WEB_MO } from '@/lib/pfm_mo';
import { RuotNhuCauPfm } from './hub/NhuCauPfm';
import { HuyHieuHang } from '@/components/ui/HuyHieuHang';
import { nhanHuyHieu, type BacId } from '@config/rank';

/*
 * CHUNK NẠP TRỄ — cùng lý do với BachKhoa / SỔ ở `routes.tsx`: kho chữ bách khoa + lưới lá bài, và tầng PFM (kho IndexedDB), là thứ
 * người chỉ đến để bấm VÀO TRẬN không cần chờ. Hai thứ cùng một tệp nên Rollup gom thành MỘT chunk mỗi bên.
 */
const HubBanner = lazy(() => import('./hub/HubBanner'));
const NoiDungBachKhoa = lazy(() => import('./hub/HubBanner').then((m) => ({ default: m.NoiDungBachKhoa })));
const RuotTaiChinh = lazy(() => import('./hub/HubTaiChinh').then((m) => ({ default: m.RuotTaiChinh })));
const NoiDungTaiChinh = lazy(() => import('./hub/HubTaiChinh').then((m) => ({ default: m.NoiDungTaiChinh })));
const PfmXemTruoc = lazy(() => import('./hub/HubPfmXemTruoc').then((m) => ({ default: m.HubPfmXemTruoc })));

type TamLoai = 'arena' | 'predict' | 'lab' | 'mua' | 'finance' | 'nhu_cau';
type Tam = { k: TamLoai } | { k: 'bk'; id: string };

/** Một lớp trượt mở được bằng nút ĐÓNG mà không rời Hub. */
const NHAN_TAM: Record<TamLoai, string> = {
  arena: NAME_ARENA_UPPER,
  predict: NAME_PREDICT_UPPER,
  lab: NAME_LAB_UPPER,
  mua: NHAN_MUA,
  finance: NAME_FINANCE_UPPER,
  nhu_cau: NAME_FINANCE_UPPER,
};

// ─── ĐẦU SẢNH ──────────────────────────────────────────────────────────────────────────────────────────────────────

function ViToken({ cho, so }: { cho: boolean; so: number | null }): React.ReactElement {
  const { lun, bind } = useLunVung();
  return (
    <Link
      to={ROUTE_TOKEN}
      className={`${s.vi} ${lun ? s.lun : ''} ${cho ? s.viCho : ''}`}
      aria-label={CHU_HUB.viLabel}
      data-o="vi"
      {...bind}
    >
      <PixelIcon name="wallet" size={16} />
      {so === null ? '— T' : formatT(so)}
    </Link>
  );
}

/**
 * Việc tuần của payload `/me/nhiem-vu` — PHÒNG THỦ: API và bundle deploy bằng hai lệnh riêng, nên "máy chủ khác hình với web" là trạng
 * thái bình thường ở repo này. Hub nằm ở MỌI lần mở app; một payload lạ mà làm Hub ném lỗi là cả app thành màn lỗi. Thiếu/lạ ⇒ rỗng
 * (ô Mùa nói "CHƯA MỞ"), KHÔNG đoán số.
 */
function viecCua(d: LoTrinhDTO | undefined): LoTrinhDTO['viec'] {
  return d !== undefined && Array.isArray(d.viec) ? d.viec : [];
}

// ─── Ô MÙA ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function RuotMua({ lt }: { lt: ReturnType<typeof useLoTrinh> }): React.ReactElement {
  if (lt.isPending) {
    return (
      <>
        <span className={`${o.soTo} ${o.cho}`}>—</span>
        <span className={o.duoi}>{CHU_HUB.viecTuan}</span>
        <Nac day={0} so={4} />
        <span className={`${o.chip} ${o.xong}`}>{CHU_HUB.dangTai}</span>
      </>
    );
  }
  if (lt.isError) {
    return (
      <span className={o.loi}>
        <b>{CHU_HUB.loiTai}</b>
        <span>{lt.isFetching ? CHU_HUB.dangThuLai : CHU_HUB.chamThuLai}</span>
      </span>
    );
  }
  const d = lt.data;
  const viec = viecCua(d);
  const tong = viec.length;
  if (d.mua_mo !== true || tong === 0) {
    return (
      <span className={o.iconGiua}>
        <PixelIcon name="medal" size={48} />
        {CHU_HUB.muaChuaMo}
      </span>
    );
  }
  const xong = viec.filter((v) => v.xong).length;
  return (
    <>
      <span className={o.soTo}>{xong}<small>/{tong}</small></span>
      <span className={o.duoi}>{CHU_HUB.viecTuan}</span>
      <Nac day={xong} so={tong} />
      <span className={`${o.chip} ${d.da_diem_danh_hom_nay ? o.xong : ''}`}>
        {d.da_diem_danh_hom_nay ? CHU_HUB.daDiemDanh : CHU_HUB.diemDanh}
      </span>
    </>
  );
}

// ─── RUỘT LỚP TRƯỢT (trừ Tài chính + bách khoa: chunk) ─────────────────────────────────────────────────────────────

/** Ruột lớp trượt khi chunk nạp trễ hỏng: nói rõ + một nút TẢI LẠI (khung và nút ĐÓNG của lớp vẫn sống). */
function LoiChunkTam({ taiLai }: { taiLai: () => void }): React.ReactElement {
  return (
    <>
      <p className={t.loi}>{CHU_HUB.loiTai}</p>
      <button type="button" className={t.thuLai} onClick={taiLai}>{CHU_HUB.taiLai}</button>
    </>
  );
}

function RuotMuaTam({ lt, dd }: { lt: ReturnType<typeof useLoTrinh>; dd: ReturnType<typeof useDiemDanh> }): React.ReactElement {
  const d: LoTrinhDTO | undefined = lt.data;
  return (
    <>
      <TamDau icon={<PixelIcon name="medal" size={32} />} ten={NHAN_MUA} tag={CHU_HUB.muaTag} />
      <p className={t.tamMo}>{CHU_HUB.muaMoTa}</p>
      <div className={t.chiTiet}>
        {lt.isError && (
          <>
            <p className={t.loi}>{CHU_HUB.loiTai}</p>
            <button type="button" className={t.thuLai} disabled={lt.isFetching} onClick={() => void lt.refetch()}>
              {lt.isFetching ? CHU_HUB.dangThuLai : CHU_HUB.thuLai}
            </button>
          </>
        )}
        {viecCua(d).map((v) => (
          <div key={v.nv_id} className={t.dong}><span>{v.ten}</span><b>{v.da}/{v.muc}</b></div>
        ))}
        {dd.isError && <p className={t.loi}>{CHU_HUB.loiTai}</p>}
      </div>
    </>
  );
}

function RuotTamThuong({ k }: { k: 'arena' | 'predict' | 'lab' }): React.ReactElement {
  if (k === 'arena') {
    return (
      <>
        <TamDau icon={<PixelIcon name="arena" size={32} />} ten={NAME_ARENA_UPPER} tag={TAGLINE_ARENA.toUpperCase()} />
        <p className={t.tamMo}>{DESC_ARENA}</p>
      </>
    );
  }
  if (k === 'predict') {
    return (
      <>
        <TamDau icon={<PixelIcon name="chart" size={32} />} ten={NAME_PREDICT_UPPER} tag={TAGLINE_PREDICT.toUpperCase()} />
        <p className={t.tamMo}>{DESC_PREDICT}</p>
      </>
    );
  }
  return (
    <>
      <TamDau icon={<PixelIcon name="analyze" size={32} />} ten={NAME_LAB_UPPER} tag={TAGLINE_LAB.toUpperCase()} />
      {/* Lý do khoá NÓI THẲNG (sửa 15/08: "đóng băng có chủ đích" khác "sự cố" — mỗi ô khoá tự mang câu của nó). */}
      <p className={t.tamMo}>{CHU_HUB.labCho}</p>
    </>
  );
}

// ─── MÀN ───────────────────────────────────────────────────────────────────────────────────────────────────────────

export function Hub(): React.ReactElement {
  const navigate = useNavigate();
  const me = useMe();
  const lt = useLoTrinh();
  const dd = useDiemDanh();
  const user = me.data?.user ?? null;
  const khach = user?.la_khach === true;
  const coTaiKhoan = user !== null && !khach;
  const meXong = !me.isPending && !me.isError;

  const [tam, datTam] = useState<Tam>({ k: 'arena' });
  const [mo, datMo] = useState(false);
  const [che, datChe] = useState<CheDoOTaiChinh | null>(docCheDo);

  const moTam = useCallback((x: Tam) => { datTam(x); datMo(true); }, []);
  const dongTam = useCallback(() => datMo(false), []);
  /*
   * Lớp trượt KHÔNG sống sót qua đổi route: mọi route khác `/` gỡ cả Hub (state `mo` đi theo), nên Back/Forward/link trong lớp luôn trả
   * về một Hub với lớp ĐÓNG (bài canh: hub_bento «đổi route»). Không cần effect nghe `pathname` — nó sẽ là mã chết không bài nào giết được.
   * Chuyển màn một lần mỗi lần bấm do `NutChinh` (trễ 0,12 s + chặn đúp) và do router (bấm dồn vào cùng đích gộp thành một mục lịch sử).
   */
  const doiChe = useCallback((c: CheDoOTaiChinh) => { ghiCheDo(c); datChe(c); }, []);
  const thuLaiMua = useCallback(() => { if (!lt.isFetching) void lt.refetch(); }, [lt]);
  const thuLaiMe = useCallback(() => { if (!me.isFetching) void me.refetch(); }, [me]);

  // ── lớp trượt đang mở: nhãn · ruột · nút chính ──
  let ruot: ReactNode = null;
  let chan: ReactNode = null;
  let nhan: string = NHAN_TAM.arena;
  if (tam.k === 'bk') {
    nhan = 'Bách khoa';
    ruot = (
      <ChunkBoundary fallback={(taiLai) => <LoiChunkTam taiLai={taiLai} />}>
        <Suspense fallback={<p className={t.ghiChu}>{CHU_HUB.dangTai}</p>}>
          <NoiDungBachKhoa mucId={tam.id} onDoi={(id) => datTam({ k: 'bk', id })} />
        </Suspense>
      </ChunkBoundary>
    );
    chan = <NutChinh onChon={() => navigate(duongBachKhoa(tam.id))}>{CHU_HUB.moBachKhoa}</NutChinh>;
  } else {
    nhan = NHAN_TAM[tam.k];
    if (tam.k === 'nhu_cau') {
      ruot = (
        <>
          <TamDau icon={<PixelIcon name="vault" size={32} />} ten={NAME_FINANCE_UPPER} tag={TAGLINE_FINANCE.toUpperCase()} />
          <RuotNhuCauPfm />
        </>
      );
    } else if (tam.k === 'finance' && !PFM_WEB_MO) {
      // SPEC chan-truoc-beta — khu Tài chính KHOÁ trên web: nói thẳng vì sao, không nút vào khu, không nút nhận tiền.
      ruot = (
        <>
          <TamDau icon={<PixelIcon name="vault" size={32} />} ten={NAME_FINANCE_UPPER} tag={CHU_HUB.taiChinhKhoaNhan.toUpperCase()} />
          <p className={t.tamMo}>{CHU_HUB.taiChinhKhoa}</p>
          <p className={t.ghiChu}>{CHU_HUB.taiChinhKhoaMo}</p>
          {/* Link nhu cầu PFM (SPEC khao-sat-nhu-cau-pfm) ở TRONG lớp, không chen dưới ô — ô giữ đúng bố cục demo (founder 11/10). */}
          <button type="button" className={s.linkNho} data-nut="nhu-cau-pfm" onClick={() => datTam({ k: 'nhu_cau' })}>
            {CHU_HUB.nhuCauPfm}
          </button>
        </>
      );
    } else if (tam.k === 'finance') {
      if (coTaiKhoan) {
        ruot = (
          <ChunkBoundary fallback={(taiLai) => <LoiChunkTam taiLai={taiLai} />}>
            <Suspense fallback={<p className={t.ghiChu}>{CHU_HUB.dangTai}</p>}>
              <NoiDungTaiChinh che={che} onChe={doiChe} />
            </Suspense>
          </ChunkBoundary>
        );
        chan = <NutChinh onChon={() => navigate(ROUTE_TAI_CHINH)}>{CHU_HUB.moTaiChinh}</NutChinh>;
      } else {
        ruot = (
          <>
            <TamDau icon={<PixelIcon name="vault" size={32} />} ten={NAME_FINANCE_UPPER} tag={TAGLINE_FINANCE.toUpperCase()} />
            <p className={t.tamMo}>{DESC_FINANCE}</p>
            <p className={t.ghiChu}>{CHU_HUB.khachTaiChinh}</p>
          </>
        );
      }
    } else if (tam.k === 'mua') {
      ruot = <RuotMuaTam lt={lt} dd={dd} />;
      const chuaDD = lt.data?.mua_mo === true && !lt.data.da_diem_danh_hom_nay;
      chan = (
        <>
          {chuaDD && (
            <NutChinh disabled={dd.isPending} onChon={() => dd.mutate()}>
              {dd.isPending ? CHU_HUB.dangDiemDanh : dd.isError ? CHU_HUB.thuLai : CHU_HUB.nhanDiemDanh}
            </NutChinh>
          )}
          <NutChinh onChon={() => navigate(ROUTE_HANH_TRINH)}>{CHU_HUB.xemHanhTrinh}</NutChinh>
        </>
      );
    } else {
      ruot = <RuotTamThuong k={tam.k} />;
      if (tam.k === 'arena') chan = <NutChinh onChon={() => navigate(ROUTE_ARENA)}>{CHU_HUB.vaoTran}</NutChinh>;
      else if (tam.k === 'predict') chan = <NutChinh onChon={() => navigate(ROUTE_PREDICT)}>{CHU_HUB.moCho}</NutChinh>;
    }
  }

  return (
    <div className={s.hub}>
      {/* LỚP NỀN */}
      <div className={s.nen} aria-hidden="true" />
      <div className={s.khung}>
        {/* ── ĐẦU SẢNH: người chơi sát trái · tài sản phải ── */}
        <div className={s.dau}>
          <span className={s.anh}>
            {coTaiKhoan
              ? <Avatar dm={user?.dien_mao} size={32} alt="" />
              : meXong ? <PixelIcon name="hall" size={32} /> : null}
          </span>
          <span className={s.nguoi}>
            {me.isError ? (
              <>
                <span className={`${s.ten} ${s.loiMe}`}>{CHU_HUB.loiMe}</span>
                <button type="button" className={s.thuLaiNho} disabled={me.isFetching} onClick={thuLaiMe}>
                  {me.isFetching ? CHU_HUB.dangThuLai : CHU_HUB.thuLai}
                </button>
              </>
            ) : (
              <>
                <span className={`${s.ten} ${meXong ? '' : s.tenCho}`}>
                  {user === null ? (meXong ? CHU_HUB.khach : '—') : khach ? CHU_HUB.khach : user.handle}
                </span>
                <span className={s.phu}>
                  {user === null && !meXong ? ' ' : khach || user === null ? CHU_HUB.khachPhu : NHAN_MUA}
                </span>
              </>
            )}
          </span>
          <span className={s.taiSan}>
            {/* HUY HIỆU HẠNG — bậc server đã tính (`user.bac`), cùng component với Hồ sơ; chưa xếp bậc ⇒ ẩn (không hạng giả). */}
            <span className={s.choHuyHieu} data-cho="huy-hieu" hidden={!coTaiKhoan || !user?.bac}>
              {coTaiKhoan && user?.bac
                ? <HuyHieuHang bac={user.bac as BacId} size={40} nhan={nhanHuyHieu(user.bac as BacId)} />
                : null}
            </span>
            <ViToken cho={user === null} so={user?.bankroll ?? null} />
          </span>
          {/* Ô GIỮ SẴN CHO ORACLE (xem `OracleChat` chế độ `neoCho`): sát mép phải, KHÔNG nút/ô bấm nào trong đó — avatar Oracle nằm
              đúng chỗ này nên không bao giờ che VÀO TRẬN hay ô nào khác. Vị trí độc lập với dữ liệu (đứng cuối hàng, rộng cố định). */}
          <span className={s.choOracle} data-oracle-cho aria-hidden="true" />
        </div>

        {/* ── LƯỚI BENTO ── */}
        <div className={s.luoi}>
          {/* ĐẤU TRƯỜNG 2×2: banner (chạm = bài bách khoa) + VÀO TRẬN (1 chạm). Giữ 0,45 s ngoài hai đích ấy = thông tin. */}
          <OBento as="div" noiBat className={s.oTran} dau="arena" onGiu={() => moTam({ k: 'arena' })}>
            <span className={s.nhanDong}><PixelIcon name="arena" size={16} />{NAME_ARENA_UPPER}</span>
            {/* Khung banner dựng sẵn cùng chiều cao trong lúc chunk về; chunk hỏng thì khung ở lại, nói rõ + TẢI LẠI. */}
            <ChunkBoundary
              fallback={(taiLai) => (
                <div className={`${bn.banner} ${s.bannerHong}`}>
                  <span className={o.loi}>
                    <b>{CHU_HUB.loiTai}</b>
                    <button type="button" className={s.thuLaiNho} onClick={taiLai}>{CHU_HUB.taiLai}</button>
                  </span>
                </div>
              )}
            >
              <Suspense fallback={<div className={bn.banner} aria-hidden="true" />}>
                <HubBanner tamMo={mo} onMo={(id) => moTam({ k: 'bk', id })} />
              </Suspense>
            </ChunkBoundary>
            <NutChinh dau="vao-tran" onChon={() => navigate(ROUTE_ARENA)}>{CHU_HUB.vaoTran}</NutChinh>
          </OBento>

          <div className={s.cotPhai}>
            {!PFM_WEB_MO ? (
              /*
               * SPEC chan-truoc-beta — khu Tài chính KHOÁ (`lib/pfm_mo.ts`). Founder 11/10: GIỮ icon cũ (két 48 px) và khoá ĐÚNG CƠ CHẾ ô
               * Lab — mờ + ổ khoá góc, chạm = lắc rồi bung lớp nói lý do + link nhu cầu PFM. Không nạp ruột sổ ⇒ không mở kho, không driver.
               */
              <OBento mo khoa nhan={CHU_HUB.taiChinhKhoaNhan} dau="tai-chinh" onChon={() => moTam({ k: 'finance' })}>
                <span className={o.nhan}>{CHU_HUB.taiChinh}</span>
                {/* Founder 11/10: khoá nhưng HIỆN bản xem trước xoay vòng (hành tinh tính cách · SỔ · HŨ · GƯƠNG) — chunk nạp trễ,
                    trong lúc về vẫn là két cũ (ô giữ nguyên khung). */}
                <ChunkBoundary fallback={() => <span className={o.iconGiua}><PixelIcon name="vault" size={48} /></span>}>
                  <Suspense fallback={<span className={o.iconGiua}><PixelIcon name="vault" size={48} /></span>}>
                    <PfmXemTruoc tamMo={mo} />
                  </Suspense>
                </ChunkBoundary>
                <span className={s.khoaGoc}><PixelIcon name="lock" size={16} /></span>
              </OBento>
            ) : (
            <OBento nhan="Chi tiết Tài chính" dau="tai-chinh" onChon={() => moTam({ k: 'finance' })}>
              <span className={o.nhan}>{CHU_HUB.taiChinh}</span>
              {user === null && meXong || khach ? (
                <span className={o.iconGiua}>
                  <PixelIcon name="vault" size={48} />
                  {CHU_HUB.canTaiKhoan}
                </span>
              ) : (
                <ChunkBoundary
                  fallback={() => (
                    <span className={o.loi}><b>{CHU_HUB.loiTai}</b><span>{CHU_HUB.chamDeXem}</span></span>
                  )}
                >
                  <Suspense fallback={<RuotCho />}>
                    {coTaiKhoan ? <RuotTaiChinh che={che} /> : <RuotCho />}
                  </Suspense>
                </ChunkBoundary>
              )}
            </OBento>
            )}

            <OBento nhan="Chi tiết Mùa" dau="mua" onChon={() => (lt.isError ? thuLaiMua() : moTam({ k: 'mua' }))}>
              <span className={o.nhan}>{NHAN_MUA}</span>
              <RuotMua lt={lt} />
            </OBento>
          </div>

          <div className={s.hangNho}>
            <OBento
              mo
              className={s.oNho}
              nhan={CHU_HUB.predictGiu}
              dau="predict"
              onChon={() => navigate(ROUTE_PREDICT)}
              onGiu={() => moTam({ k: 'predict' })}
            >
              <PixelIcon name="chart" size={32} />
              <span className={s.tenNho}>{CHU_HUB.predict}</span>
            </OBento>
            <OBento mo khoa className={s.oNho} nhan={CHU_HUB.labKhoa} dau="lab" onChon={() => moTam({ k: 'lab' })}>
              <PixelIcon name="analyze" size={32} />
              <span className={s.tenNho}>{CHU_HUB.lab}</span>
              <span className={s.khoaIcon}><PixelIcon name="lock" size={16} /></span>
            </OBento>
          </div>
        </div>

        {/*
          ⚠⚠ KHÁCH CŨNG PHẢI THẤY CỬA NÀY (founder 04/08): khách CÓ `user` nên điều kiện `!user` một mình giấu mất lối thoát
          khỏi chế độ khách — đúng với người đang ở trong nó (và trong Discord AI CŨNG là khách). `la_khach` mới có trong
          `/auth/me`; vắng ⇒ coi như KHÔNG phải khách, không mọc lời mời thừa cho người đã có tài khoản.
          Nút nằm TRONG khung (không đẩy khung dài ra); dòng "chỉ lưu trên máy này" nay ở ĐẦU SẢNH.
        */}
        {meXong && (user === null || khach) && (
          <OBento className={s.dangKy} dau="dang-ky" onChon={() => navigate('/onboard')}>
            {khach ? CHU_HUB.dangKyGiu : CHU_HUB.dangNhap}
          </OBento>
        )}
        <p className={s.mienTru}>{CHU_HUB.mienTru}</p>
      </div>

      {/* ── LỚP TRƯỢT: một khung duy nhất, ruột đổi theo ô vừa chạm ── */}
      <TamTruot mo={mo} onDong={dongTam} nhan={nhan} chan={chan} dau={tam.k} cao={tam.k === 'finance' && coTaiKhoan ? 'lon' : 'vua'}>
        {ruot}
      </TamTruot>
    </div>
  );
}
