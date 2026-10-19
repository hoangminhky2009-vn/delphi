/**
 * Bản đồ route.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 25/07/2026 — IA REFACTOR: 5 tab → 4 tab, không mất một tính năng nào.
 *
 * Luật của đợt này: **XÓA TAB ≠ XÓA TÍNH NĂNG.** Hai tab rời khỏi thanh menu
 * (Dự báo, Kết quả) nhưng:
 *   · `/du-bao` GIỮ NGUYÊN — nó là GỐC MODULE Predict Market, chỉ không còn
 *     chiếm một ô nav. Có 5 chỗ trong app link cứng vào nó (Ví, onboard xong,
 *     empty-state…), đổi path là gãy hết.
 *   · `/ket-qua` REDIRECT vào chính module đó với lớp lọc "đã chốt". Màn Kết quả
 *     cũ trùng ~85% với sảnh kèo (cùng CSS, cùng hook, khác đúng mảng statuses),
 *     nên nó là một LỚP LỌC chứ chưa bao giờ đáng một màn riêng.
 *
 * KHÔNG ĐƯỢC ĐỤNG:
 *   · `/keo/:marketId` và `/keo/:marketId/ket-qua` — 6 nơi deep-link vào (Ví,
 *     Hồ sơ, danh sách, chi tiết). `/keo/:id/ket-qua` là màn LỄ CÔNG BỐ, cũng
 *     là nơi DUY NHẤT ghi cờ đã-xem-lễ (lib/seen.ts) mà Ví dùng để che ±T.
 *     Bỏ đường tới đó = số payout bị che vĩnh viễn.
 *   · `/verify-email`, `/reset-password` — server/app.ts dựng hai path này vào
 *     link EMAIL ĐÃ GỬI. Đổi là gãy email của người đã đăng ký.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 27/07/2026 — XOÁ 4 ROUTE `/dau-truong/*` (loop CŨ 12 vòng) + 8 file màn.
 *
 * Mục này TRƯỚC ĐÂY nằm trong danh sách "KHÔNG ĐƯỢC ĐỤNG", với điều kiện gỡ là
 * "sau khi Cổng 1 chốt". ⚠ **Cổng 1 CHƯA chốt** — founder ra lệnh gỡ sớm hơn
 * điều kiện đó: *"xóa hết mấy cái link phụ hay bản test đi"*. Ghi rõ để sau này
 * không ai tưởng điều kiện đã đạt.
 *
 * Lý do founder ra lệnh, và nó có giá trị đo được: hôm nay founder mở
 * `/api/v1/holdem/choi` (trang chơi thử cũ), thấy một giao diện khác hẳn bản
 * trong hub, rồi báo "lỗi khi đổi avatar" và "alpha draft quá nhiều lỗi" —
 * trong khi KHÔNG có gì hỏng. **Một màn cũ còn truy cập được là một nguồn báo
 * lỗi giả**, và nó đã ngốn trọn một vòng chẩn đoán của cả hai bên.
 *
 * Hệ quả phải chấp nhận: Cổng 1 (playtest D24 mục 12) nếu cần chạy trên loop cũ
 * thì phải lấy lại từ git history. Đổi lại, không còn đường nào dẫn người chơi
 * tới một trò chơi không còn tồn tại.
 */
import { Suspense, lazy } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { Hub } from '@/screens/Hub';
import { PredictMarket } from '@/screens/PredictMarket';
import { MarketDetail } from '@/screens/MarketDetail';
import { MarketResult } from '@/screens/MarketResult';
import { AlphaDraftLobby } from '@/screens/holdem/AlphaDraftLobby';
import { AlphaDraftMatch } from '@/screens/holdem/AlphaDraftMatch';
import { HuongDan } from '@/screens/holdem/HuongDan';
import {
  PREDICT_TAB_DONE, PREDICT_TAB_PARAM,
  ROUTE_ARENA, ROUTE_ARENA_GUIDE, ROUTE_HUB, ROUTE_ARENA_MATCH_MAU, ROUTE_BACH_KHOA, ROUTE_BACH_KHOA_MUC_MAU, ROUTE_BUOI_DO, ROUTE_PREDICT,
  ROUTE_CAI_DAT, ROUTE_HANH_TRINH, ROUTE_PROFILE, ROUTE_PROFILE_THE, ROUTE_SHOP, ROUTE_TAI_CHINH, ROUTE_TAI_CHINH_THE, ROUTE_TAI_CHINH_PHONG_VAN,
  ROUTE_TAI_CHINH_LO_TRINH, ROUTE_TAI_CHINH_CAM_KET, ROUTE_TAI_CHINH_NGAY_DAU,
  ROUTE_TAI_CHINH_SO, ROUTE_TAI_CHINH_HU, ROUTE_TAI_CHINH_GUONG,
  ROUTE_TOKEN,
} from '@/lib/vocab';
import { Wallet } from '@/screens/Wallet';
import { Shop } from '@/screens/Shop';
import { HanhTrinh } from '@/screens/HanhTrinh';
import { Profile } from '@/screens/Profile';
import { TaiChinh } from '@/screens/TaiChinh';
import { CuaPfm } from '@/screens/tai-chinh/CuaPfm';
import { KhungPfm } from '@/components/pfm/KhungPfm';
import { CaiDat } from '@/screens/CaiDat';
import { Login } from '@/screens/auth/Login';
import { Register } from '@/screens/auth/Register';
import { Forgot } from '@/screens/auth/Forgot';
import { OnboardProfile } from '@/screens/auth/OnboardProfile';
import { VerifyEmail } from '@/screens/VerifyEmail';
import { ResetPassword } from '@/screens/ResetPassword';
import { NotFound } from '@/screens/NotFound';

