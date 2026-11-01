/**
 * CỔNG CÀI APP — `/cai-app` (SPEC `docs/spec/cai-app-pfm-trong-ban-cai.md` mục 4, E2–E5; D603 đợt 2).
 *
 * Một màn, ruột đổi theo NƠI app đang chạy (`lib/cai_app.ts` — nhận diện chỉ để chọn CÂU, không để chặn):
 *   · iPhone/iPad      — ba bước có hình (Apple không cho web tự mời cài) + dòng E3 "Đã cài rồi?…".
 *   · Android/máy tính — một chạm qua `beforeinstallprompt` (`lib/moi_cai.ts`); trình duyệt chưa mời được ⇒ đường lui qua menu;
 *                        cài xong (`appinstalled`) ⇒ nút MỞ APP + câu lui (E4).
 *   · nhúng / trình duyệt không cài được — "Mở bằng Chrome/Safari" + chép link, link HIỆN bằng chữ để nhấn giữ chép tay (E2).
 *   · Discord Activity — mở ngoài Discord (E5).
 *   · đang trong bản cài — nói thẳng là đã mở, một nút vào Tài chính.
 * Đây là đích của mọi `/tai-chinh/*` khi đang ở tab trình duyệt (`CongPfm` ở `app/routes.tsx`) và của nút ở màn đăng nhập.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { Mascot } from '@/components/Mascot';
import { NutChinh } from '@/components/ui';
import { PixelLuoi } from '@/components/ui/PixelIcon';
import { daCai, moiTruongHienTai } from '@/lib/cai_app';
import { CHU_CAI_APP as C, tenAppNhung } from '@/lib/cai_app_chu';
import { chepLink, doHien, linkApp, moiCai, useMoiCai, type NoiMoiCai } from '@/lib/moi_cai';
import { ROUTE_HUB, ROUTE_TAI_CHINH } from '@/lib/vocab';
import s from './CongCaiApp.module.css';

const NOI_HOP_LE: readonly NoiMoiCai[] = ['cong_pfm', 'dang_nhap', 'hub', 'bang_nhung'];

// prettier-ignore
/** Nút Chia sẻ của iOS: ô vuông hở miệng, mũi tên lên. Lưới riêng của màn (nạp trễ cùng màn — không vào `GRIDS` của gói chung). */
const LUOI_CHIA_SE = [
  '.......SS.......',
  '......SSSS......',
  '.....SSSSSS.....',
  '....SS.SS.SS....',
  '.......SS.......',
  '.......SS.......',
  '..SSSS.SS.SSSS..',
  '..SS...SS...SS..',
  '..SS...SS...SS..',
  '..SS........SS..',
  '..SS........SS..',
  '..SS........SS..',
  '..SS........SS..',
  '..SSSSSSSSSSSS..',
  '..SSSSSSSSSSSS..',
  '................',
] as const;

// prettier-ignore
/** "Thêm vào MH chính": ô vuông có dấu cộng. */
const LUOI_THEM = [
  '................',
  '..SSSSSSSSSSSS..',
  '..SSSSSSSSSSSS..',
  '..SS........SS..',
  '..SS...SS...SS..',
  '..SS...SS...SS..',
  '..SS...SS...SS..',
  '..SS.SSSSSS.SS..',
  '..SS.SSSSSS.SS..',
  '..SS...SS...SS..',
  '..SS...SS...SS..',
  '..SS...SS...SS..',
  '..SS........SS..',
  '..SSSSSSSSSSSS..',
  '..SSSSSSSSSSSS..',
  '................',
] as const;

function Buoc({ so, hinh, ten, mo }: { so: number; hinh: React.ReactNode; ten: string; mo: string }): React.ReactElement {
  return (
    <li className={s.buoc}>
      <span className={s.buocSo}>{so}</span>
      <span className={s.buocHinh} aria-hidden="true">{hinh}</span>
      <span className={s.buocChu}>
        <b className={s.buocTen}>{ten}</b>
        <span className={s.buocMo}>{mo}</span>
      </span>
    </li>
  );
}

/** Link app hiện bằng CHỮ + nút chép (E2). Trình duyệt nhúng hay chặn clipboard ⇒ chữ là đường lui cuối. */
function ChepLink({ noi }: { noi: NoiMoiCai }): React.ReactElement {
  const [kq, datKq] = useState<'chua' | 'ok' | 'hong'>('chua');
  return (
    <>
      <p className={s.link} data-o="link-app">{linkApp()}</p>
      <NutChinh dau="chep-link" onChon={() => { void chepLink(noi).then((ok) => datKq(ok ? 'ok' : 'hong')); }}>
        {kq === 'ok' ? C.daChep : C.chepLink}
      </NutChinh>
      {kq === 'hong' && <p className={s.ghiChu} role="status">{C.chepHong}</p>}
    </>
  );
}

