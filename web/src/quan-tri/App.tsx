/**
 * APP QUẢN TRỊ RIÊNG — khung (D335). Demo đã chốt: `docs/ui-ux/demo/phan-tich-quan-tri.html`.
 *
 * Founder 15/09: *"đừng nhét hết tính năng vào app chính nhé, rối lắm"* + *"gom về 1 admin panel các công cụ quản
 * trị cho gọn"*. Nên đây là MỘT TRANG HTML RIÊNG của cùng bản build (`web/quan-tri.html`): người chơi không tải một
 * byte nào của nó, service worker của app người chơi không cache nó, và router người chơi không biết nó tồn tại.
 *
 * ⚠ Cổng quyền ở màn chỉ để NÓI THẬT (không dựng vỏ rỗng cho người không có quyền). Chặn thật là server: mọi route
 *   `/api/v1/admin/*` đòi admin + mã hai lớp còn hạn.
 */
import { useSearchParams } from 'react-router-dom';
import { useMe } from '@/api/queries';
import { useTongQuanPT } from '@/api/phantich';
import { Cho } from '@/screens/admin/Cho';
import { Tester } from './Tester';
import { TEN_KHU, type Khu } from './chu';
import { DuLieu, SanPham, VanHanh } from './KhuGom';
import { TEN_MOC, THU_TU_MOC, docTrangThai, ghiTrangThai, ngayDu, ngayVN, so, soNgayKhoang } from './khoang';
import { NguoiDung } from './NguoiDung';
import { PhanKhuc } from './PhanKhuc';
import { TongQuan } from './TongQuan';
import s from './QuanTriApp.module.css';

export function QuanTriApp() {
  const me = useMe();
  if (me.isPending) return <div className={s.app}><p className={s.trang}>đang kiểm quyền…</p></div>;
  if (me.data?.user?.role !== 'admin') {
    return (
      <div className={s.app}>
        <div className={s.trang} data-testid="khong-quyen">
          <h1 className={s.khuTen}>DELPHI · PHÂN TÍCH</h1>
          <p>{me.data ? 'Trang này chỉ dành cho quản trị.' : 'Đăng nhập bằng tài khoản quản trị để mở trang này.'}</p>
          <p><a className={s.lienKet} href={me.data ? '/' : '/onboard'}>{me.data ? '‹ về app' : 'đăng nhập ›'}</a></p>
        </div>
      </div>
    );
  }
  return <Khung handle={me.data.user.handle} />;
}

