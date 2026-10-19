/**
 * HAI HỘP QUYẾT ĐỊNH KHÔNG QUAY LẠI ĐƯỢC.
 *
 * 1. SHEET BỎ BÀI — founder chốt 20/07: bỏ bài KHÔNG còn là một nút, nó là một
 *    ngã ba. Từ 25/07 (D2) ngã ba có BA nhánh, và ba nhánh là BA HÀNH ĐỘNG
 *    SERVER khác nhau:
 *      · CẮT LỖ    — bỏ ĐÚNG vòng này, chịu phí, vòng sau cầm tiền mặt quay lại.
 *        Có giới hạn số lượt mỗi trận.
 *      · ĐỨNG NGOÀI — vốn đóng băng, ngồi xem tới hết trận, VẪN được tính hạng,
 *        nhưng mỗi vòng còn lại bị lạm phát bào. Không phải bến an toàn.
 *      · ĐẦU HÀNG  — thoát luôn, THUA, KHÔNG được tính hạng.
 *    Cả ba hậu quả phải in thẳng trên nút. Người chơi bấm nhầm nhánh vì không
 *    ai nói trước là lỗi thiết kế, không phải lỗi người chơi.
 *
 *    ⚠ LỖI CŨ ĐÃ SỬA (25/07/2026): sheet này chỉ có hai nhánh, và CẢ HAI đều
 *    gửi cùng một thứ lên server (bỏ một vòng). Nên nhãn "ngồi xem tới hết trận"
 *    và "tính là THUA" đều KHÔNG đúng: tư thế ghế không bao giờ rời `'choi'`,
 *    `PHI_DUNG_NGOAI` và luật xếp-bét-bảng của người đầu hàng thành code chết,
 *    còn "Đầu hàng" thì chỉ điều hướng về sảnh nên trận vẫn mở. Nhãn hứa một
 *    chuyện, engine làm chuyện khác — dạng lỗi tệ nhất, vì test nào cũng xanh.
 *
 * 2. XÁC NHẬN THOÁT giữa trận — vì thoát giữa chừng giờ đồng nghĩa với thua.
 */
import {
  T_CAT_LO_UPPER, T_DUNG_NGOAI, T_DAU_HANG, T_PHA_CAM_KET_UPPER, T_VON,
} from '@/lib/vocab';
import s from './HopXacNhan.module.css';

