/**
 * PFM — MÀN PHỎNG VẤN CỬA VÀO. **Làm theo DEMO ĐÃ CHỐT** (A11.25/D277):
 * `#man-pv` của `docs/ui-ux/demo/pfm-lo-trinh.html`.
 *
 * Chỉ thị founder 08/09: *"phần phỏng vấn hiện ngay lần đầu tiên bấm PFM"* —
 * KHÔNG có nút bỏ qua ở cửa (một chỉ thị trước có, founder rút lại). Nhưng
 * **từng câu vẫn bỏ được** ("để sau"), đúng demo: sáu câu là lời mời, không phải
 * cổng thu phí.
 *
 * ⚠ A10 — MÔ TẢ ĐƯỢC, KÊ ĐƠN KHÔNG. Màn này chỉ HỎI và GHI. Không một dòng nào
 * suy ra lời khuyên, và không ô nào hỏi thu nhập: demo ghi rõ *"nhịp tiền suy từ
 * chính sổ sau này, và đó là số THẬT bạn đã làm chứ không phải số bạn khai"*.
 *
 * ⚠ Ba câu đổ vào `HoSo` đã có (`nguonThu`/`khung`/`coNo`) — màn này là cái miệng
 * còn thiếu của `pfm/ho_so.ts`, không phải hồ sơ thứ hai. Xem `pfm/phong_van.ts`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenFrame } from '@/components/ScreenFrame';
import { TabTaiChinh } from '@/components/pfm/TabTaiChinh';
import { NutCaiDatPfm } from '@/components/pfm/NutCaiDatPfm';
import { KhoProvider, useGhiKho, useHoSo } from '@/pfm/dung_kho';
import { donDauVetSauPhongVan } from '@/pfm/chan_dung';
import { suaHoSo, type HoSo } from '@/pfm/ho_so';
import {
  CAU_PV, KHOA_THEO_CAU, cauDangHien, gameDienSan, hoSoTuTraLoi, khoaCauAn, traLoiTuHoSo,
} from '@/pfm/phong_van';
import { CHU_LOI_GHI } from '@/lib/pfm_chu';
import { baoLoiNen } from '@/lib/telemetry';
import { danhDauDaPhongVan } from '@/pfm/da_phong_van';
import { bayGio } from '@/pfm/thoi_gian';
import { useTinHieuGame, useTinhCach } from '@/api/tinh_cach';
import { useCuaPfm } from '@/api/pfm';
import { useMe } from '@/api/queries';
import { ROUTE_TAI_CHINH_THE } from '@/lib/vocab';
import { NeonButton } from '@/components/ui';
import s from './PhongVan.module.css';

/** `undefined` = chưa xử · `null` = cố ý để sau · mảng = đã chọn. */
type BangTraLoi = Record<string, string[] | null | undefined>;

function KhoiChungNhan({ daCoThe }: { daCoThe: boolean }) {
  /*
   * BA Ô CHỨNG (demo `.chung`). Ô SỔ cố ý luôn "đang chờ" ở màn này: người mới
   * chưa ghi khoản nào, và nói dối ở ô chứng là hỏng đúng thứ khối này dựng ra
   * để tạo — lòng tin rằng app chỉ nói cái nó đo được.
   */
  const o: [string, string, boolean][] = [
    ['GAME', daCoThe ? 'đã đo' : 'đang chờ', daCoThe],
    ['TỰ KHAI', 'đang làm', true],
    ['SỔ', 'đang chờ', false],
  ];
  return (
    <div className={s.chung}>
      {o.map(([ten, trang, sang]) => (
        <div key={ten} className={`${s.oCh} ${sang ? s.oChSang : ''}`}>
          <i>{ten}</i><s>{trang}</s>
        </div>
      ))}
    </div>
  );
}