/*
 * ⚠⚠ MẶT QUẢN TRỊ KHÔNG CÒN Ở ROUTER NÀY (D335) — ĐÂY LÀ ĐIỀU KIỆN ĐI KÈM CỦA §8.1.
 *
 * §8.1 chọn dựng dashboard trong `web/` VỚI ĐIỀU KIỆN gói quản trị không rơi vào gói người chơi. Trước D335 nó
 * nạp trễ (`lazy`) từ đây — đo 15/09 thì không đủ: service worker vẫn precache chunk đó về máy mọi người chơi. Nay
 * nó là trang HTML thứ hai (`web/quan-tri.html`, cửa vào ở thư mục quan-tri của `src`).
 *
 * ⚠ KHÔNG FILE NÀO TRONG CÂY NGƯỜI CHƠI ĐƯỢC IMPORT màn quản trị hay tầng API của nó — tĩnh hay `import()` đều kéo
 * module vào gói người chơi. Test canh: `web/tests/quantri.test.tsx` §I.
 */
/*
 * D333 — MÀN ĐIỀU PHỐI BUỔI ĐO: nạp trễ vì chỉ người điều phối mở tới (một nhúm tài khoản), người chơi
 * không tải nó theo gói của mình.
 */
const BuoiDo = lazy(() => import('@/screens/holdem/BuoiDo').then((m) => ({ default: m.BuoiDo })));
/*
 * D334 — BÁCH KHOA: nạp trễ vì nó chở ~50 lưới icon + toàn bộ chữ tra cứu, thứ người chỉ đến để chơi không cần tải.
 */
const BachKhoa = lazy(() => import('@/screens/bach-khoa/BachKhoa').then((m) => ({ default: m.BachKhoa })));
/*
 * Điều khoản: nạp trễ vì đa số người chơi không bao giờ mở, nhưng route phải
 * CÔNG KHAI — người ta cần đọc TRƯỚC khi tạo tài khoản, nên không bọc AuthGate.
 */
const DieuKhoan = lazy(() => import('@/screens/DieuKhoan'));
/*
 * SỔ chi tiêu (PFM): nạp trễ vì nó kéo theo `dung_kho` + `kho_idb` + cả tầng PFM, mà phần
 * lớn phiên chơi không mở tới. ⚠ Route PHẲNG (không lồng dưới `/tai-chinh`) để tập
 * `path` ở đây BẰNG ĐÚNG `MAN_HOP_LE` — xem `TabTaiChinh`.
 */
const TaiChinhSo = lazy(() => import('@/screens/tai-chinh/So'));
/** HŨ MỤC TIÊU — cùng lý do nạp trễ với SỔ (kéo theo cả tầng `dung_kho`/`kho_idb`). */
const TaiChinhHu = lazy(() => import('@/screens/tai-chinh/Hu'));
/** GƯƠNG — cùng lý do nạp trễ với SỔ/HŨ (kéo theo cả tầng `dung_kho`/`kho_idb`). */
const TaiChinhGuong = lazy(() => import('@/screens/tai-chinh/Guong'));
/** PHỎNG VẤN — cùng lý do nạp trễ: kéo theo cả tầng `dung_kho`/`kho_idb`. */
const TaiChinhPhongVan = lazy(() => import('@/screens/tai-chinh/PhongVan'));
/** LỘ TRÌNH + CAM KẾT — cùng lý do nạp trễ với ba màn PFM kia. */
const TaiChinhLoTrinh = lazy(() => import('@/screens/tai-chinh/LoTrinh'));
const TaiChinhCamKet = lazy(() => import('@/screens/tai-chinh/CamKet'));
/** NGÀY ĐẦU (D355/D356) — cùng lý do nạp trễ với các màn PFM kia. */
const TaiChinhNgayDau = lazy(() => import('@/screens/tai-chinh/NgayDau'));
const TaiChinhChanDung = lazy(() => import('@/screens/tai-chinh/ChanDungPfm'));