export function SheetBoBai({
  vongConLai, conLaiCatLo, phaCamKet, onCatLo, onDungNgoai, onDauHang, onHuy,
}: {
  vongConLai: number;
  /** D2 — còn mấy lượt Cắt lỗ trong trận. SERVER cấp, client không tự tính. */
  conLaiCatLo: number;
  /**
   * LÕI VỐN B — bỏ vòng NGAY BÂY GIỜ có phá cam kết nắm giữ không, và mất gì.
   *
   * Cả BA nhánh dưới đây đều rút khỏi vòng, nên ở vòng chốt của chu kỳ khoá thì
   * cả ba đều làm gãy lời hứa — engine chấm bẻ kèo theo "có bỏ bài không", không
   * phải theo nhánh nào. Không nói ra ở đây là người chơi cắt lỗ 250 rồi lãnh
   * thêm một khoản phạt không hiểu từ đâu ra.
   *
   * `null` = vòng này bỏ bài không đụng cam kết nào.
   */
  phaCamKet?: { ma: string; phat_bp: number; thu_hoi_bp: number; giam_vong: number } | null;
  onCatLo: () => void;
  onDungNgoai: () => void;
  onDauHang: () => void;
  onHuy: () => void;
}) {
  /*
   * ⚠ API CŨ KHÔNG GỬI TRƯỜNG NÀY. Đo được ngay lúc thử: sheet in ra "Còn lượt."
   * — một câu có lỗ, vì `{undefined}` render thành chuỗi rỗng. Không crash, không
   * log, chỉ là chữ vô nghĩa; đúng dạng lỗi lệch phiên bản khó thấy nhất (xem
   * TheGiaiThich.tsx: frontend và API deploy bằng hai lệnh riêng).
   *
   * Thiếu số thì BỎ HẲN dòng đếm, và KHÔNG tự khoá nút: server mới là bên giữ
   * quota (nó gỡ 'bo' khỏi danh sách được-làm), nên khoá ở client dựa trên dữ
   * liệu không có là tự chặn một nước đi hợp lệ.
   */
  const coDem = Number.isFinite(conLaiCatLo);
  const hetLuot = coDem && conLaiCatLo <= 0;
  return (
    <div className={s.lop} role="dialog" aria-label="Bỏ bài">
      <div className={s.hop}>
        <div className={s.tieuDe}>BỎ BÀI — CHỌN CÁCH RA</div>

        {/* Đứng TRƯỚC ba nhánh: nó áp cho CẢ BA, không phải cho một nhánh nào. */}
        {phaCamKet && (
          <p className={s.canhBao}>
            Bỏ vòng bây giờ là <b>{T_PHA_CAM_KET_UPPER}</b> với {phaCamKet.ma}:
            {' '}−{phaCamKet.phat_bp} bp, thu hồi {phaCamKet.thu_hoi_bp} bp đã
            thưởng, và {T_VON} bị giam {phaCamKet.giam_vong} vòng. Áp cho cả ba
            cách ra dưới đây.
          </p>
        )}

        {/* Nhánh NHẸ NHẤT đứng đầu: đây là nước đi chiến thuật, không phải bỏ cuộc. */}
        <button
          type="button"
          className={`${s.nhanh} ${s.nhanhCatLo}`}
          onClick={onCatLo}
          disabled={hetLuot}
        >
          {/*
            Ba nhãn dưới đây từng mở đầu bằng emoji (kéo · ghế · cờ trắng). Bỏ
            hẳn theo luật 4: chúng do font hệ điều hành vẽ nên ba máy ra ba hình,
            mà đây là màn quyết định KHÔNG QUAY LẠI ĐƯỢC — thứ phải giống nhau
            tuyệt đối trên mọi máy. Ba nhánh vẫn phân biệt được tức thì bằng màu
            viền (hổ phách · lam · đỏ) và bằng chính hậu quả in ngay dưới nút.
          */}
          <span className={s.nhanhTen}>{T_CAT_LO_UPPER} VỀ TIỀN MẶT</span>
          <span className={s.nhanhMo}>
            {hetLuot ? (
              <>
                <b>Hết lượt cắt lỗ trong trận này.</b> Còn hai đường: đứng ngoài,
                hoặc chiến đấu tiếp.
              </>
            ) : (
              <>
                Bỏ <b>đúng vòng này</b>, vòng sau cầm tiền mặt quay lại chơi bình
                thường.
                <br />
                Mất một khoản phí (giữ tiền mặt + bán gấp cả danh mục). Cả bàn cùng
                chạy một lúc thì phí <b>đắt gấp đôi</b>.
                <br />
                {coDem && <>Còn <b>{conLaiCatLo}</b> lượt.</>}
              </>
            )}
          </span>
        </button>

        <button type="button" className={`${s.nhanh} ${s.nhanhGiu}`} onClick={onDungNgoai}>
          <span className={s.nhanhTen}>{T_DUNG_NGOAI.toUpperCase()}</span>
          <span className={s.nhanhMo}>
            Đóng băng vốn, ngồi xem tới hết trận. <b>Vẫn được tính hạng.</b>
            <br />
            Nhưng còn {vongConLai} vòng nữa, mỗi vòng lạm phát vẫn bào vốn bạn —
            đứng ngoài <b>không</b> miễn phí.
          </span>
        </button>

        <button type="button" className={`${s.nhanh} ${s.nhanhBo}`} onClick={onDauHang}>
          <span className={s.nhanhTen}>{T_DAU_HANG.toUpperCase()}</span>
          <span className={s.nhanhMo}>
            Thoát ngay khỏi trận. <b>Tính là THUA, không có hạng.</b>
            <br />
            Kể cả đang dẫn đầu cũng vậy.
          </span>
        </button>

        <button type="button" className={s.huy} onClick={onHuy}>
          ← Quay lại, tôi chơi tiếp
        </button>
      </div>
    </div>
  );
}

export function XacNhanThoat({
  onThoat, onHuy, laTap = false,
}: {
  onThoat: () => void;
  onHuy: () => void;
  /**
   * D336 lượt 2 — BÀN TẬP: thoát giữa chừng là BỎ QUA MÀN TẬP, không phải "chịu thua". Bàn tập
   * không có hạng để mất; câu cần nói là hệ quả thật — lần sau vào Đấu trường không bị dắt vào đây
   * nữa, và muốn tập lại thì ở đâu (founder 15/09: *"ai muốn chơi lại thì lướt xuống cuối"*).
   */
  laTap?: boolean;
}) {
  if (laTap) {
    return (
      <div className={s.lop} role="dialog" aria-label="Bỏ qua màn tập">
        <div className={s.hop}>
          <div className={s.tieuDe}>BỎ QUA MÀN TẬP?</div>
          <p className={s.canhBao}>
            Bàn tập không tính điểm. Ra sảnh rồi thì lần sau vào Đấu trường sẽ vào thẳng sảnh —
            muốn tập lại, <b>MÀN TẬP</b> nằm ở cuối sảnh.
          </p>
          <button type="button" className={`${s.nhanh} ${s.nhanhBo}`} onClick={onThoat}>
            <span className={s.nhanhTen}>Bỏ qua, ra sảnh</span>
          </button>
          <button type="button" className={s.huy} onClick={onHuy}>
            ← Ở lại tập tiếp
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className={s.lop} role="dialog" aria-label="Thoát trận">
      <div className={s.hop}>
        <div className={s.tieuDe}>ĐANG GIỮA TRẬN</div>
        <p className={s.canhBao}>
          Thoát bây giờ tính là <b>ĐẦU HÀNG</b>: trận này ghi <b>THUA</b> và bạn
          không được xếp hạng.
        </p>
        <button type="button" className={`${s.nhanh} ${s.nhanhBo}`} onClick={onThoat}>
          <span className={s.nhanhTen}>Thoát và chịu thua</span>
        </button>
        <button type="button" className={s.huy} onClick={onHuy}>
          ← Ở lại chơi tiếp
        </button>
      </div>
    </div>
  );
}
