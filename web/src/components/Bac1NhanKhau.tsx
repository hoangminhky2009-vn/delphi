/**
 * BẬC 1 — HỎI NHÂN KHẨU SAU TRẬN ĐẦU (D64 phương án B; founder chốt 04/08).
 *
 * ⚠⚠ MÀN NÀY KHÔNG CHẶN GÌ CẢ, và đó là toàn bộ thiết kế của nó.
 * Founder bác thẳng lý do "age gate vì nội dung": *"game có nội dung người lớn
 * hay cá cược đâu"* — đúng. Token không quy đổi, không tiền vào không tiền ra.
 * Nên đây là một câu HỎI, không phải một cái cửa: có nút bỏ qua, bỏ qua là chơi
 * tiếp bình thường, và không một tính năng nào khoá vì chưa trả lời.
 *
 * ─── VẬY GIỮ LẠI ĐỂ LÀM GÌ ───────────────────────────────────────────────────
 * A1: app này sinh ra để hiểu hành vi tài chính của **người Việt 16–30**. Không
 * biết ai đang chơi thì mọi con số đo được là con số của "một ai đó". Và
 * `events` **append-only tuyệt đối** (A3.3) — không hỏi hôm nay thì mọi trận đã
 * chơi vĩnh viễn không gắn nhãn lại được. Đó là cửa một chiều duy nhất ở đây,
 * chứ không phải chuyện tuổi tác.
 *
 * ⚠ C7 — CHỈ HỎI NĂM, CHỈ LƯU KHOẢNG. Con số năm sinh không bao giờ chạm DB;
 * máy chủ quy nó thành `age_band` rồi vứt. Đừng "tiện thể" xin ngày/tháng.
 *
 * ⚠ THỜI ĐIỂM DO MÁY CHỦ QUYẾT (`hoi_nhan_khau` trong `/auth/me`), không phải
 * client. Luật là "chưa khai · chưa từng hỏi · đã chơi ít nhất một trận"; để
 * client tự ghép ba mảnh thì mỗi màn mới lại phải nhớ ghép đúng.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DEMOGRAPHIC } from '@/api/types';
import type { OccupationBand, Region } from '@config/auth';
import { api, ApiError } from '@/api/client';
import { queryKeys } from '@/api/queries';
import { OCCUPATION_LABELS, REGION_LABELS } from '@/lib/labels';
import { FilterRow, NeonButton } from '@/components/ui';
import { Mascot } from '@/components/Mascot';
import s from './Bac1NhanKhau.module.css';
import { datNghienCuu } from '@/api/du_lieu';
import { VanBanNghienCuu } from './VanBanNghienCuu';

const REGION_OPTIONS = DEMOGRAPHIC.REGIONS.map((v) => ({ value: v, label: REGION_LABELS[v] }));
const OCCUPATION_OPTIONS = DEMOGRAPHIC.OCCUPATION_BANDS.map((v) => ({
  value: v, label: OCCUPATION_LABELS[v],
}));

interface Props {
  /** Đóng màn — gọi cả khi khai xong lẫn khi bỏ qua. */
  onXong: () => void;
}