/** Nhãn màn hình trên header: DELPHI://<label> (phong cách Mẫu E). */
export interface RouteHandle {
  label: string;
  /**
   * Founder 02/08 — màn TOÀN TÂM: giấu header app + BottomNav khi đang đấu.
   * *"khi vào trận thì xóa hết mấy cái hub-token-mùa ở dưới đi vì bấm nhầm
   * vào là mất trận đấu, thoát trận thì mới ra lại"*. Header cũng đi theo
   * ("bỏ luôn cả cái DELPHI://BÀN-ĐẤU, ví 500T") — trận cần từng px dọc.
   */
  toanMan?: boolean;
  /**
   * Màn RỘNG — bỏ trần 390px của khung điện thoại.
   *
   * ⚠ Khác `toanMan`: bàn đấu cũng toàn màn nhưng CỐ Ý giữ bề ngang điện thoại
   * (nó là một trò chơi dọc). Bảng quản trị thì ngược lại — nó là bảng số, và
   * nhồi bảng số vào một cột 390px trên màn hình máy tính là bắt người đọc
   * cuộn ngang từng cột một.
   */
  manRong?: boolean;
  /**
   * BÀN ĐẤU trên màn hình lớn (founder 04/08: *"bổ sung thêm phần giao diện
   * ngang cho ai dùng PC/laptop"*).
   *
   * ⚠ Khác `manRong` ở CHỖ DÙNG chứ không ở cơ chế: `manRong` cho BẢNG SỐ nở ra
   * hết cỡ; `manNgang` cho BÀN ĐẤU nở tới một trần vừa phải rồi dừng — bàn đấu
   * không phải bảng số, kéo hết màn 27 inch thì mắt phải quét ngang cả mét.
   *
   * ⭐ Và nó phục vụ HAI cửa cùng lúc: Activity Discord trên máy tính cũng là
   * khung ngang, nên một bố cục dùng được cả hai chỗ.
   */
  manNgang?: boolean;
  /**
   * KHU RIÊNG (founder 08/09, khu Tài chính) — giấu BottomNav 5 icon, và đổi ô
   * `VÍ <số>` ở header thành ĐƯỜNG RA HUB.
   *
   * ⚠ Khác `toanMan`: `toanMan` giấu CẢ header (bàn đấu cần từng px dọc). Ở đây
   * header phải ở lại, vì nó là lối thoát DUY NHẤT còn lại sau khi bỏ thanh dưới.
   * Giấu cả hai là dựng đúng cái ngõ cụt mà bài canh 07/09 sinh ra để chặn.
   *
   * ⚠ Vì sao bỏ 5 icon ở khu này: chúng dẫn tới những màn NGOÀI khu, và khu Tài
   * chính đã có dải tab riêng. Hai thanh điều hướng chồng nhau ở đáy màn là hai
   * thứ tranh nhau trả lời cùng một câu hỏi "tôi đi đâu tiếp".
   */
  khuRieng?: boolean;
  /**
   * ĐẦU SẢNH RIÊNG (SPEC `ui-tang-khong-gian`, Hub): màn tự vẽ đầu sảnh (người chơi · ví token) nên header chung
   * (`DELPHI://<màn>` + ô VÍ) TẮT — không in ví hai nơi (§XIX) và Hub lấy lại ~60 px dọc để không phải cuộn.
   * ⚠ Khác `toanMan`: BottomNav, Oracle và dải tester VẪN hiện. Khác `khuRieng`: không đổi ô VÍ thành lối ra Hub.
   */
  dauSanh?: boolean;
  /**
   * KHUNG PFM (SPEC `pfm-tang-khong-gian`): bốn tab SỔ · HŨ · GƯƠNG · THẺ tự vẽ dải tab (đường ra Hub · bốn tab · bánh răng · ô Oracle) nên
   * header chung TẮT như `dauSanh`; đi cùng `khuRieng` (không BottomNav). Vỏ cao đúng 100dvh — xem `AppShell.module.css`.
   */
  khungPfm?: boolean;
}