function Khung({ handle }: { handle: string }) {
  const [tham, datTham] = useSearchParams();
  const tt = docTrangThai(tham);
  const dat = (doi: Parameters<typeof ghiTrangThai>[1], thay = false) => datTham(ghiTrangThai(tham, doi), { replace: thay });
  const k = { tu: tt.tu, den: tt.den, gom: tt.gom };
  // Tổng quan nuôi cả DÒNG GHI của thanh thời gian (phạm vi bật ghi · hạn dữ liệu thô) ở mọi khu — cùng khoá cache
  // với khu TỔNG QUAN nên không tốn thêm lượt hỏi nào khi đang ở đó.
  const tq = useTongQuanPT(k);
  // "Hôm nay" của MÁY CHỦ thắng (đồng hồ máy người xem có thể lệch); trong lúc chờ thì dùng đúng ngày mà
  // `docTrangThai` đã dùng để kẹp — KHÔNG lấy `tt.den`: khoảng tuỳ chọn cũ sẽ bị coi là "tới hôm nay".
  const homNay = tq.data?.khoang.hom_nay ?? ngayVN(Date.now());

  const nutKhu = (khu: Khu, phu?: string) => (
    <button type="button" className={s.rayNut} aria-current={tt.khu === khu} onClick={() => dat({ khu })}>
      {TEN_KHU[khu]}{phu ? <small>{phu}</small> : null}
    </button>
  );

  return (
    <div className={s.app}>
      <header className={s.thanh}>
        <span className={s.logo}>DELPHI <i>·</i> PHÂN TÍCH</span>
        <span className={s.thanhPhai}>
          <span>app riêng · người chơi không tải</span>
          <span>{handle} · 2FA ✓</span>
          <a className={s.lienKet} href="/admin">‹ /ADMIN (mã hai lớp · quyền · chốt kèo)</a>
        </span>
      </header>
      <div className={s.than}>
        <nav className={s.ray} aria-label="Khu">
          <div className={s.rayNhom}>ĐO LƯỜNG</div>
          {nutKhu('tong')}
          {nutKhu('nguoi')}
          {nutKhu('phan', 'MỚI')}
          <div className={s.rayNhom}>SẢN PHẨM</div>
          {nutKhu('sp')}
          <div className={s.rayPhu}>hành trình · trận &amp; hạng · tính cách · kèo dự báo · phiên bản</div>
          {/* D362 — nằm trong nhóm SẢN PHẨM chứ không ĐO LƯỜNG: đây là mặt để SỬA APP, không phải mặt
              đo người chơi. Và nó là mặt DUY NHẤT trả dòng theo người, nên đứng riêng một nút. */}
          {nutKhu('tester', 'MỚI')}
          <div className={s.rayPhu}>đợt thử nghiệm · mỗi người một dòng · ghép với Google Form</div>
          <div className={s.rayNhom}>VẬN HÀNH</div>
          {nutKhu('vh')}
          <div className={s.rayPhu}>việc cần làm · kinh tế · sức khoẻ · quản kèo · tạo nháp</div>
          <div className={s.rayNhom}>DỮ LIỆU</div>
          {nutKhu('dl')}
        </nav>
        <main className={s.chinh}>
          <section className={s.tg} aria-label="Khoảng thời gian">
            <div className={s.tgHang}>
              {THU_TU_MOC.map((m) => (
                <button key={m} type="button" className={s.chip} aria-pressed={tt.moc === m} onClick={() => dat({ moc: m })}>{TEN_MOC[m]}</button>
              ))}
              <span className={`${s.oNgay} ${tt.moc === 'tuy' ? s.oNgayChon : ''}`}>
                từ <input type="date" id="tg-tu" aria-label="Từ ngày" value={tt.tu} max={tt.den}
                  onChange={(e) => e.target.value && dat({ moc: 'tuy', tu: e.target.value, den: tt.den })} />
                đến <input type="date" id="tg-den" aria-label="Đến ngày" value={tt.den} min={tt.tu} max={homNay}
                  onChange={(e) => e.target.value && dat({ moc: 'tuy', tu: tt.tu, den: e.target.value })} />
              </span>
            </div>
            <div className={s.tgHang}>
              <label className={s.tick}>
                <input type="checkbox" id="tg-so-ky" checked={tt.soKy} onChange={(e) => dat({ soKy: e.target.checked }, true)} /> so với kỳ trước
              </label>
              <label className={s.tick}>
                <input type="checkbox" id="tg-gom" checked={tt.gom} onChange={(e) => dat({ gom: e.target.checked })} /> gồm tài khoản quản trị &amp; thử
              </label>
              <span className={s.tgGhi} data-testid="tg-ghi">
                {ngayDu(tt.tu)} → {ngayDu(tt.den)} ({so(tq.data?.khoang.so_ngay ?? soNgayKhoang(tt.tu, tt.den))} ngày)
                {tt.soKy && tq.data ? ` · kỳ trước ${ngayDu(tq.data.khoang.ky_truoc.tu)} → ${ngayDu(tq.data.khoang.ky_truoc.den)}` : ''}
                {tq.data ? <> · số hành vi tính trên <b>{so(tq.data.pham_vi.bat_ghi)}/{so(tq.data.pham_vi.tat_ca)}</b> người đang bật ghi cách dùng app</> : null}
                {tq.data && tt.tu < tq.data.khoang.tho_tu
                  ? <> · <b className={s.tgCanh}>màn hình &amp; lượt chạm chỉ có từ {ngayDu(tq.data.khoang.tho_tu)}</b></> : null}
                {tt.gom ? <> · <b className={s.tgCanh}>ĐANG GỒM tài khoản quản trị &amp; thử — số không chỉ mô tả người chơi</b></> : null}
              </span>
            </div>
          </section>

          {tt.khu === 'tong' ? <Cho q={tq} con={tq.data ? <TongQuan d={tq.data} soKy={tt.soKy} /> : null} /> : null}
          {tt.khu === 'nguoi' ? <NguoiDung k={k} homNay={homNay} nguoi={tt.nguoi} moNguoi={(h) => dat({ nguoi: h })} /> : null}
          {tt.khu === 'phan' ? <PhanKhuc k={k} homNay={homNay} /> : null}
          {tt.khu === 'sp' ? <SanPham tab={tt.tab} datTab={(t) => dat({ tab: t }, true)} k={k} /> : null}
          {tt.khu === 'tester' ? <Tester /> : null}
          {tt.khu === 'vh' ? <VanHanh tab={tt.tab} datTab={(t) => dat({ tab: t }, true)} gom={tt.gom} /> : null}
          {tt.khu === 'dl' ? <DuLieu /> : null}
        </main>
      </div>
    </div>
  );
}
