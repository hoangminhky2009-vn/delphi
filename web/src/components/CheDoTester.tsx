/**
 * DẢI CHẾ ĐỘ TESTER (D370) — thứ thay người điều phối.
 *
 * ⚠⚠ VÌ SAO NÓ TỒN TẠI. Bộ ba phiếu buổi đo đứng được nhờ mấy CỬA MỘT CHIỀU (đoán chi tiêu trước khi
 * mở app · nhớ lại trận trước khi xem thẻ). Trong một phòng học, thứ canh chúng là GIỌNG người điều
 * phối. Founder 21/09: *"ko có người điều phối mà"* ⇒ không còn giọng nào. Dải này là toàn bộ chỉ dẫn
 * mà tester có, nên nó luôn nói ĐÚNG MỘT VIỆC KẾ TIẾP chứ không vẽ sơ đồ năm bước.
 *
 * ⚠ KHÔNG TỰ GIỮ TRẠNG THÁI. Bước đọc từ `/auth/me`; server là nơi duy nhất đổi nó (`GREATEST`, chỉ
 * tiến). Một bản sao ở client là nguồn thứ hai cho cùng một con số — và bản thứ hai sẽ trôi (A11.5).
 *
 * ⚠ CHỈ MỘT VIỆC APP TỰ BIẾT: chơi xong trận của bàn buổi đo (server tự đẩy bước lên 2 ở màn kết) —
 * việc ấy KHÔNG có nút "tôi đã xong". Ba bước PHIẾU cần người dùng tự khai vì Google Forms không gọi về
 * app; việc PFM cũng tự khai vì câu trả lời PFM nằm trên máy người dùng (D392 — chú thích cũ ghi "hai
 * bước app tự biết, gồm cả PFM" và nút PFM bị đặt lệch một nấc theo đúng câu sai ấy).
 *
 * ⚠ D26 — chữ ở `lib/buoi_do_chu.ts`, đây chỉ ghép. A10 🔒 — không một chữ khuyên về tiền.
 */
import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PHIEU_BUOI_DO, linkPhieu, phieuKeTiep } from '@config/buoi_do_form';
import { useMe } from '@/api/queries';
import { useTienBuocBuoiDo } from '@/api/holdem';
import { ROUTE_PROFILE_THE, ROUTE_TAI_CHINH } from '@/lib/vocab';
import { CHU_CHE_DO_TESTER as C } from '@/lib/buoi_do_chu';
import s from './CheDoTester.module.css';

/** Tham số Google Form gắn vào link quay về: `?buoi_do_buoc=N`. */
const THAM_SO = 'buoi_do_buoc';