export function Bac1NhanKhau({ onXong }: Props) {
  const qc = useQueryClient();
  const [nam, setNam] = useState('');
  const [vung, setVung] = useState<Region | null>(null);
  const [nghe, setNghe] = useState<OccupationBand | null>(null);

  /*
   * Ô ĐỒNG Ý — MẶC ĐỊNH TẮT, và điều đó là bắt buộc chứ không phải gu.
   * Một ô đồng ý tích sẵn thì không phải sự đồng ý, nó là một cái bẫy. C7 gọi nó
   * là "checkbox đồng ý", tức người dùng phải là người bấm.
   */
  const [dongY, setDongY] = useState(false);

  const gui = useMutation({
    /*
     * ⚠ HAI CỬA CÓ SẴN, KHÔNG ĐẺ CỬA THỨ BA. `research_consent` đã có đúng một
     * đường ghi (`/account/consent`, dùng chung với công tắc ở Hồ sơ) — thêm một
     * nhánh ghi nữa trong `/me/nhan-khau` là dựng sẵn bản sao sẽ trôi: ngày nào
     * cửa kia thêm một dòng sổ hay một điều kiện, nhánh này lặng lẽ không có.
     *
     * ⚠ CHỈ GỬI KHI TÍCH. Không bao giờ gửi `false` từ màn này: nó là màn HỎI
     * LẦN ĐẦU, không phải công tắc. Gửi false là tự cho mình quyền TẮT một lựa
     * chọn người khác đã bật ở chỗ khác.
     */
    /*
     * ⚠ NHẬN CẢ HAI Ý ĐỊNH QUA THAM SỐ, KHÔNG ĐỌC `dongY` TỪ STATE.
     * `setDongY(false)` rồi `mutate()` ngay ở cùng một trình xử lý thì state
     * CHƯA đổi lúc `mutationFn` chạy — nút BỎ QUA sẽ vẫn gửi đồng ý. Đúng loại
     * lỗi im lặng tệ nhất có thể có ở một ô đồng ý.
     */
    mutationFn: async ({ luuNhanKhau, luuDongY }: { luuNhanKhau: boolean; luuDongY: boolean }) => {
      // 0079 — bật kèm văn bản `nghien_cuu` ở bản hiện hành (một cửa gửi: `datNghienCuu`), đúng chữ đang hiện bên dưới ô tích.
      if (luuDongY) await datNghienCuu(true);
      await api('/me/nhan-khau', {
        method: 'POST',
        body: luuNhanKhau
          ? { birth_year: Number(nam), region: vung, occupation_band: nghe }
          : { bo_qua: true },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      onXong();
    },
  });

  const loi = gui.error instanceof ApiError ? gui.error : null;
  const duNoiDung = /^\d{4}$/.test(nam) && vung !== null && nghe !== null;
  /*
   * XONG mở khi CÓ GÌ ĐÓ để lưu — đủ ba câu HOẶC đã tích đồng ý.
   * ⚠ Hai thứ này ĐỘC LẬP, và bắt phải khai nhân khẩu mới được đồng ý là bó buộc
   * hai quyết định chẳng liên quan gì nhau vào một cú bấm.
   */
  const coGiDeLuu = duNoiDung || dongY;

  return (
    <div className={s.phu} role="dialog" aria-modal="true" aria-labelledby="bac1-tieu-de">
      <div className={s.hop}>
        <div className={s.dau}>
          <Mascot size={28} />
          <div>
            <p className={s.tieuDe} id="bac1-tieu-de">BA CÂU, RỒI THÔI</p>
            {/*
              Nói thẳng nó dùng để làm gì. Một biểu mẫu không nói lý do thì người
              ta điền bừa cho xong — và dữ liệu điền bừa còn tệ hơn ô trống, vì ô
              trống thì biết là trống.
            */}
            <p className={s.phuDe}>
              Để biết app đang phục vụ ai. Không bắt buộc — bỏ qua vẫn chơi bình thường.
            </p>
          </div>
        </div>

        <label className={s.oNam}>
          <span className={s.nhan}>NĂM SINH</span>
          <input
            className={s.nhap}
            inputMode="numeric"
            maxLength={4}
            placeholder="2009"
            value={nam}
            onChange={(e) => setNam(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-invalid={loi ? true : undefined}
          />
          {/* C7 nói thành lời: người khai có quyền biết mình đang đưa đi cái gì. */}
          <span className={s.ghiChu}>Chỉ lưu nhóm tuổi, không lưu năm.</span>
        </label>

        <FilterRow label="KHU VỰC" options={REGION_OPTIONS} value={vung} onChange={setVung} />
        <FilterRow label="CÔNG VIỆC" options={OCCUPATION_OPTIONS} value={nghe} onChange={setNghe} />

        {/*
          ── Ô ĐỒNG Ý (founder chốt phương án A, 04/08) ──────────────────────
          ⚠⚠ VÌ SAO NÓ PHẢI NẰM Ở ĐÂY: cửa đồng ý có sẵn từ lâu, nhưng KHÁCH
          không bao giờ đi qua nó — ô tích duy nhất nằm ở màn onboarding (đường
          email), và công tắc kia nằm sâu trong Hồ sơ. Hệ quả đo được trên prod:
          từ lúc mọi người tự động vào bằng KHÁCH, `research_consent` luôn false
          nên `POST /telemetry` bỏ IM LẶNG mọi dòng — app mù hoàn toàn về chính
          nó, và sự im lặng ấy trông y hệt "không có lỗi nào".
          Đây là chỗ đầu tiên và duy nhất người chơi bậc 0 gặp một câu hỏi, nên
          nó là chỗ đúng để hỏi.
        */}
        <label className={s.oDongY}>
          <input
            type="checkbox"
            className={s.tick}
            checked={dongY}
            onChange={(e) => setDongY(e.target.checked)}
          />
          <span className={s.dongYChu}>
            {/* 0079 — tích = đồng ý ĐÚNG văn bản có số bản ngay dưới (vết ghi bản ấy). Chữ cũ "dữ liệu ẩn danh" nói sai: dấu vết
                cách dùng app gắn với tài khoản. */}
            Đồng ý văn bản dưới đây.
            {' '}<Link className={s.dongYLink} to="/dieu-khoan">Điều khoản →</Link>
          </span>
        </label>
        <VanBanNghienCuu />

        {loi && <p className={s.loi} role="alert">✕ {loi.message}</p>}

        <div className={s.nut}>
          {/*
            BỎ QUA đứng NGANG HÀNG với gửi, không giấu dưới một dòng chữ mờ. Một
            nút thoát khó tìm là ép buộc bằng thiết kế — và founder chốt là không
            ép ai.
            ⚠ BỎ QUA = bỏ qua TẤT CẢ, kể cả ô tích. Nút nào bấm quyết định CÓ LƯU
            GÌ KHÔNG; các ô quyết định LƯU CÁI GÌ. Một cú bấm "bỏ qua" mà vẫn lưu
            một thứ là đúng loại bất ngờ không ai muốn gặp ở một ô đồng ý.
          */}
          <NeonButton
            variant="ghost"
            disabled={gui.isPending}
            onClick={() => gui.mutate({ luuNhanKhau: false, luuDongY: false })}
          >
            BỎ QUA
          </NeonButton>
          <NeonButton
            block
            disabled={!coGiDeLuu || gui.isPending}
            onClick={() => gui.mutate({ luuNhanKhau: duNoiDung, luuDongY: dongY })}
          >
            {gui.isPending ? 'ĐANG GỬI…' : 'XONG'}
          </NeonButton>
        </div>
      </div>
    </div>
  );
}
