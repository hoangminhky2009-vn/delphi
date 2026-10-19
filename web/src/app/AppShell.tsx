/**
 * Khung chung mọi màn (mobile-first 390px — C6): header DELPHI://<màn> + ví,
 * nội dung màn (Outlet), menu chính BottomNav (Sảnh · Ví · Hồ sơ).
 */
import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useMatches } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { khoiDongDo, useDoMan } from '@/lib/telemetry';
import { khoiDongCamBienMang } from '@/api/mang';
import { trongDiscord } from '@/lib/discord';
import { formatT } from '@/lib/money';
import { ROUTE_HUB, ROUTE_TOKEN } from '@/lib/vocab';
import { BottomNav } from '@/components/BottomNav';
import { CheDoTester } from '@/components/CheDoTester';
import { OracleChat } from '@/components/OracleChat';
import { BangMatKetNoi } from '@/components/BangMatKetNoi';
import { HangCho } from '@/components/HangCho';
import { HangChoSuatTran } from '@/components/HangChoSuatTran';
import { Bac1NhanKhau } from '@/components/Bac1NhanKhau';
import { TamHoiTuoi } from '@/components/TamHoiTuoi';
import { TheDieuKhoanDoi } from '@/components/TheDieuKhoanDoi';
import { HoiLaiNghienCuu } from '@/components/HoiLaiNghienCuu';
import { Mascot } from '@/components/Mascot';
import { PixelIcon } from '@/components/ui/PixelIcon';
import type { RouteHandle } from './routes';
import s from './AppShell.module.css';