export function CongCaiApp(): React.ReactElement {
  const navigate = useNavigate();
  const [q] = useSearchParams();
  const noiQ = q.get('noi') as NoiMoiCai | null;
  const noi: NoiMoiCai = noiQ !== null && NOI_HOP_LE.includes(noiQ) ? noiQ : 'cong_pfm';
  const mt = moiTruongHienTai();
  const daCaiRoi = daCai();
  const { coLoiMoi, vuaCai } = useMoiCai();
  const [dangMo, datDangMo] = useState(false);
  const [boMoi, datBoMoi] = useState(false);

  useEffect(() => { if (!daCaiRoi) doHien(noi); }, [daCaiRoi, noi]);

  let ruot: React.ReactNode;
  let cachCai = mt.cachCai;
  if (daCaiRoi) {
    ruot = (
      <>
        <p className={s.chinh}>{C.dangOBanCai}</p>
        <NutChinh dau="vao-tai-chinh" onChon={() => navigate(ROUTE_TAI_CHINH)}>{C.vaoTaiChinh}</NutChinh>
      </>
    );
  } else if (cachCai === 'huong_dan_ios') {
    ruot = (
      <>
        <ol className={s.dsBuoc} data-o="ba-buoc-ios">
          <Buoc so={1} hinh={<PixelLuoi luoi={LUOI_CHIA_SE} ten="chia_se" size={32} />} ten={C.ios1} mo={C.ios1Mo} />
          <Buoc so={2} hinh={<PixelLuoi luoi={LUOI_THEM} ten="them_mh" size={32} />} ten={C.ios2} mo={C.ios2Mo} />
          <Buoc so={3} hinh={<Mascot size={32} />} ten={C.ios3} mo={C.ios3Mo} />
        </ol>
        <p className={s.ghiChu} data-o="da-cai-ios">{C.daCaiIos}</p>
      </>
    );
  } else if (cachCai === 'mot_cham') {
    if (vuaCai) {
      ruot = (
        <>
          <p className={s.chinh}>{C.vuaCai}</p>
          <NutChinh dau="mo-app" onChon={() => { window.open(linkApp(), '_blank'); }}>{C.moApp}</NutChinh>
          <p className={s.ghiChu}>{C.moAppLui}</p>
        </>
      );
    } else if (coLoiMoi && !boMoi) {
      ruot = (
        <NutChinh
          dau="cai-ngay"
          disabled={dangMo}
          onChon={() => {
            datDangMo(true);
            void moiCai(noi).then((kq) => { datDangMo(false); if (kq !== 'chap_nhan') datBoMoi(true); });
          }}
        >
          {dangMo ? C.dangMo : C.caiNgay}
        </NutChinh>
      );
    } else {
      ruot = (
        <>
          <p className={s.chinh} data-o="qua-menu">{C.quaMenu}</p>
          <p className={s.ghiChu}>{C.daCaiMenu}</p>
        </>
      );
    }
  } else if (cachCai === 'mo_ngoai_discord') {
    ruot = (
      <>
        <p className={s.chinh} data-o="ngoai-discord">{C.discordMo}</p>
        <ChepLink noi={noi} />
      </>
    );
  } else {
    cachCai = 'mo_trinh_duyet';
    ruot = (
      <>
        <p className={s.chinh} data-o="mo-trinh-duyet">
          {mt.nen === 'nhung' ? C.nhungMo(tenAppNhung(mt.trinhDuyet)) : C.khongCaiDuoc}
        </p>
        {mt.nen === 'nhung' && <p className={s.ghiChu}>{C.nhungCach}</p>}
        <ChepLink noi={noi} />
      </>
    );
  }

  return (
    <ScreenFrame title={C.tieuDe} live>
      <div className={s.cong} data-cong-cai={daCaiRoi ? 'da-cai' : cachCai}>
        {!daCaiRoi && (
          <>
            <p className={s.moDau}>{C.moDau}</p>
            <p className={s.moDau}>{C.viSao}</p>
          </>
        )}
        {ruot}
        <Link className={s.ve} to={ROUTE_HUB}>{C.veHub}</Link>
      </div>
    </ScreenFrame>
  );
}

export default CongCaiApp;