/** ⚠ Xuất ra cho bài test — xem `RuotHu`/`RuotGuong`, cùng nếp. */
export function RuotPhongVan() {
  const chu = useMe().data?.user?.user_id ?? null;
  const navigate = useNavigate();
  const ghi = useGhiKho();
  const { data: hoSoCu, sanSang: coHoSo } = useHoSo();
  const tc = useTinhCach(true);

  const [traLoi, setTraLoi] = useState<BangTraLoi>({});
  const [moCau, setMoCau] = useState<Record<string, boolean>>({});
  /** Câu ĐÃ HÉ. Chỉ thêm, không bao giờ bớt — xem hiệu ứng hé dần bên dưới. */
  const [hien, setHien] = useState<Record<string, boolean>>({});
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);

  /** Câu đang hiện theo lời khai — `no_so` chỉ có mặt với người có nợ (`phong_van.ts`). */
  const cauHien = useMemo(() => cauDangHien(traLoi), [traLoi]);

  /*
   * ⚠⚠ HÉ DẦN THEO *TRẠNG THÁI XONG*, KHÔNG THEO CHỈ SỐ — và hé đúng MỘT câu mỗi lượt.
   *
   * Câu NHIỀU có đáp án từ chip ĐẦU TIÊN, nên nếu chỉ nhìn "đã có trả lời chưa" thì câu kế bật
   * ra trong lúc câu trước vẫn đang mở: ba câu ĐO nằm cùng màn (hỏng phép đo — xem chú thích ở
   * chỗ render), và màn tự nhảy thêm một khối mỗi lần chạm chip.
   *
   * ⚠ Dùng TẬP ID chứ không dùng con trỏ số: `cauHien` co giãn (câu `no_so` xuất hiện/biến mất
   *   theo câu nợ), nên một chỉ số nguyên trỏ lệch ngay khi danh sách đổi độ dài.
   * ⚠ Tập chỉ THÊM: mở lại câu 2 sau khi đã trả lời câu 8 KHÔNG được giấu câu 3..8 đi.
   * ⚠ Không đổi gì thì trả về ĐÚNG `cu` — React bỏ qua, không có vòng lặp render.
   */
  useEffect(() => {
    setHien((cu) => {
      const moi = { ...cu };
      let doi = false;
      for (const c of cauHien) {
        if (moi[c.id] !== true) { moi[c.id] = true; doi = true; }
        /* Câu này chưa xong hẳn ⇒ DỪNG, không hé tiếp. */
        if (traLoi[c.id] === undefined || moCau[c.id] === true) break;
      }
      return doi ? moi : cu;
    });
    /*
     * ⚠⚠ HÉ TRỌN MỘT LƯỢT, KHÔNG HÉ TỪNG CÂU RỒI CHỜ LƯỢT SAU. Bản đầu `return` ngay sau khi
     * hé một câu, định để hiệu ứng tự chạy lại — nhưng `hien` KHÔNG nằm trong danh sách phụ
     * thuộc (và không được nằm: đưa vào là vòng lặp), nên `setHien` không kích hiệu ứng lần
     * nữa. Kết quả: mở màn với hồ sơ cũ thì hé đúng 2 câu rồi ĐỨNG IM — không câu nào mở,
     * không nút XONG, màn thành ngõ cụt. Đã dựng chạy thật mới thấy; không bài test nào đỏ.
     */
  }, [cauHien, traLoi, moCau]);

  /*
   * ĐIỀN SẴN — một lần, sau khi hồ sơ cũ đã đọc xong. Điền trước lúc hồ sơ về
   * thì lượt sau ghi đè lựa chọn người dùng vừa chạm.
   *
   * ⚠⚠ D360 — ĐIỀU KIỆN LÀ `sanSang`, KHÔNG PHẢI `!dangTai`. `dangTai = isPending && kho !== null` nên
   * trong lúc kho ĐANG MỞ nó đã là `false` khi chưa đọc được byte nào ⇒ mở nguội thẳng
   * `/tai-chinh/phong-van` (nạp lại trang, hoặc mở từ link) thì lớp điền sẵn chạy trên `hoSoCu = {}` rồi
   * KHOÁ (`daDien` chỉ cho chạy một lần) — người quay lại "SỬA SÁU CÂU" thấy cả sáu câu TRỐNG, tưởng app
   * quên hết lời khai của mình. Không mất dữ liệu (`xong()` trộn vào bản của kho, D358/D360) nhưng nó là
   * một lời nói dối về chính hồ sơ người dùng. Đi từ ⚙ thì cache ấm nên chưa ai gặp.
   *
   * ⚠ HAI LỚP, ĐÚNG THỨ TỰ NÀY (D308): đáp án GAME trước, câu ĐÃ TRẢ LỜI đè lên.
   * Từ D308 màn này mở lại được (⚙ › SỬA SÁU CÂU, và nút ĐỔI KHUNG trên lộ
   * trình), nên người quay lại phải thấy đúng chip họ đã chạm — để đáp án game
   * thắng là app tự ý đổi lựa chọn của họ sau lưng.
   */
  /*
   * D324 — ⚑ CHỈ KHI CỬA `noi_game` MỞ, và chỉ từ SỐ THẬT (`gameDienSan`). Cửa đóng thì
   * không gọi tín hiệu và không điền gì: người dùng chưa cho phép ghép cách chơi với sổ,
   * nên sổ không được mượn cách chơi để trả lời thay họ.
   * ⚠ Cửa mở mà tín hiệu chưa về ⇒ CHỜ rồi mới điền (không thì lượt điền đầu bỏ lỡ ⚑, và
   * vì điền chỉ chạy một lần, người dùng không bao giờ thấy nó).
   */
  const noiGame = useCuaPfm()?.noi_game === true;
  const th = useTinHieuGame(noiGame);
  const game = useMemo(() => (noiGame ? gameDienSan(th.data) : {}), [noiGame, th.data]);
  const choTinHieu = noiGame && th.isPending;

  /*
   * ⚠⚠ CỜ "ĐÃ ĐIỀN" LÀ BẮT BUỘC, không phải tối ưu (tự vấp D324). `hoSoCu` là object MỚI mỗi
   * lượt render, nên hiệu ứng chạy lại mỗi lượt; trước D324 hai hằng số ⚑ luôn làm bảng trả
   * lời CÓ KHOÁ nên nhánh `Object.keys(cu).length` chặn vòng lặp. Bỏ hằng số đi thì người chưa
   * có hồ sơ nhận `{}` MỚI mỗi lần ⇒ đổi state ⇒ render ⇒ hiệu ứng ⇒ `{}` mới… — treo cả màn
   * (bài `phong_van.test.tsx` đứng im tới hết giờ). Điền sẵn đúng MỘT lần, như chú thích luôn nói.
   */
  const daDien = useRef(false);

  useEffect(() => {
    if (!coHoSo || choTinHieu || daDien.current) return;
    daDien.current = true;
    setTraLoi((cu) => {
      const dau: BangTraLoi = {};
      for (const c of CAU_PV) {
        const g = game[c.id];
        if (g) dau[c.id] = [g];
      }
      /*
       * ⚠⚠ TRỘN, KHÔNG BỎ CUỘC. Bản cũ mở đầu bằng `if (Object.keys(cu).length) return cu;` —
       * ý tốt (đừng đè lên thứ người dùng vừa chạm) nhưng nó BỎ LUÔN cả lớp điền sẵn: chỉ cần
       * chạm MỘT chip trước khi hồ sơ cũ kịp nạp (`coHoSo` chưa true) là `cu` đã có khoá, mà
       * `daDien` chỉ cho chạy đúng một lần ⇒ lời khai cũ KHÔNG BAO GIỜ được điền lại.
       *
       * Trước 21/09 hậu quả còn nhẹ: nút XONG luôn hiện nên nộp mà không đụng câu nào thì câu
       * ấy vắng khỏi `sach` và giá trị cũ sống sót. Từ khi HÉ DẦN, muốn hiện nút XONG thì phải
       * XỬ hết câu — mà "bỏ qua" ghi `null`, và `null` XOÁ khoá (`KHOA_THEO_CAU`). Tức người
       * mở "⚙ › SỬA CHÍN CÂU" để sửa một câu, chạm hơi nhanh rồi bỏ qua phần còn lại, sẽ
       * XOÁ SẠCH lời khai cũ mà không thấy một dấu hiệu nào.
       *
       * Thứ tự dưới đây là thứ tự ƯU TIÊN NGƯỢC: game điền sẵn → hồ sơ đã lưu đè lên (D308) →
       * và thứ NGƯỜI DÙNG VỪA CHẠM trong phiên này đè lên trên cùng. Lời gần nhất vẫn thắng.
       */
      return { ...dau, ...traLoiTuHoSo(hoSoCu), ...cu };
    });
  }, [coHoSo, hoSoCu, choTinHieu, game]);

  /* ⚠ CHỈ còn cần biết thẻ ĐÃ NỞ CHƯA (ô chứng "GAME"), không còn vẽ chính tấm thẻ ở màn này
     — thẻ đo-từ-trận nay ở `/ho-so/the` (chỉ thị founder 21/09). Xem khối render. */
  const daCoThe = !!tc.data?.goi;

  const dsDap = (id: string): string[] => traLoi[id] ?? [];
  const coDap = (id: string, t: string) => dsDap(id).includes(t);

  function chamChip(c: typeof CAU_PV[number], t: string) {
    setTraLoi((cu) => {
      const v = (cu[c.id] ?? []).slice();
      if (c.nhieu) {
        const i = v.indexOf(t);
        if (i >= 0) v.splice(i, 1); else v.push(t);
        return { ...cu, [c.id]: v.length ? v : undefined };
      }
      return { ...cu, [c.id]: coDap(c.id, t) ? undefined : [t] };
    });
    // Câu NHIỀU giữ mở (còn chọn tiếp); câu MỘT thu ngay — đúng demo.
    setMoCau((cu) => ({ ...cu, [c.id]: c.nhieu === true }));
  }

  async function xong() {
    if (dangLuu) return;
    setDangLuu(true);
    setLoi(null);
    try {
      const sach: Record<string, string[] | null> = {};
      for (const [k, v] of Object.entries(traLoi)) if (v !== undefined) sach[k] = v;
      /*
       * ⚠⚠ ĐỌC–SỬA–GHI TỪ KHO, không trộn vào `hoSoCu` của state (D358). `useHoSo()` trả `{}` trong lúc hồ sơ CHƯA
       * nạp xong; bản cũ dựng `{ ...hoSoCu, … }` từ state ấy ⇒ bấm XONG trong cửa sổ đó là ghi `{}` đè MẤT TRỌN hồ sơ
       * (kể cả hũ mẫu, khối đã bỏ, dấu vết chân dung). Cùng họ lỗi với màn NGÀY ĐẦU; bài `ngay_dau.test.tsx` §VI-bis
       * tái hiện được. Đọc lại ngay trong lượt ghi thì state cũ hay chưa nạp đều không còn là nguồn của dữ liệu.
       * ⚠ D360 — phép đọc–sửa–ghi giờ là `suaHoSo` (`ho_so.ts` §2b): MỘT cửa cho cả ba màn ghi hồ sơ (A11.5), và
       * nó XẾP HÀNG các phép sửa. Thân hàm dưới đây không đổi một dòng — chỉ thôi tự đọc/tự ghi.
       */
      await ghi(['meta'], (kho) => suaHoSo(kho, (cu) => {
        const moi: HoSo = { ...cu, ...hoSoTuTraLoi(sach) };
        /*
         * ⚠ "ĐỂ SAU" TRÊN MỘT CÂU ĐÃ TRẢ LỜI = XOÁ CÂU ẤY (D308). Trước D308 màn
         * này chỉ mở đúng một lần nên trộn-không-xoá là đủ; giờ nó sửa lại được,
         * và không xoá thì người dùng KHÔNG CÓ ĐƯỜNG NÀO rút lại một câu — họ bấm
         * "để sau", app gật đầu, rồi giữ nguyên câu cũ. Bảng khoá ở `phong_van.ts`.
         */
        for (const [id, v] of Object.entries(sach)) {
          if (v !== null) continue;
          for (const k of KHOA_THEO_CAU[id] ?? []) delete moi[k];
        }
        /*
         * ⚠⚠ CÂU ĐANG BỊ ẨN CŨNG PHẢI XOÁ (21/09). Câu `no_so` là câu ĐIỀU KIỆN: trả lời rồi
         * vẫn biến mất được, khi người dùng mở lại câu nợ và đổi sang "không có". Lúc ấy nó
         * không còn trong `cauDangHien` nên không vòng lặp nào chạm tới, `sach` không có khoá
         * ấy, và giá trị CŨ sống sót IM LẶNG — người dùng vừa nói "tôi không có nợ" mà hồ sơ
         * vẫn giữ "500k–2tr · trên 6 tháng". Luật ở `phong_van.ts` §`khoaCauAn`.
         */
        for (const k of khoaCauAn(traLoi)) delete moi[k];
        /*
         * Trả lời lại câu 4 ⇒ dọn sạch danh sách khối đã bấm BỎ trên lộ trình. Đây
         * là ĐƯỜNG VỀ duy nhất của nút BỎ, và nó đúng nghĩa: bạn vừa nói lại mình
         * muốn tiền làm gì, nên lộ trình bày lại đủ khối theo lời mới.
         */
        /*
         * ⚠⚠ SO GIÁ TRỊ, KHÔNG SO SỰ CÓ MẶT CỦA KHOÁ — hồi quy do chính lượt hé dần này gây ra.
         * Trước 21/09 nút XONG luôn hiện, nên nộp mà không chạm câu 4 thì `sach` không có khoá
         * `muc_tieu` và `loTrinhBo` sống sót. Từ khi hé dần, MỌI lượt nộp buộc phải xử hết câu
         * mới hiện được nút ⇒ `'muc_tieu' in sach` LUÔN đúng ⇒ danh sách khối người dùng đã bấm
         * BỎ trên lộ trình bị xoá ở mọi lượt nộp, kể cả khi họ lặp lại y nguyên đáp án cũ.
         * Đúng cùng luật mà `donDauVetSauPhongVan` đã dùng: lời gần nhất thắng, nhưng chỉ khi
         * người dùng THẬT SỰ nói khác đi.
         */
        const mtMoi = JSON.stringify(sach.muc_tieu ?? null);
        const mtCu = JSON.stringify(cu.mucTieu ?? null);
        if ('muc_tieu' in sach && mtMoi !== mtCu) delete moi.loTrinhBo;
        /*
         * D358 — câu đứng sau một NÉT chân dung mà ĐỔI ⇒ lời "không hẳn"/chip tự chọn dựng trên câu cũ hết hiệu lực:
         * lời gần nhất của người dùng thắng. So GIÁ TRỊ (màn này điền sẵn đáp án cũ) — luật ở `chan_dung.ts`.
         */
        return donDauVetSauPhongVan(cu, moi);
      }, bayGio()));
      danhDauDaPhongVan(chu);
      /*
       * D355 — phỏng vấn xong dẫn sang NGÀY ĐẦU (chân dung + ba việc), KHÔNG còn thẳng
       * sang LỘ TRÌNH (founder 08/09 chỉ định lộ trình; D355 thay đích mà không đổi ý
       * gốc "dẫn thẳng"). LỘ TRÌNH vẫn sống, vẫn tới được từ ⚙.
       */
      /*
       * 21/09 — ĐÍCH ĐỔI SANG CHÂN DUNG. Demo đã chốt đi PHỎNG VẤN → CHÂN DUNG → VIỆC, và
       * chân dung là thứ trả lời câu *"tôi vừa khai một đống, được gì?"* ngay tại chỗ. Màn
       * NGÀY ĐẦU không mất: nút chính của chân dung dẫn thẳng sang nó.
       */
      navigate(ROUTE_TAI_CHINH_THE, { replace: true });
    } catch (e) {
      setDangLuu(false);
      // D360 — câu chung ở `pfm_chu.ts`; thông điệp kỹ thuật của `Error` KHÔNG hợp để đưa ra màn (nó là chuỗi
      // lập trình, và là chỗ PII rò ra tự nhiên nhất — xem `maLoi`).
      setLoi(CHU_LOI_GHI);
      baoLoiNen(e);
    }
  }

  const soDaTraLoi = cauHien.filter((c) => (traLoi[c.id] ?? null) !== null).length;
  /* Còn việc dở = còn câu chưa hé, chưa xử, hoặc đang mở dở (câu NHIỀU đang chọn). */
  const conDo = cauHien.some(
    (c) => hien[c.id] !== true || traLoi[c.id] === undefined || moCau[c.id] === true,
  );

  return (
    <>
      <div className={s.the}>
        <p className={s.nhan}>BẠN KHÔNG BẮT ĐẦU TỪ 0</p>
        {/*
          ⚠⚠ KHÔNG VẼ THẺ TÍNH CÁCH Ở ĐÂY NỮA (21/09). Chỉ thị founder: *"Thẻ tính cách từ
          alpha draft thì vẫn giữ nguyên nhưng để trên profile còn thẻ PFM thì riêng nhé"*.
          Trước đó màn này render thẳng tấm thẻ ĐO TỪ TRẬN (emoji + tên + đọc vị) ngay đầu
          phỏng vấn — tức PFM mượn thẻ của Đấu trường làm mặt tiền của mình.
          Ba ô chứng thì GIỮ: chúng nói về NGUỒN bằng chứng (game · tự khai · sổ), đó là
          khung của PFM chứ không phải tấm thẻ của game. Nhắc tới game mà không chiếm nó.
        */}
        <KhoiChungNhan daCoThe={daCoThe} />
        <p className={s.dong}>
          {daCoThe ? 'Hai' : 'Một'} trong ba nhân chứng đã sáng. Mấy câu dưới đây là
          để nốt cái thứ ba — chạm chip, không phải gõ. Không câu nào hỏi thu nhập của bạn.
        </p>
      </div>

      <div className={s.the}>
        <p className={s.nhan}>{cauHien.length} CÂU · CHẠM LÀ XONG · BỎ QUA ĐƯỢC HẾT</p>
        <p className={s.giai}>
          Mấy câu đầu là để <b>biết bạn</b>. Mấy câu sau là để <b>đo</b> — không có đáp
          án đúng. Câu nào <b>game đã trả lời được</b> thì điền sẵn và đánh dấu ⚑, bạn
          chỉ xác nhận hoặc chạm cái khác. Bỏ hết vẫn đi tiếp được, chỉ là thô hơn.
        </p>

        <div data-testid="ds-cau">
          {cauHien.map((c, i) => {
            /*
             * ⚠⚠ HÉ DẦN: câu chưa tới thì CHƯA hiện (khác bản cũ — bản cũ trải hết ra).
             * Lý do là PHÉP ĐO, không phải thẩm mỹ: ba câu ĐO mà nhìn thấy cùng lúc thì
             * người ta trả lời cho NHẤT QUÁN với nhau — dựng một chân dung mạch lạc về
             * mình — thay vì trả lời từng câu thật. Đó là chỗ tự khai trôi nhiều nhất, mà
             * tự khai vốn đã là hạng bằng chứng yếu (P6). Luật hé ở hiệu ứng `hien`.
             */
            if (hien[c.id] !== true) return null;
            const ds = traLoi[c.id];
            const daXu = ds !== undefined;
            const thu = daXu && !moCau[c.id];
            if (thu) {
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${s.cauThu} ${ds ? s.cauXong : s.cauBo}`}
                  onClick={() => setMoCau((cu) => ({ ...cu, [c.id]: true }))}
                >
                  <span className={s.cauSo}>{ds ? '✓' : '–'}</span>
                  <span className={s.cauHoi}>{c.hoi}</span>
                  <span className={ds ? s.dap : s.dapBo}>{ds ? ds.join(' · ') : 'để sau'}</span>
                  <span className={s.doi}>ĐỔI</span>
                </button>
              );
            }
            return (
              <div key={c.id} className={s.cau}>
                <div className={s.cauDau}>
                  <span className={s.cauSo}>{ds ? '✓' : (ds === null ? '–' : String(i + 1))}</span>
                  <span className={s.cauHoi}>{c.hoi}</span>
                </div>
                {c.phu && <p className={s.cauPhu}>{c.phu}</p>}
                {/*
                  ⚠ DÀI/NGẮN QUYẾT THEO CẢ CÂU, không theo từng chip: một câu có chip nhỏ
                  đứng cạnh chip tràn ngang thì đọc ra là lỗi chứ không phải thiết kế. Và
                  chip tràn ngang bỏ nền xám — founder 21/09 kêu *"chữ trắng trên nền xám
                  hơi khó nhìn"*, mà thủ phạm không phải tỷ lệ tương phản (11,06 — đạt AAA)
                  mà là DIỆN TÍCH: mảng mid-tone lớn giữa một màn gần-đen thì chói.
                */}
                <div className={`${s.chips} ${c.dap.some((t) => t.length > 18) ? s.chipsDai : ''}`}>
                  {c.dap.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${s.chip} ${game[c.id] === t ? s.chipGame : ''}`}
                      aria-pressed={coDap(c.id, t)}
                      onClick={() => chamChip(c, t)}
                    >
                      {t}
                    </button>
                  ))}
                  {c.nhieu && dsDap(c.id).length > 0 && (
                    <button
                      type="button"
                      className={`${s.chip} ${s.chipXong}`}
                      onClick={() => setMoCau((cu) => ({ ...cu, [c.id]: false }))}
                    >
                      ✓ XONG ({dsDap(c.id).length})
                    </button>
                  )}
                </div>
                {/*
                  BỎ QUA = TEXT LINK, không phải chip (chỉ thị founder 21/09). Vùng chạm vẫn
                  44px — nhẹ hơn về thị giác nhưng KHÔNG giấu, vì ai bỏ qua và bỏ ở câu nào
                  chính là dữ liệu; làm nó khó bấm là ép tự khai bằng áp lực giao diện (P5/P6).
                */}
                <div className={s.boHang}>
                  <button
                    type="button" className={s.boLink}
                    onClick={() => {
                      setTraLoi((cu) => ({ ...cu, [c.id]: null }));
                      setMoCau((cu) => ({ ...cu, [c.id]: false }));
                    }}
                  >
                    bỏ qua câu này
                  </button>
                  <button
                    type="button" className={s.boLink}
                    onClick={() => {
                      setTraLoi((cu) => {
                        const moi = { ...cu };
                        for (const x of cauHien) if (moi[x.id] === undefined) moi[x.id] = null;
                        return moi;
                      });
                      setMoCau({});
                      setHien((cu) => {
                        const moi = { ...cu };
                        for (const x of cauHien) moi[x.id] = true;
                        return moi;
                      });
                    }}
                  >
                    bỏ qua hết
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {loi && <p className={s.loi} role="alert">✕ {loi}</p>}
        {/*
          ⚠ NÚT XONG CHỈ HIỆN KHI ĐÃ XỬ HẾT CÂU (chỉ thị founder 21/09). Bản cũ luôn hiện nút
          vì nó trải hết câu ra cùng lúc — nhìn một cái là biết còn bao nhiêu. Màn hé dần thì
          một nút "XONG" nằm sẵn dưới câu số 2 là mời người ta chốt khi chưa thấy phần còn lại.
          Muốn thoát sớm thì đã có "bỏ qua hết" ngay trên nó.
        */}
        {!conDo && (
          <div className={s.day}>
            <NeonButton type="button" block disabled={dangLuu} onClick={xong}>
              {dangLuu ? 'ĐANG LƯU…' : `▶ XONG — XEM CHÂN DUNG (${soDaTraLoi}/${cauHien.length})`}
            </NeonButton>
            <p className={s.ghiChu}>
              Câu trả lời nằm trên máy bạn. Chạm dòng bất kỳ ở trên để sửa, lúc nào cũng được.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default function PhongVan() {
  return (
    <ScreenFrame title="Phỏng vấn" live goc={<NutCaiDatPfm />} gon>
      <TabTaiChinh />
      <KhoProvider>
        <RuotPhongVan />
      </KhoProvider>
    </ScreenFrame>
  );
}