export function AppShell() {
  const matches = useMatches();
  const handle = matches.at(-1)?.handle as RouteHandle | undefined;
  const label = handle?.label ?? 'DỰ-BÁO';
  const me = useMe();
  /** B5 — máy chủ báo tài khoản chưa qua cổng tuổi (`/auth/me`); vắng trường (máy chủ cũ) ⇒ không hỏi. */
  const canTuoi = me.data?.can_xac_nhan_tuoi === true;

  /*
   * ĐO LƯỜNG VẬN HÀNH (A9) — bật ở ĐÂY vì đây là chỗ duy nhất mọi màn đi qua.
   * Rắc lời gọi vào từng màn thì chỉ cần quên một màn là màn đó vô hình với
   * dashboard, mà không có gì báo.
   * Chỉ ghi thời lượng màn hình + phễu; không một đồng nào, không một niềm tin
   * nào đi qua đường này (phép thử A9) ⇒ `telemetry`, KHÔNG phải `events`.
   */
  useEffect(khoiDongDo, []);
  // Cảm biến kết nối — nghe sự kiện `offline` của trình duyệt. Đường tín hiệu
  // CHÍNH vẫn là đếm lỗi ở tầng `api()`; xem lý do ở `api/mang.ts`.
  useEffect(khoiDongCamBienMang, []);
  const { pathname } = useLocation();
  useDoMan(pathname);

  /*
   * ── CỬA VÀO ĐỨNG TRƯỚC VỎ APP (chỉ thị founder 07/09) ────────────────────
   * *"cửa sổ đăng nhập … sẽ là cái đầu tiên đập vào mắt khi vào app"*.
   *
   * Trước đó chỉ đường Discord mới đá về `/onboard` (`main.tsx`); trên web
   * thường thì app dựng nguyên vỏ (Hub + 5 tab + ticker) rồi mới hiện một ô mời
   * đăng nhập BÊN TRONG (`AuthGate`). Nhìn từ ngoài là một app đầy đủ mà bấm
   * đâu cũng bị chặn — năm cái cửa cụt trước khi kịp biết đây là cái gì.
   *
   * ⚠ CHỈ đá khi CHẮC CHẮN không có phiên. Ba trạng thái của `useMe`, chỉ một
   * trạng thái được đá:
   *   · `isPending` — chưa biết, đá là cướp phiên của người đang đăng nhập;
   *   · `isError`   — mạng hỏng, đá là NUỐT lỗi mạng và biến nó thành một vòng
   *                   điều hướng không giải thích được (AuthGate có màn "thử
   *                   lại" đàng hoàng cho ca này);
   *   · thành công mà `data` rỗng — đúng ca duy nhất.
   * Khách CÓ `data.user` nên không bị đá — họ đã qua cửa rồi.
   *
   * ⚠ CHỈ ĐÁ TỪ `/`, KHÔNG ĐÁ MỌI ROUTE. Bản đầu (07/09) chặn tất, và nó giết
   * đúng những đường phải sống: link mời bàn chung `/arena/ban/<mã>` (16/08),
   * `/keo/:id/ket-qua` mà 6 chỗ deep-link vào, mọi link chia sẻ ra ngoài. Người
   * lạ mở link mời mà bị ném về màn đăng nhập là mất luôn cái lời mời. Đường sâu
   * vẫn do `AuthGate` lo — nó mời đăng nhập TẠI CHỖ, giữ nguyên ngữ cảnh.
   */
  const chuaCoPhien = !me.isPending && !me.isError && !me.data;
  const daVaoCuaVao = chuaCoPhien && pathname === '/';
  /*
   * Founder 02/08 — màn TRẬN ĐẤU chạy toàn tâm: không header, không BottomNav.
   * Header choán ~60px dọc mà ví T không liên quan gì tới trận (trận dùng Vốn
   * riêng); BottomNav thì "bấm nhầm vào là mất trận đấu". Thoát trận (route
   * đổi) là hai thứ này tự quay lại — không cần trạng thái riêng.
   */
  const toanMan = handle?.toanMan === true;
  // Màn rộng: bỏ trần 390px. Bảng số trên máy tính cần bề ngang, không cần khung.
  const manRong = handle?.manRong === true;
  /*
   * ⚠⚠ TRONG DISCORD THÌ MỌI MÀN ĐỀU NGANG, KHÔNG RIÊNG BÀN ĐẤU.
   *
   * Bản đầu chỉ cắm cờ cho màn trận, và founder thấy ngay hậu quả: cả app là một
   * dải hẹp giữa một khung Discord rộng, hai bên đen thui. Đó là vì Activity mở
   * TOÀN BỘ app trong một iframe ngang — Hub, Ví, Hồ sơ, Shop đều ở đó, không chỉ
   * bàn đấu.
   *
   * Nên điều kiện đúng là "đang trong khung ngang", chứ không phải "đang ở màn
   * nào". Route vẫn khai được `manNgang` cho bản web trên máy tính; còn trong
   * Discord thì bật cho tất cả.
   */
  const manNgang = handle?.manNgang === true || trongDiscord();
  /*
   * KHU RIÊNG (founder 08/09) — khu Tài chính bỏ BottomNav 5 icon, và ô ví ở
   * header đổi thành ĐƯỜNG RA HUB. Xem `RouteHandle.khuRieng` ở `routes.tsx` về
   * vì sao header phải ở lại: sau khi bỏ thanh dưới, nó là lối thoát duy nhất.
   */
  const khuRieng = handle?.khuRieng === true;
  /*
   * ĐẦU SẢNH RIÊNG (Hub — SPEC `ui-tang-khong-gian`): màn tự vẽ người chơi + ví ở đầu, nên header chung TẮT để ví không in hai
   * nơi (§XIX) và Hub lấy lại chiều cao để không cuộn. BottomNav / Oracle / dải tester vẫn hiện — khác `toanMan`.
   */
  const dauSanh = handle?.dauSanh === true;
  /*
   * KHUNG PFM (SPEC `pfm-tang-khong-gian`): bốn tab SỔ · HŨ · GƯƠNG · THẺ không cuộn. Như `dauSanh`, header chung TẮT (dải tab của khu
   * tự mang đường ra Hub + bánh răng + ô Oracle), và Oracle neo vào ô giữ sẵn thay vì trôi nổi lên bàn tiền. Khác `dauSanh`: không có
   * BottomNav (route khai thêm `khuRieng`) nên vỏ không chừa 74 px đáy.
   */
  const khungPfm = handle?.khungPfm === true;
  const bentoKhongCuon = dauSanh || khungPfm;

  /*
   * Đóng ngay khi người chơi bấm xong, KHÔNG chờ `/auth/me` về.
   * Không có cờ này thì hộp còn nằm đó thêm một nhịp mạng sau cú bấm — và một
   * hộp thoại không đóng khi bấm là thứ người ta bấm lại lần nữa.
   */
  const [daTraLoi, setDaTraLoi] = useState(false);

  return (
    <div
      className={toanMan ? `${s.shell} ${s.shellToanMan}` : s.shell}
      data-dau-sanh={dauSanh ? '' : undefined}
      data-khung-pfm={khungPfm ? '' : undefined}
    >
      {/*
        Dải MẤT KẾT NỐI đứng NGOÀI `.frame` và dùng `position: fixed` — nó phải
        hiện cả ở màn TOÀN MÀN (bàn đấu), nơi header bị ẩn (D47). Không chen vào
        luồng nên không đẩy bố cục của bất kỳ màn nào.
      */}
      <BangMatKetNoi />
      {/*
        HÀNG CHỜ (D207) — phủ toàn màn khi cổng chống quá tải đang đóng.
        Đặt NGOÀI `.frame` và trên cùng vì nó phải che cả màn TOÀN MÀN (bàn
        đấu): lúc chưa được vào thì không có màn nào có dữ liệu để vẽ, để lộ
        ra chỉ khiến người ta tưởng app hỏng. Tự trả `null` khi không xếp hàng,
        nên đường chạy thường không đổi một px nào.
      */}
      <HangCho />
      {/*
        HÀNG CHỜ SUẤT TRẬN (SPEC tran-tran-ngay) — dải nổi, KHÔNG phủ: chỉ việc tạo trận phải chờ, app vẫn lướt được.
        Ở đây (không ở màn sảnh) vì người chờ được phép rời màn; tới lượt mà màn gốc đã đóng thì chính dải này đưa vào trận.
      */}
      <HangChoSuatTran />
      <div
        className={[s.frame, manRong && s.frameRong, manNgang && s.frameNgang]
          .filter(Boolean).join(' ')}
      >
        {!toanMan && !bentoKhongCuon && (
          <header className={s.header}>
            <div className={s.logo}>
              <span className={s.logoChip}>
                <Mascot size={20} />
              </span>
              <span className={s.logoText}>
                DELPHI<span className={s.logoSlash}>://</span>
                <span className={s.logoScreen}>{label}</span>
              </span>
            </div>
            {khuRieng ? (
              <Link to={ROUTE_HUB} className={s.wallet} aria-label="Về Hub">
                <PixelIcon name="hall" size={16} />
                <span className={s.walletLabel}>HUB</span>
              </Link>
            ) : (
              <Link to={me.data?.user ? ROUTE_TOKEN : '/onboard'} className={s.wallet}>
                <span className={s.walletLabel}>VÍ</span>
                <span className={s.walletValue}>
                  {me.data?.user ? formatT(me.data.user.bankroll) : 'KHÁCH'}
                </span>
              </Link>
            )}
          </header>
        )}
        {/*
          D370 — DẢI CHẾ ĐỘ TESTER. Ở AppShell chứ không ở từng màn: nó phải theo tester khắp app
          (cùng lý lẽ Oracle ở dưới — mỗi màn tự gắn một bản là bốn bản sẽ trôi, D61).
          ⚠ KHÔNG ở màn toàn tâm (trận đấu): founder 02/08 chốt màn ấy không header, không BottomNav
            — "bấm nhầm vào là mất trận đấu". Dải này cũng có nút, nên cùng luật.
          ⚠ Tự trả `null` khi không thuộc đợt đo nào, nên không cần kiểm gì thêm ở đây.
        */}
        {!toanMan && <CheDoTester />}
        <main className={s.main}>
          {daVaoCuaVao ? <Navigate to="/onboard" replace /> : <Outlet />}
        </main>
      </div>
      {!toanMan && !khuRieng && <BottomNav />}
      {/* THẺ ĐIỀU KHOẢN VỪA ĐỔI (SPEC bao-loi-nguoi-choi T9) — một lần mỗi máy; chưa bấm thì lỗi ẩn danh chưa gửi. */}
      {!toanMan && <TheDieuKhoanDoi />}
      {/*
        ORACLE — bong bóng chat NỔI (founder 22/08: "đừng làm nó cứng, làm nó như
        cái bong bóng chat của messenger"). Ở AppShell chứ không nhét vào từng
        màn: nó phải theo người chơi khắp app, và mỗi màn tự gắn một bản là bốn
        bản sẽ trôi (D61). KHÔNG ở màn toàn tâm — cùng lý do giấu BottomNav.
        Màn bento (`dauSanh`: Hub · sảnh Alpha Draft) không có chỗ trống cho lớp phủ trôi nổi ⇒ Oracle chỉ là avatar nhỏ NẰM TRONG
        ô giữ sẵn `[data-oracle-cho]` của màn, bấm mới bung lời (xem đầu `OracleChat.tsx`, chế độ `neoCho`).
      */}
      {!toanMan && <OracleChat neoCho={bentoKhongCuon} />}
      {/*
        BẬC 1 — hỏi nhân khẩu sau trận đầu (D64 phương án B).

        ⚠ Ở AppShell chứ KHÔNG nhét vào màn kết quả trận, vì hai lý do:
         · nó phải xuất hiện đúng một lần cho MỌI đường ra khỏi trận — thoát
           giữa chừng, hết giờ, đóng app rồi mở lại — mà màn kết quả chỉ là một
           trong số đó;
         · nhét vào màn trận là gắn một câu hỏi hồ sơ vào 700 dòng logic trận,
           tức mỗi lần sửa trận lại phải nhớ tới nó.

        ⚠ KHÔNG hiện ở màn toàn tâm (bàn đấu): chen một hộp thoại vào giữa trận
        là đúng cái mà `toanMan` sinh ra để chặn ("bấm nhầm vào là mất trận đấu").
        Chờ họ ra khỏi bàn — câu hỏi này không vội.
      */}
      {!toanMan && !canTuoi && me.data?.hoi_nhan_khau === true && !daTraLoi && (
        <Bac1NhanKhau onXong={() => setDaTraLoi(true)} />
      )}
      {/*
        HỎI LẠI ĐỒNG Ý NGHIÊN CỨU (SPEC chan-truoc-beta) — người bật ô từ trước khi có số bản. Cùng luật chỗ đứng với bậc 1: không ở màn
        toàn tâm (bàn đấu), và không chồng lên hộp bậc 1 đang mở (hộp ấy tự có ô đồng ý của nó).
      */}
      {!toanMan && !canTuoi && me.data?.user?.hoi_lai_nghien_cuu === true && !(me.data?.hoi_nhan_khau === true && !daTraLoi) && (
        <HoiLaiNghienCuu />
      )}
      {/*
        B5 (C8) — CỔNG TUỔI cho khách/Discord: máy chủ đóng mọi cửa nghiệp vụ tới khi xác nhận năm sinh, nên tấm này hiện cả ở màn
        toàn tâm (khác hai tấm trên): đứng sau cổng thì bàn đấu cũng không gửi được nước nào. Che hai tấm kia — một hộp một lúc.
      */}
      {canTuoi && <TamHoiTuoi />}
    </div>
  );
}