export function CheDoTester(): React.ReactElement | null {
  const { data: me } = useMe();
  const tien = useTienBuocBuoiDo();
  const [tham, datTham] = useSearchParams();
  const bd = me?.buoi_do ?? null;

  /*
   * QUAY VỀ TỪ TRANG XÁC NHẬN CỦA FORM. Forms không gọi về app được, nên cú bấm của chính người dùng
   * trên trang "đã ghi câu trả lời" là tín hiệu duy nhất. Nhận xong thì XOÁ tham số khỏi URL ngay —
   * để lại thì nạp lại trang (hoặc bấm back) sẽ gửi lần nữa.
   * ⚠⚠ HAI LỚP, HAI TÌNH HUỐNG KHÁC NHAU — đừng gỡ lớp nào vì tưởng nó thừa (đã đo: gỡ RIÊNG lớp
   *   nào cũng không bài nào đỏ, vì lớp kia đỡ hộ; gỡ CẢ HAI mới đỏ):
   *     · `daGui`  — chặn nhịp kép của **StrictMode** (`main.tsx:200`): effect chạy hai lần lúc
   *       mount, sát nhau, trước khi `datTham` kịp đổi URL.
   *     · `datTham` — chặn **nạp lại trang / bấm back**: tham số còn trên URL là gửi lần nữa.
   *   Bài canh chạy trong StrictMode để lớp thứ nhất kiểm được.
   */
  const daGui = useRef<string | null>(null);
  useEffect(() => {
    const raw = tham.get(THAM_SO);
    if (raw === null || daGui.current === raw) return;
    const buoc = Number(raw);
    if (Number.isInteger(buoc) && buoc >= 1 && buoc <= 5) {
      daGui.current = raw;
      tien.mutate(buoc);
    }
    const con = new URLSearchParams(tham);
    con.delete(THAM_SO);
    datTham(con, { replace: true });
  }, [tham, datTham, tien]);

  if (!bd) return null;

  const buoc = Math.max(0, Math.min(5, bd.buoc));
  const xong = buoc >= 5;
  const phieu = phieuKeTiep(buoc);
  // Việc kế tiếp = mục thứ `buoc` (0-based) của danh sách năm việc.
  const viec = C.viec[Math.min(buoc, C.viec.length - 1)] ?? '';

  return (
    <aside className={s.dai} data-testid="che-do-tester" data-buoc={buoc}>
      <div className={s.dong}>
        <span className={s.nhan}>{C.nhan}</span>
        {bd.ma && (
          <span className={s.ma} title={C.maGiai}>
            <i>{C.maNhan}</i><b>{bd.ma.toUpperCase()}</b>
          </span>
        )}
        <span className={s.buoc}>
          {C.buocPre}{Math.min(buoc + (xong ? 0 : 1), 5)}{C.buocGiua}{5}
        </span>
      </div>

      {xong ? (
        <p className={s.viec}>{C.xong}</p>
      ) : (
        <>
          <p className={s.viec}>{viec}</p>
          {phieu ? (
            <a
              className={s.nut}
              href={linkPhieu(phieu, bd.ma, bd.nhan)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="nut-mo-phieu"
            >
              {C.moPhieu} {phieu.so}
            </a>
          ) : (
            /*
             * Bước 1 · 3 = vừa nộp phiếu xong, giờ chờ người dùng làm việc TRONG app (chơi trận / dùng PFM).
             */
            <p className={s.cho}>{C.dangChoApp}</p>
          )}
          {/*
            D392 — BƯỚC 1 (chơi trận): ĐƯỜNG VỀ BÀN BUỔI ĐO. Link bàn chỉ nằm trong tin nhắn mời, và điểm
            quay về (`diem_quay_ve`) đã xoá lúc vào bàn lần đầu ⇒ chơi xong bàn tập là hết đường về: sảnh
            không có thẻ nào dẫn về bàn, thẻ nổi nhất là THỬ THÁCH HÔM NAY (đề khác, bước không tiến). Chưa
            chơi bàn tập mà bấm nút này thì phòng chờ báo và có nút VÀO BÀN TẬP (`PhongCho`).
          */}
          {buoc === 1 && bd.ban && (
            <Link className={s.nut} to={`/arena/ban/${bd.ban}`} data-testid="nut-vao-ban">
              {C.vaoBan}
            </Link>
          )}
          {/*
            VIỆC PFM (hiện "Bước 4/5", LƯU buoc = 3: đã nộp Phiếu 2, đang dùng PFM) — server KHÔNG tự
            biết: câu trả lời PFM nằm trên máy người dùng, không có cửa nào bắt buộc đi qua nên không có
            sự kiện nào để bắt. Nên đây là bước DUY NHẤT ngoài ba bước phiếu có nút tự khai; bấm ⇒ 4, và
            bước 4 mới mở Phiếu 3.
            ⚠⚠ D392 — bản trước so `buoc === 4` và gửi 5: nhầm số HIỂN THỊ ("Bước 4/5") với số LƯU. Ở bước 3
              dải không có nút nào nên không ai tới được Phiếu 3; ở bước 4 nút này lại ghi thẳng "đã nộp
              Phiếu 3". Số trong `buoc` luôn là số LƯU (0069): 1 P1 · 2 trận · 3 P2 · 4 PFM · 5 P3.
            ⚠ Bước 1 (chơi trận) thì KHÔNG có nút này: xong trận là server thấy được, thêm nút là mời bỏ
              qua trận.
          */}
          {buoc === 3 && (
            <>
              {/* D396 — việc này nằm ở màn khác: đưa luôn cửa vào, cùng đích với thẻ PERSONAL FINANCE ở Hub. */}
              <Link className={s.nut} to={ROUTE_TAI_CHINH} data-testid="nut-mo-pfm">{C.moPfm}</Link>
              <button
                type="button"
                className={s.nutPhu}
                disabled={tien.isPending}
                onClick={() => tien.mutate(4)}
                data-testid="nut-xong-pfm"
              >
                {tien.isPending ? C.dangGhi : C.xongPfm}
              </button>
            </>
          )}
          {/*
            D396 — BƯỚC PHIẾU 3 hỏi về THẺ NĂNG LỰC. Phiếu từng chỉ đường "PERSONAL FINANCE → THẺ" — đường ấy
            nay dẫn tới CHÂN DUNG PFM (D372 dời thẻ năng lực sang Hồ sơ) ⇒ người ta chấm nhầm thẻ. Link thẳng.
          */}
          {buoc === 4 && (
            <Link className={s.nutPhu} to={ROUTE_PROFILE_THE} data-testid="nut-xem-the">{C.xemThe}</Link>
          )}
          {/*
            LỐI DỰ PHÒNG khi mất tab Form (đóng nhầm, mạng rớt giữa chừng). Chỉ hiện ở đúng ba bước có
            phiếu — bước app tự biết thì nút này sẽ là một cách khai gian với chính mình.
          */}
          {phieu && (
            <button
              type="button"
              className={s.nutPhu}
              disabled={tien.isPending}
              onClick={() => tien.mutate(phieu.buoc)}
              data-testid="nut-da-nop"
            >
              {tien.isPending ? C.dangGhi : C.daNop}
            </button>
          )}
        </>
      )}
      {tien.isError && <p className={s.loi}>{C.loiGhi}</p>}
    </aside>
  );
}

/** Dùng ở test và ở màn kết: tổng số bước, để không ai gõ số 5 rải rác. */
export const SO_BUOC_BUOI_DO = 5;
export { PHIEU_BUOI_DO };