import { ManLoiRoute } from '../components/ui/ManLoi';
import { PFM_WEB_MO } from '@/lib/pfm_mo';

const h = (
  label: string, toanMan?: boolean, manRong?: boolean, manNgang?: boolean,
  khuRieng?: boolean, dauSanh?: boolean, khungPfm?: boolean,
): RouteHandle => ({
  label,
  ...(toanMan ? { toanMan } : {}),
  ...(manRong ? { manRong } : {}),
  ...(manNgang ? { manNgang } : {}),
  ...(khuRieng ? { khuRieng } : {}),
  ...(dauSanh ? { dauSanh } : {}),
  ...(khungPfm ? { khungPfm } : {}),
});

/** Màn thuộc khu Tài chính — cùng một bộ cờ, khai một chỗ để không lệch nhau. */
const hPfm = (label: string): RouteHandle => h(label, false, false, false, true);
/** Bốn tab SỔ · HŨ · GƯƠNG · THẺ (khung không cuộn): `hPfm` + tắt header chung (xem `RouteHandle.khungPfm`). */
const hPfmKhung = (label: string): RouteHandle => h(label, false, false, false, true, false, true);

/**
 * KHÓA PFM TRÊN WEB (`lib/pfm_mo.ts`, SPEC chan-truoc-beta): cờ tắt ⇒ mọi màn khu Tài chính (kể cả cửa điều phối `/tai-chinh`) về Hub,
 * `replace` để Back không bật qua lại. Màn không dựng ⇒ không `KhoProvider` ⇒ driver nền PFM không chạy. THẺ đo từ trận (`/ho-so/the`)
 * KHÔNG thuộc khu này nên không bị khoá.
 */
const pfm = (el: React.ReactElement): React.ReactElement => (PFM_WEB_MO ? el : <Navigate to={ROUTE_HUB} replace />);

/** HUB: tự vẽ đầu sảnh ⇒ tắt header chung (xem `RouteHandle.dauSanh`). */
const hHub = (label: string): RouteHandle => h(label, false, false, false, false, true);
/** SẢNH ALPHA DRAFT (bento không cuộn, SPEC `alpha-draft-tang-khong-gian`): cùng khuôn đầu sảnh với Hub. */
const hSanh = hHub;

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    /*
     * ⚠ LƯỚI AN TOÀN (vá 03/08). Không có dòng này thì một lỗi render ở BẤT KỲ
     * màn nào cũng huỷ cả cây React và để lại MÀN HÌNH TRẮNG — không chữ,
     * không nút, không đường thoát. Đặt ở gốc để mọi route con thừa hưởng;
     * route nào cần màn lỗi riêng thì tự khai đè.
     */
    errorElement: <ManLoiRoute />,
    children: [
      { path: '/', element: <Hub />, handle: hHub('HUB') },

      // ── MODULE PREDICT MARKET ────────────────────────────────────────
      { path: ROUTE_PREDICT, element: <PredictMarket />, handle: h('DỰ-BÁO') },
      {
        // Tab Kết quả cũ → lớp lọc "đã chốt" trong module. `replace` để nút Back
        // không bật người chơi qua lại giữa redirect và đích.
        path: '/ket-qua',
        element: (
          <Navigate to={`${ROUTE_PREDICT}?${PREDICT_TAB_PARAM}=${PREDICT_TAB_DONE}`} replace />
        ),
        handle: h('DỰ-BÁO'),
      },
      { path: '/keo/:marketId', element: <MarketDetail />, handle: h('KÈO') },
      { path: '/keo/:marketId/ket-qua', element: <MarketResult />, handle: h('KẾT-QUẢ') },

      // ── MODULE ĐẤU TRƯỜNG (codename nội bộ: Alpha Draft / Market Hold'em) ──
      { path: ROUTE_ARENA, element: <AlphaDraftLobby />, handle: hSanh('ALPHA-DRAFT') },
      // BÀN CHUNG (16/08): link mời `/arena/ban/<mã>` mở sảnh với mã điền sẵn.
      { path: '/arena/ban/:banMa', element: <AlphaDraftLobby />, handle: hSanh('ALPHA-DRAFT') },
      // Phòng HƯỚNG DẪN người mới (founder 02/08) — đọc tự do, không cần trận.
      { path: ROUTE_ARENA_GUIDE, element: <HuongDan />, handle: h('HƯỚNG-DẪN') },
      // D333 — người điều phối buổi đo: tạo bàn · chia sẻ · đóng · bức tranh nhóm (server canh quyền).
      {
        path: ROUTE_BUOI_DO,
        element: (
          <Suspense fallback={null}>
            <BuoiDo />
          </Suspense>
        ),
        handle: h('BUỔI-ĐO'),
      },
      // D334 — bách khoa: danh sách + từng mục, cùng một màn (đọc được khi chưa đăng nhập).
      {
        path: ROUTE_BACH_KHOA,
        element: (
          <Suspense fallback={null}>
            <BachKhoa />
          </Suspense>
        ),
        handle: h('BÁCH-KHOA'),
      },
      {
        path: ROUTE_BACH_KHOA_MUC_MAU,
        element: (
          <Suspense fallback={null}>
            <BachKhoa />
          </Suspense>
        ),
        handle: h('BÁCH-KHOA'),
      },
      { path: ROUTE_ARENA_MATCH_MAU, element: <AlphaDraftMatch />, handle: h('BÀN-ĐẤU', true, false, true) },
      // `/arena/tran` trần (không id) — link cũ. Về sảnh thay vì tạo trận mới:
      // tạo trận là HÀNH ĐỘNG của người chơi, không phải hệ quả của việc mở URL.
      { path: '/arena/tran', element: <Navigate to={ROUTE_ARENA} replace />, handle: h('ALPHA-DRAFT') },
      // Path cũ `/alpha-draft`: founder đã mở link này trên máy thật → không
      // được chết. Chữ "Alpha" rời lớp render theo §1.2 nên path cũng rời.
      { path: '/alpha-draft', element: <Navigate to={ROUTE_ARENA} replace />, handle: h('ALPHA-DRAFT') },
      {
        path: '/alpha-draft/tran',
        element: <Navigate to={ROUTE_ARENA} replace />,
        handle: h('ALPHA-DRAFT'),
      },

      /*
       * ── LOOP CŨ 12 VÒNG — ĐÃ XOÁ 27/07 ────────────────────────────────
       *
       * Founder: *"xóa hết mấy cái link phụ hay bản test đi"*. Bốn route
       * `/dau-truong/*` (ArenaLobby · ArenaHistory · ArenaMatch · ArenaAutopsy)
       * là vòng chơi CŨ, và chính chú thích cũ ở đây đã ghi "nghỉ hưu, không có
       * cửa vào" — tức chúng nằm trong bundle mà không ai tới được.
       *
       * VÌ SAO XOÁ CHỨ KHÔNG GIỮ "CHO CHẮC": hôm nay đã trả giá đúng một lần cho
       * việc giữ một UI thứ hai còn sống — founder mở `/api/v1/holdem/choi` (trang
       * chơi thử cũ), thấy giao diện khác hẳn, rồi báo "lỗi đổi avatar" và "alpha
       * draft quá nhiều lỗi" trong khi không có gì hỏng. **Một màn cũ còn truy cập
       * được là một nguồn báo lỗi giả**, và nó ngốn cả một vòng chẩn đoán.
       *
       * `/dau-truong/*` nay rơi vào `*` → NotFound. Đó là câu trả lời ĐÚNG cho một
       * đường không còn tồn tại — tốt hơn hẳn một màn chạy được nhưng nói dối về
       * việc trò chơi đang là gì.
       */

      // ── TAB ─────────────────────────────────────────────────────────
      { path: ROUTE_TOKEN, element: <Wallet />, handle: h('TOKEN') },
      { path: ROUTE_SHOP, element: <Shop />, handle: h('SHOP') },
      { path: ROUTE_HANH_TRINH, element: <HanhTrinh />, handle: h('HÀNH-TRÌNH') },
      { path: ROUTE_PROFILE, element: <Profile />, handle: h('HỒ-SƠ') },
      /*
       * ⚠⚠ 21/09 — THẺ ĐO TỪ TRẬN VỀ Ở VỚI HỒ SƠ. Chỉ thị founder: *"Thẻ tính cách từ alpha
       * draft thì vẫn giữ nguyên nhưng để trên profile còn thẻ PFM thì riêng nhé"*.
       * `TaiChinh.tsx` KHÔNG đổi một dòng — chỉ đổi nhà. Trước đó nó ngồi ở
       * `/tai-chinh/the`, tức thẻ của Đấu trường nằm trong thanh tab PFM.
       * Ranh giới từ nay là NGUỒN BẰNG CHỨNG — xem `vocab.ts` §`ROUTE_PROFILE_THE`.
       */
      { path: ROUTE_PROFILE_THE, element: <TaiChinh />, handle: h('THẺ') },
      /*
       * ⚠ 07/09 — `/tai-chinh` KHÔNG còn vẽ màn THẺ, nó là CỬA điều phối
       * (`CuaPfm`): chưa mở khoá / chưa xem lần nào → THẺ, còn lại → SỔ. Địa chỉ
       * này giữ nguyên vì Hub và nhiều chỗ trong app link cứng vào nó — đổi path
       * là gãy hết; đổi thứ nó LÀM thì không gãy gì.
       */
      { path: ROUTE_TAI_CHINH, element: pfm(<CuaPfm />), handle: h('TÀI-CHÍNH') },
      // 21/09 — địa chỉ này ĐỔI CHỦ: nay là CHÂN DUNG PFM (hành tinh suy từ phỏng vấn).
      { path: ROUTE_TAI_CHINH_THE, element: pfm(<KhungPfm tab="the"><TaiChinhChanDung /></KhungPfm>), handle: hPfmKhung('THẺ') },
      { path: ROUTE_TAI_CHINH_PHONG_VAN, element: pfm(<TaiChinhPhongVan />), handle: hPfm('PHỎNG-VẤN') },
      { path: ROUTE_TAI_CHINH_NGAY_DAU, element: pfm(<TaiChinhNgayDau />), handle: hPfm('NGÀY-ĐẦU') },
      { path: ROUTE_TAI_CHINH_LO_TRINH, element: pfm(<TaiChinhLoTrinh />), handle: hPfm('LỘ-TRÌNH') },
      { path: ROUTE_TAI_CHINH_CAM_KET, element: pfm(<TaiChinhCamKet />), handle: hPfm('CAM-KẾT') },
      { path: ROUTE_TAI_CHINH_SO, element: pfm(<KhungPfm tab="so"><TaiChinhSo /></KhungPfm>), handle: hPfmKhung('SỔ') },
      { path: ROUTE_TAI_CHINH_HU, element: pfm(<KhungPfm tab="hu"><TaiChinhHu /></KhungPfm>), handle: hPfmKhung('HŨ') },
      { path: ROUTE_TAI_CHINH_GUONG, element: pfm(<KhungPfm tab="guong"><TaiChinhGuong /></KhungPfm>), handle: hPfmKhung('GƯƠNG') },
      { path: ROUTE_CAI_DAT, element: <CaiDat />, handle: h('CÀI-ĐẶT') },

      // ── QUẢN TRỊ: KHÔNG CÒN Ở ĐÂY (D335) — `/quan-tri` là app riêng (`web/quan-tri.html`), người chơi không tải.

      // ── AUTH + đích link email (KHÔNG đổi path) ─────────────────────
      /*
       * `/onboard` khai `toanMan` (founder 07/09): giấu BottomNav + bong bóng
       * Oracle. Lý do KHÔNG phải thẩm mỹ —
       *   · 5 tab dưới dẫn tới những màn mà người chưa có tài khoản vào là bị
       *     chặn, tức năm cái cửa cụt trên chính màn mời người ta vào;
       *   · bong bóng Oracle mặc định nằm ĐÈ lên đúng chỗ nút chính.
       * Kèm theo: header (DELPHI://ĐĂNG-NHẬP + "VÍ KHÁCH") cũng tắt — nó lặp lại
       * logo đã có trong `AuthHero` và khoe một cái ví chưa tồn tại.
       */
      { path: '/onboard', element: <Login />, handle: h('ĐĂNG-NHẬP', true) },
      { path: '/onboard/dang-ky', element: <Register />, handle: h('ĐĂNG-KÝ') },
      { path: '/onboard/quen-mat-khau', element: <Forgot />, handle: h('MẬT-KHẨU') },
      { path: '/onboard/ho-so', element: <OnboardProfile />, handle: h('HỒ-SƠ-MỚI') },
      { path: '/verify-email', element: <VerifyEmail />, handle: h('XÁC-MINH') },
      { path: '/reset-password', element: <ResetPassword />, handle: h('MẬT-KHẨU') },
      {
        path: '/dieu-khoan',
        element: (
          <Suspense fallback={null}>
            <DieuKhoan />
          </Suspense>
        ),
        handle: h('ĐIỀU-KHOẢN'),
      },
      { path: '*', element: <NotFound />, handle: h('404') },
    ],
  },
];
