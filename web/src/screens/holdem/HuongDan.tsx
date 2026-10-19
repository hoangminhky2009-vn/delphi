/**
 * MÀN TẬP — founder 02/08 (lần 2, nguyên văn): "phần hướng dẫn bạn thiết kế
 * riêng 1 màn chơi cố định để dạy họ chứ không phải bắt player ngồi đọc chữ".
 *
 * Nên trang này là BỆ PHÓNG: nút to tạo bàn tập (server ghim seed màn tập
 * — ai vào cũng gặp đúng một bàn, cùng bot, cùng thẻ) rồi nhảy thẳng vào
 * trận với trợ lý `CoachTap` dẫn từng bước theo trạng thái. Học bằng tay.
 *
 * ⚠ 07/09 — bàn tập đổi từ 8 ô sang 12 ô (`HOLDEM_DECISIONS.MAN_TAP_SEED_12`, từ
 * D303 luật v40 dùng `MAN_TAP_SEED_THUC_TE` — cùng kịch bản):
 * giờ có VAI (người chơi bốc CÁ NHÂN, bàn có Cá Mập/Tổ Chức/Đội Lái) và một
 * lần KỲ NGỘ ở giữa trận — kịch bản coach tương ứng ở `CoachTap.tsx`.
 * ⚠ D527 — bàn tập sang nhịp xen kẽ v58 (6 ô, `MAN_TAP_SEED_XEN_KE`, kịch bản `KICH_BAN_MINIGAME`): cùng luật trận thật, có vai, có
 * màn lõi + chợ trait; kỳ ngộ không còn.
 *
 * Phần chữ GIỮ nhưng THU vào <details> "đọc chi tiết" — nó vẫn là tài
 * liệu tra cứu tốt, chỉ không còn là cửa chính. Lint từ vựng D26 quét cả file.
 */
import { Link, useNavigate } from 'react-router-dom';
import { AuthGate } from '@/components/AuthGate';
import { BachKhoaCoChe } from '@/components/holdem/BachKhoaCoChe';
import { ScreenFrame } from '@/components/ScreenFrame';
import { useTaoTran } from '@/api/holdem';
import { ROUTE_ARENA, ROUTE_BACH_KHOA, duongDanTran } from '@/lib/vocab';
import { nhoTranTap } from '@/lib/man_tap_dau';
import { LOI_CHI_TRONG_MAN_CHU } from '@/lib/khung_minigame';
import { LICH_CHINH_SACH, NHIP_XEN_KE } from '@config/holdem';
import s from './HuongDan.module.css';

/*
 * D550 — số vòng trên trang ĐỌC từ bảng nhịp (`NHIP_XEN_KE`) và lịch kỳ họp (`LICH_CHINH_SACH.O_THEO_MAP`), không gõ tay: đổi luật là chữ
 * đổi theo (A11.5). `CO_TRAN` = cỡ ghim của khoá mặc định (`coBanGhim` — v63 `ban14` ⇒ 14); bài `huong_dan_phu_song` canh hai số này khớp.
 * Không import `coBanGhim` vào bundle: nó kéo cả bảng luật.
 */
export const CO_TRAN = 14;
const CO_TAP = 6;
const LICH_TRAN = NHIP_XEN_KE[CO_TRAN]!;
const LICH_TAP = NHIP_XEN_KE[CO_TAP]!;
const KY_HOP_TRAN = LICH_CHINH_SACH.O_THEO_MAP[CO_TRAN] ?? [];
const noi = (a: readonly number[]) => a.join(' · ');
const SO_CHU = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
const chuSo = (n: number) => SO_CHU[n] ?? String(n);

function Muc({ so, ten, children }: {
  so: string; ten: string; children: React.ReactNode;
}) {
  return (
    <section className={s.muc}>
      <h2 className={s.mucDau}><span className={s.mucSo}>{so}</span> {ten}</h2>
      {children}
    </section>
  );
}

function NutVaoManTap() {
  const navigate = useNavigate();
  const tao = useTaoTran();
  return (
    <>
      <button
        type="button"
        className={s.nutTap}
        disabled={tao.isPending}
        onClick={() => tao.mutate({ tap: true }, {
          // `?tap=1` bật trợ lý CoachTap trong màn trận — cờ trình bày thuần.
          // D336 lượt 2 — nhớ id bàn tập: thẻ TIẾP TỤC ở sảnh dắt về kèm trợ lý, không về bàn trơn.
          onSuccess: (d) => { nhoTranTap(d.match_id); navigate(`${duongDanTran(d.match_id)}?tap=1`); },
        })}
      >
        {tao.isPending ? 'ĐANG DỰNG BÀN TẬP…' : '▶ VÀO MÀN TẬP — HỌC BẰNG CÁCH CHƠI'}
      </button>
      {tao.isError && (
        <p className={s.loiTap}>Không dựng được bàn tập. Kiểm tra mạng rồi thử lại nhé.</p>
      )}
    </>
  );
}

export function HuongDan() {
  return (
    <ScreenFrame title="Hướng dẫn" live>
      <div className={s.trang}>
        <p className={s.mo}>
          Luật chơi một câu: mỗi người có Vốn khởi điểm, thị trường lật từng
          tấm thẻ, ai đoán đúng nhịp thì cuối bàn lãi nhiều hơn so với vốn của mình —
          và sau phần lớn các vòng còn một màn lõi 34 giây để bấm theo đường giá. Không cần biết gì
          về tài chính — biết bấm là chơi được, và cách học nhanh nhất là chơi
          thẳng bàn tập 6 ô bên dưới: có VAI, đủ màn lõi lẫn chợ trait, và trợ lý
          dắt tay — thua không mất xu nào.
        </p>

        <AuthGate>
          <NutVaoManTap />
        </AuthGate>

        {/* Tài liệu tra cứu — thu gọn, KHÔNG phải cửa chính (founder 02/08:
            dạy bằng màn chơi, không bắt ngồi đọc chữ). */}
        {/*
          13/09 — BÁCH KHOA CƠ CHẾ đứng NGOÀI khối "đọc chi tiết luật", không nằm
          trong nó. Ba thứ nó kể (đám đông bẻ ô · trượt giá · tin trước mở cửa tin
          sau) là thứ chợ LÀM VỚI người chơi và đang ăn vào tiền của họ — khác hẳn
          phần luật nền ai cũng đoán được. Nhét vào trong `details` là chôn nó dưới
          một cú bấm nữa, đúng thứ founder đang phàn nàn: *"chưa có chỗ nào thể hiện
          hay giải thích rõ ràng"*.
          ⚠ Cùng một component với chỗ mở trong trận (nút SỔ) — một nguồn, hai cửa.
        */}
        <BachKhoaCoChe />
        {/* D334 — ba cơ chế trên là bản gọn; bách khoa đầy đủ (vai · sáu mã · lõi · thẻ tin · lãi suất…) ở màn riêng. */}
        <Link to={ROUTE_BACH_KHOA} className={s.moBachKhoa} data-testid="huong-dan-bach-khoa">
          MỞ BÁCH KHOA ĐẦY ĐỦ ›
        </Link>

        <details className={s.docThem}>
          <summary className={s.docThemMo}>ĐỌC CHI TIẾT LUẬT — bấm mở</summary>

        {/*
          D524 (founder 05/10: "phần hướng dẫn trong local đang dùng bản cũ à? Cập nhật bản mới đi chứ") — viết lại cho TRẬN THẬT v57 (minigame theo lõi).
          D527 — nhịp xen kẽ v58: trận thật 8 ô · 7 vòng, sau mỗi lần chốt MỘT chặng (màn lõi hoặc chợ trait); bàn tập sang CÙNG luật (6 ô).
          D550 — trận thật 14 ô · 13 vòng (v63): số vòng đọc từ `NHIP_XEN_KE` (đầu tệp), không gõ tay.
          Ba mục "CHỈ CÒN Ở BÀN TẬP" (đám đông đổi ô · kỳ ngộ · ngân hàng/bảng điện tử/tin bịa) gỡ: không trận mới nào còn chúng; trận tập
          v54 dở vẫn chạy luật của nó. Chữ MÔ TẢ, không kê đơn (A10). Bài canh độ phủ: web/tests/huong_dan_phu_song.test.tsx.
        */}
        <Muc so="01" ten="THẮNG THUA TÍNH THẾ NÀO">
          <p>
            Mỗi ghế vào bàn với <b>vốn theo vai</b> — vai lớn cầm nhiều chip hơn hẳn. Vì thế cuối trận xếp hạng theo
            <b> phần trăm lãi so với vốn đầu của chính mình</b>, không theo số chip tuyệt đối: Tổ Chức cầm vốn gấp năm
            mươi lần vẫn có thể đứng sau một Cá nhân đọc đúng nhịp.
          </p>
          <p>
            Con số lớn ở đầu màn là lãi/lỗ <b>của vòng vừa rồi</b>, tính trên tổng tài sản ngay trước vòng đó. Chạm vào
            nó để mở bảng VÌ SAO — mỗi dòng một nguyên nhân, dòng đậm nhất là dòng ăn tiền nhất.
          </p>
        </Muc>

        <Muc so="02" ten="MỘT VÒNG DIỄN RA THẾ NÀO">
          <ol className={s.buoc}>
            <li><b>Vòng 1 là lượt chọn lõi</b> — lấy lá lõi đầu tiên (mục 14), rồi trận mới chạy.</li>
            <li><b>Đặt lệnh</b> (khoảng 15 giây) — mua, bán, khống, hoặc đứng im.</li>
            <li><b>Chốt vòng</b> — hết giờ thì server chốt hộ theo đúng thứ bạn đang để trên bàn.</li>
            <li><b>Ô lật</b> — thẻ thị trường mở ra, mọi mã ăn hoặc mất theo nó; đọc kết quả vài giây.</li>
            <li><b>Một chặng</b> — <b>màn lõi</b> (lật thẻ, chọn một lõi đang cầm, rồi mã bạn nắm nhiều nhất chạy một
              đường giá 34 giây; bạn bấm theo lõi — mục 17) <b>hoặc chợ trait</b> (mục 16). Hai thứ xen nhau; riêng vòng 1
              có cả hai: màn trước, chợ sau.</li>
          </ol>
          <p className={s.chuY}>
            Mỗi vòng có đồng hồ; vòng có lượt chọn lõi hay chợ trait thì dài thêm một chút. Cả trận chừng mười lăm phút. Bàn tập
            không chạy đồng hồ — đủ thời gian đọc.
          </p>
        </Muc>

        <Muc so="03" ten="CỠ BÀN — TRẬN THẬT MỘT CỠ">
          <ul className={s.gach}>
            <li><b>Trận thật: {CO_TRAN} ô</b> — ô đầu lật sẵn, nên chơi {CO_TRAN - 1} vòng: {chuSo(LICH_TRAN.man.length)} màn lõi xen
              {' '}{chuSo(LICH_TRAN.trait.length)} chợ trait; ngân hàng trung ương họp ở ô {noi(KY_HOP_TRAN)}. Chợ trait nhiều: có người lấy
              ngay từ chợ đầu, có người giữ xu chờ chợ sau. Bàn bốn tới tám ghế.</li>
            <li><b>Bàn tập: {CO_TAP} ô</b> — cùng luật chơi, {CO_TAP - 1} vòng: {chuSo(LICH_TAP.man.length)} màn lõi, {chuSo(LICH_TAP.trait.length)} chợ
              trait, có trợ lý dắt tay.</li>
          </ul>
          <p>
            Không còn gì phải mở khoá: vào trận là chơi đủ luật từ trận đầu.
          </p>
        </Muc>

        <Muc so="04" ten="VAI — BẠN LÀ AI Ở BÀN NÀY">
          <ul className={s.gach}>
            <li><b>Vai bốc theo xác suất</b> khi vào bàn, không chọn được. Bàn ít ghế phần lớn chỉ có Cá nhân chơi với
              nhau và với thị trường; bàn đông thì có thể vài Cá Mập, Đội Lái, Tổ Chức cùng lúc.</li>
            <li><b>Vốn theo vai</b>: Cá nhân ×1 · Đội Lái ×10 · Cá Mập ×20 · Tổ Chức ×50. Lệnh của vai lớn <b>tự đẩy giá</b>
              trong màn; phí lệnh của vai vốn to tính trên độ sâu chợ lớn hơn — lệnh vừa trả như Cá nhân, dồn hết thì
              đắt hơn hẳn.</li>
            <li><b>NHÀ ĐẦU TƯ CÁ NHÂN</b> — tự do xoay, không ràng buộc. Một mình không đẩy nổi giá, nhưng cả bầy cùng
              làm một việc thì đẩy được (mục 17).</li>
            <li><b>CÁ MẬP</b> — cặp trait của vai: <b>ĐÒN BẨY ×1,5</b> trong màn và <b>TAY NẶNG</b> (lệnh đẩy giá và trượt
              giá gấp rưỡi).</li>
            <li><b>ĐỘI LÁI</b> — <b>TUNG TIN</b>: gài một tin giả đầu màn, mất phí, đám đông nhảy theo rồi tan; đổi lại
              <b> SOI PHÁP LÝ</b>: ôm vị thế to đúng lúc ô Siết pháp lý lật là bị trừ thẳng vốn.</li>
            <li><b>TỔ CHỨC</b> — <b>DÒNG TIỀN</b> (thấy mã nào cả bàn đang đổ vào) và <b>ỦY THÁC</b>: không margin — không
              Đòn Bẩy, không Bán Khống —, không mua mã nào quá 40% NAV, thua tới −8% vốn màn là tự chốt. Đổi lại: nến
              trắng vẫn khớp được (thoả thuận, trượt nặng hơn), mỗi vòng nhận phí quản lý, và có bàn nghiên cứu xác
              suất trong màn (mục 17).</li>
          </ul>
          <p>
            Dải ghế trên cùng kể vòng vừa rồi ai làm gì: <b>VÀO</b> (mua hoặc mở khống) · <b>RA</b> (bán hoặc đóng
            khống) · <b>ĐẢO</b> (vừa vào vừa ra) · <b>ĐỨNG</b> (không lệnh). Chỉ hướng — mua mã nào, bao nhiêu, vẫn giấu.
          </p>
        </Muc>

        <Muc so="05" ten="BẢN ĐỒ VÀ CHU KỲ — MỘT Ô LÀ NỬA NĂM">
          <p>
            Dãy ô trên đầu màn là dòng thời gian của chợ. <b>Một ô tương đương khoảng nửa năm ngoài đời</b>: {CO_TRAN} ô kể
            khoảng {chuSo(CO_TRAN / 2)} năm — đủ một nhịp lên xuống của chu kỳ kinh tế và phần đầu của nhịp sau.
          </p>
          <ul className={s.gach}>
            <li><b>Ô pha</b> — Tăng · Giảm · Đi ngang · Quá nóng · Phục hồi. Chúng đi thành chuỗi, không nhảy loạn.</li>
            <li><b>Chợ chạy theo MÙA</b> — PHỤC HỒI → TĂNG → QUÁ NÓNG → SUY THOÁI (lá Giảm) rồi
              lại phục hồi, có ngã rẽ: hạ cánh mềm, đáy kép, đình trệ. Lá pha phần lớn khớp mùa; tin đẩy nhanh hay đổi
              ngã rẽ.</li>
            <li>Chuỗi càng dài thì càng dễ gãy, nhưng chuỗi <b>giảm</b> gãy nhanh hơn chuỗi tăng — chợ xuống dốc nhanh
              hơn lúc leo.</li>
          </ul>
        </Muc>

        <Muc so="06" ten="THẺ THỊ TRƯỜNG — TIN TRÊN BẢN ĐỒ">
          <p>
            Xen giữa các ô pha là <b>ô tin</b>, gọi đúng tên trên thẻ: Hạ lãi suất · Tăng lãi suất · Lạm phát nóng ·
            Chiến tranh · Sàn khoá rút tiền · Bong bóng · Phá sản dây chuyền · Siết pháp lý · Cấm vận · Thảm hoạ tự
            nhiên · Khủng hoảng sinh học · Thiên nga đen. Mỗi tin đánh vào từng mã một kiểu.
          </p>
          <ul className={s.gach}>
            <li><b>Mọi tin trên bản đồ đều THẬT.</b> Tin giả chỉ còn một chỗ: Đội Lái gài trong màn (mục 04).</li>
            <li><b>Huy hiệu góc ô</b> nói TÍNH CHẤT của tin (vắt tiền · hưng phấn · hoảng loạn · lệch mã).</li>
            <li><b>Ô tin báo trước ô sau</b> — lời báo đó giữ.</li>
            <li><b>Sàn khoá rút tiền / cạn thanh khoản</b> chỉ ra sau một cơn hoảng loạn thật hoặc một chuỗi giảm — không
              tự dưng rơi xuống giữa trời quang.</li>
            <li>Trong màn lõi, thẻ của vòng nặn hình đường giá: cùng một điểm cuối, tin khác nhau đi đường khác nhau.</li>
          </ul>
        </Muc>

        <Muc so="07" ten="LÃI SUẤT VÀ Ô KỲ HỌP ⚖">
          <p>
            Chợ có một mặt bằng lãi suất chạy nền, hiện ở góc màn. Ô mang dấu <b>⚖ KỲ HỌP</b> là lịch công khai — bạn
            biết trước từ đầu trận là vòng nào ngân hàng trung ương họp, chỉ không biết họ sẽ làm gì.
          </p>
          <ul className={s.gach}>
            <li><b>TIỀN RẺ</b> (lãi suất thấp) — chợ dễ bay, bong bóng dễ là thật.</li>
            <li><b>TIỀN ĐẮT</b> (lãi suất cao) — chợ nặng, bong bóng dễ xì.</li>
            <li>Ngân hàng trung ương <b>có thể làm sai</b> so với thứ hoàn cảnh đòi hỏi. Bảng kỳ họp hiện cả cặp: thị
              trường kỳ vọng gì, và họ đã làm gì.</li>
            <li>Họ <b>GIỮ NGUYÊN</b> là chuyện thường, không phải cú cắt xu hướng.</li>
            <li><b>Trái phiếu trả lãi cho bạn</b> — tiền vào thẳng <b>tiền mặt</b>, không cộng vào giá. Nên nó là lá
              duy nhất vẫn đưa bạn tiền trong lúc <b>giá của chính nó đang rơi</b>.</li>
            <li>⚠ Nhưng <b>phải GIỮ ĐỦ MỘT Ô mới được lãi của ô đó</b>. Ngoài đời đúng vậy: ai mua giữa kỳ thì trả phần
              lãi đã dồn cho người bán — không ai nhặt được lãi miễn phí bằng cách nhảy vào sát ngày chốt.</li>
            <li>⚠ Nó trả theo <b>LỢI SUẤT DÀI</b> (tờ 10 năm), không theo lãi suất nền. Ngân hàng tăng lãi 100 thì lợi
              suất dài chỉ nhích khoảng <b>40</b> — lãi ngắn là thứ ngân hàng bấm được, lãi dài là thứ cả thị trường
              đoán về nhiều năm sau.</li>
            <li>⭐ Khi lãi tăng liên tiếp, <b>lợi suất dài tụt xuống DƯỚI lãi suất nền</b> — màn báo <b>ĐƯỜNG CONG ĐẢO
              NGƯỢC</b>: tiền ngắn hạn trả cao hơn tiền dài hạn. Ngoài đời đây là chỉ báo suy thoái được theo dõi kỹ nhất.</li>
            <li>Ngược lại, <b>bán khống trái phiếu thì BẠN trả khoản lãi đó</b>. Luật giữ đủ một ô áp cả hai chiều.</li>
          </ul>
        </Muc>

        <Muc so="08" ten="SỨC CĂNG — CÀNG BAY LÂU, RƠI CÀNG ĐAU">
          <p>
            Mỗi mã tích một <b>sức căng</b> khi nó bay lâu trong pha thuận, nhất là mã có sổ lệnh mỏng và lúc tiền đang
            rẻ. Sức căng hiện thành ba dải: <b>ÊM · CĂNG · RẤT CĂNG</b>.
          </p>
          <p>
            Căng thì lãi phồng thêm — nhưng lúc quay đầu, <b>mã căng nhất chịu đòn nặng nhất</b>, và nặng hơn hẳn phần
            nó đã thưởng. Trong màn lõi, mã càng căng càng dễ gặp một cú quét sâu. Bảng VÌ SAO gọi tên dải sức căng ở
            đúng mắt xích đó.
          </p>
        </Muc>

        <Muc so="09" ten="ĐẶT LỆNH — KHỐI TAY, CỌC CHIP, MỐC">
          <p>
            Bàn có <b>sáu món</b>, chia hai phe. Phe <b>rủi ro</b>: <b>Crypto</b> (tiền mã hoá, không ngân hàng nào đỡ khi
            nó rơi) · <b>Cổ tech</b> (đặt cược vào lợi nhuận tương lai xa — nhạy với tiền rẻ và lãi suất, nên lên
            xuống mạnh hơn cả thị trường chung) · <b>Blue-chip</b> (rổ 30 mã vốn hoá lớn nhất sàn). Phe <b>phòng thủ</b>:
            <b> Vàng</b> · <b>Stablecoin</b> (đồng tiền số neo vào đô la, nằm trên sàn crypto) · <b>Trái phiếu</b>
            (chính phủ vay tiền, trả lãi đều).
          </p>
          <p className={s.chuY}>
            Chạm dấu <b>(!)</b> ở góc mỗi lá để đọc nó là gì ngoài đời và nó ăn đòn ở đâu. Không lá nào tốt mọi lúc — đó
            là cả trò chơi.
          </p>
          <ul className={s.gach}>
            <li><b>Khối TAY</b> là những mã đang bày. Chạm một lá để nhấc chip lên, chạm lần nữa để đặt xuống.</li>
            <li><b>Cọc chip</b> dưới mỗi lá là vị thế bạn đang giữ ở mã đó. Cọc của đối thủ cũng đọc được.</li>
            <li>Lệnh đặt theo <b>MỐC phần trăm vốn</b>, không gõ số lẻ. Lệnh khớp lúc chốt vòng.</li>
          </ul>
        </Muc>

        <Muc so="10" ten="BA CÁI BẪY TIÊU TIỀN">
          <ul className={s.gach}>
            <li><b>Ôm tiền mặt</b> — tiền mặt <b>không</b> là chỗ trốn. Mỗi vòng nó đã mòn một chút, và khi ô <b>LẠM PHÁT
              NÓNG</b> lật lên thì nó bị ăn một miếng lớn ngay lập tức. Đứng ngoài cũng không thoát: bạn vẫn cầm tiền mặt.</li>
            <li><b>Trượt giá</b> — mã có sổ mỏng mà cả bàn cùng dồn thì giá khớp xấu hẳn. Càng đông càng đau.</li>
            <li><b>Phí vội vàng</b> — mỗi mã, mỗi vòng có một phần đầu giá rẻ, tính trên tổng tiền mọi lệnh của mã ấy
              trong vòng; phần vượt bị đẩy giá. Dồn cả vốn trong một vòng vì thế cắn miếng to hơn hẳn vào dần qua nhiều
              vòng. Vai vốn to có phần giá rẻ rộng hơn, nhưng dồn hết vẫn đắt.</li>
          </ul>
          <p className={s.chuY}>
            Hai khoản dưới chảy vào Quỹ vòng, tức là chảy sang người thắng vòng đó. Riêng phần lạm phát ăn mất thì
            <b> bốc hơi</b> — không ai trên bàn nhận nó cả. Phí là tiền đổi chủ, lạm phát là tiền mất giá.
          </p>
        </Muc>

        <Muc so="11" ten="BÁN KHỐNG — CƯỢC MỘT MÃ ĐI XUỐNG">
          {/* D530 — khoá v60: lõi chỉ tác động trong màn ⇒ sổ khống ở shop không còn mở bằng lá Bán Khống; bán khống chỉ còn trong màn. */}
          <p>
            Bán khống chỉ chơi trong <b>màn lõi</b>, với lõi <b>Bán Khống</b> (mục 17): bán theo mức nhân trên mã bạn nắm nhiều
            nhất, giá rơi thì lãi, giá lên thì lỗ.
          </p>
          <ul className={s.gach}>
            <li>Lỗ chặn ở phần <b>ký quỹ</b>: chạm ngưỡng thì bị gọi ký quỹ — nạp thêm, hoặc bị thanh lý.</li>
            <li>Giữ vị thế khống trong màn trả <b>phí mượn</b> theo thời gian giữ.</li>
            <li><b>Tổ Chức không lấy được lõi Bán Khống</b> (uỷ thác, mục 04).</li>
          </ul>
        </Muc>

        <Muc so="12" ten="ĐÒN BẨY VÀ GỌI KÝ QUỸ">
          {/* D530 — khoá v60: Đòn Bẩy thôi nhân đôi ở tầng vòng (engine) — chỉ còn màn. */}
          <p>
            <b>Đòn Bẩy</b> chỉ tác động trong <b>màn lõi</b>: vào ×2 · ×4 · ×10, tăng mức, lãi lỗ nhân đúng mức đã chọn và có
            lãi vay. Lỗ tới ngưỡng thì bị <b>GỌI KÝ QUỸ</b> — nạp thêm hay bán hết; chạm sàn thì bị bán cưỡng bức (mục 17).
          </p>
          <p>
            Vòng không có màn, lá nghỉ: khoản đi đúng phần trăm thị trường. Tổ Chức không dùng được Đòn Bẩy.
          </p>
        </Muc>

        <Muc so="13" ten="BỎ · ĐỔI LÕI · ĐẦU HÀNG">
          <ul className={s.gach}>
            <li><b>BỎ</b> (cắt lỗ) — rút khỏi vòng này về tiền mặt. Mất phí, và số lần bỏ trong trận có hạn.</li>
            <li><b>ĐỔI LÕI</b> — đổi hai lá lõi đang bày ở quầy; mỗi lượt lõi đổi được một lần.</li>
            <li><b>ĐỨNG NGOÀI</b> — đóng băng vốn một vòng. Không miễn phí: vốn nằm im vẫn bị hao.</li>
            <li><b>ĐẦU HÀNG</b> — rời hẳn trận. Không quay lại được.</li>
          </ul>
        </Muc>

        <Muc so="14" ten="LÕI — NĂM CÁCH GIAO DỊCH, NĂM MÀN CHƠI">
          <p>
            Vòng {noi(LICH_TRAN.loi.slice(0, 2))} mở quầy <b>LÕI CHIẾN THUẬT</b>: chạm một lá để đọc rồi LẤY, giữ tới hết trận — tối đa
            hai lõi (ghế có trait KHẨU VỊ ĐA DẠNG được thêm lượt ở vòng {LICH_TRAN.loi[2]}, giữ tới ba). Vòng {noi(LICH_TRAN.loi.slice(1))}
            {' '}quầy lõi và chợ trait đứng chung một màn chọn. Mỗi lõi là một cách giao dịch và là một màn chơi riêng.
          </p>
          <ul className={s.gach}>
            <li><b>Bắt Đáy</b> — chờ giá rơi rồi vào; vào thấp hơn giá mở màn thì hơn người ôm suốt.</li>
            <li><b>Mua Đuổi</b> — vào theo đà, nhồi thêm; đuổi càng muộn càng đắt.</li>
            <li><b>Đòn Bẩy</b> — vay để nhân lãi lỗ, có ký quỹ và thanh lý.</li>
            <li><b>Bán Khống</b> — vay để bán, cũng ký quỹ, ngược chiều.</li>
            <li><b>Lướt Sóng</b> — cầm được, nhưng màn chỉ để xem (khung nến nhanh, không có nút): coi như giữ suốt.</li>
            {/* D530 — khoá v60 thay dòng "Gắn vào một mã" (engine thôi chạy lõi ở tầng vòng ⇒ không nhắm, không cộng hưởng/xung đột). */}
            <li><b>Chỉ trong màn</b> — {LOI_CHI_TRONG_MAN_CHU}</li>
          </ul>
        </Muc>

        <Muc so="15" ten="QUỸ VÒNG · XẾP HẠNG · KHẨU VỊ RỦI RO">
          <ul className={s.gach}>
            <li><b>Quỹ vòng</b> — mỗi vòng ai cũng góp một khoản nền, cộng mọi loại phí đã thu. Ai đọc đúng nhịp vòng đó
              thì ăn quỹ: quỹ chia cho vài ghế đứng đầu vòng theo hạng, và ghế nhất cũng chỉ nhận tới một trần.</li>
            <li><b>Xếp hạng</b> — chơi xong lên bậc, từ tôm lên cá voi. Bậc là chuyện cả mùa; vai là chuyện của riêng trận này.</li>
            <li><b>Khẩu vị rủi ro</b> — trận thật cho mọi ghế <b>cùng một hệ số</b>, không chọn ở sảnh. Khẩu vị hiện ra ở
              cách bạn chia tiền: dồn vào mã biến động mạnh là phóng to cả lãi lẫn lỗ, giữ phe phòng thủ là thu nhỏ cả hai —
              thận trọng hay quyết liệt nằm ở chính lệnh của bạn.</li>
          </ul>
        </Muc>

        <Muc so="16" ten="LỬA ĐÀ · XU · TRAIT">
          <ul className={s.gach}>
            <li><b>NGỌN LỬA ĐÀ</b> đứng cạnh thanh phong cách, bốn nấc từ tàn tới bùng. Mỗi vòng bạn giữ cùng một
              <b> phía</b> (nhóm mã chiếm phần lớn vị thế) thì chuỗi cộng một; <b>đổi phía</b> hay <b>đổi tay quá lớn</b>
              trong một vòng thì lửa tắt. Lửa cao thì trượt giá nhẹ đi và mã đang lãi được cộng thêm.</li>
            <li><b>XU</b> là ví duy nhất của trận. Mỗi vòng được cấp một ít, lửa thì nhận thêm theo nấc. Xu trả cho
              <b> đổi bài trong shop</b> và <b>cuộn lại chợ trait</b> — không bao giờ đổi ra chip.</li>
            <li><b>CHỢ TRAIT</b> là chặng thay chỗ màn lõi: mở đầu vòng {noi(LICH_TRAN.trait)} (bàn tập: {noi(LICH_TAP.trait)}), 45 giây. Một lượt mời gồm
              ba TÀI (điểm dương) và ba TRAIT (điểm âm), phần lấy về cân đúng 0 — lấy tài là nhận trait. Trait mang tới hết trận. Vai lớn có sẵn một cặp trait của vai
              (mục 04); RẢI LỆNH chỉ vai lớn có. Vài trait đổi thứ bạn nhìn thấy, như <b>SƯƠNG MÙ</b> cho lá pha mới lật
              hai mặt tới vòng sau; <b>KIÊN NHẪN</b> và <b>NÓNG VỘI</b> đổi giờ bấm trong màn.</li>
          </ul>
          <p className={s.chuY}>
            Lửa đo sự <b>nhất quán</b> của bạn, không đo chợ: giữ sai phía qua bốn vòng vẫn có lửa nấc ba — lửa không cứu
            phần đang lỗ.
          </p>
        </Muc>

        <Muc so="17" ten="MÀN LÕI — ĐƯỜNG GIÁ SAU MỖI VÒNG">
          <p>
            Sau vòng {noi(LICH_TRAN.man)} (bàn tập: {noi(LICH_TAP.man)}) là màn lõi: lật thẻ, chọn <b>một lõi đang cầm</b>, rồi mã bạn nắm
            nhiều nhất chạy một đường giá 34 giây.
            <b> Không bấm = giữ suốt</b>: khoản đi đúng thị trường, màn cộng thêm không. Bấm thì màn cộng phần chênh giữa
            theo lệnh và giữ suốt, có thể âm.
          </p>
          <ul className={s.gach}>
            <li><b>Nến trắng</b>: TRẮNG BÊN MUA thì không bán được, TRẮNG BÊN BÁN thì không mua được.</li>
            <li><b>Bảng phụ</b> phía trên chạy các mã khác đang cầm. Có cặp đi theo nhau, có cặp lúc theo lúc ngược, có
              cặp trơ rồi sập bù. Bấm GỌN để thu bảng.</li>
            <li><b>Bắt Đáy</b>: VÀO ba phần, phần sau to hơn phần trước (gom khi giá rơi thêm) · THOÁT. Thấy <b>đường giá trị</b> — giá trị gốc của kịch bản, trễ vài nến,
              có sai số — với dải dưới: giá trong dải là đang rẻ hơn giá trị, đường dốc xuống là cả giá trị đang sụt.
              Đường trễ nên không biết trước cú sập hay tin mạnh: ở thị trường cực đoan giá có thể rẻ mãi. Nhãn
              <b> QUÁ BÁN</b> dưới nến đã đóng hay đúng ở cuối sóng giảm, đôi khi báo nhầm.</li>
            <li><b>Mua Đuổi</b>: nhồi ba phần, phần sau nhỏ hơn phần trước; nhồi đủ ba phần thì ô VÀO thành <b>×2</b> — vay thêm
              bằng vốn màn, có lãi vay, lỗ sâu thì bị thanh lý. CHỐT lần đầu bán một nửa, lần hai bán hết (phần vay trả trước) —
              đuổi càng muộn (càng nhiều nến xanh liền nhau) trượt càng nặng. Thấy <b>mức ép</b> của phe bán khống (dải xanh): giá chạm vào thì họ bị mua cưỡng bức.</li>
            <li><b>Đòn Bẩy</b>: vào ×2 · ×4 · ×10, đang cầm thì tăng lên mức kế. Lỗ tới một nửa ký quỹ thì <b>điện thoại rung —
              bị gọi ký quỹ</b>: dải dưới đồ thị thành hàng nút bán (một khoản khác chịu phí, Tiền mặt không phí), nút giữa
              thành <b>BÁN HẾT</b>. Chạm sàn thì bị <b>bán cưỡng bức</b>: màn hình lóe đỏ, đồ thị và nút xám tới hết màn.</li>
            <li><b>Bán Khống</b> trong màn có ký quỹ như Đòn Bẩy, chỉ ngược chiều: giá lên tới ngưỡng thì bị gọi, lên tiếp thì
              bị <b>mua cưỡng bức</b>; chịu lãi vay. Thấy <b>sàn</b> của phe vay mua (dải đỏ).</li>
            <li><b>Thanh lý dây chuyền</b>: chợ luôn có đám đông vay hai phe; trước và trong ô Bong bóng phe vay mua dày hơn
              hẳn. Cú bán cưỡng bức đẩy giá có thể kéo người kế tiếp, và <b>để lại vết</b> — một phần không hồi, kể cả người
              chỉ giữ suốt cũng chịu. Mua ngược dòng bán tháo thì khớp giá xấu hơn.</li>
            <li><b>Bầy Cá nhân</b>: ba nến cùng màu liền nhau thì bầy Cá nhân (người nền và các ghế Cá nhân khác đang giữ mã,
              kể cả bot) đuổi theo — đẩy giá thêm một chút rồi tan.</li>
            <li><b>Lệnh lớn</b>: ghế bot Cá Mập hay Đội Lái cũng giữ mã của màn thì có lệnh lớn — Cá Mập gom sau đáy, Đội Lái kéo
              rồi xả (kèm một tin hội nhóm). Lúc cú đè hiện nhãn <b>◆ LỆNH LỚN</b>; <b>cột khối lượng</b> dưới nến cao vọt ở
              đó. Tổ Chức thấy ai đặt.</li>
            <li><b>Lệnh to tự đẩy giá</b>: Cá Mập, Đội Lái, Tổ Chức bấm mua là giá bị đẩy lên, bán là bị đẩy xuống. Vốn càng
              to đẩy càng mạnh, nhưng lệnh to gấp trăm lần chỉ đẩy mạnh gấp chục lần. <b>RẢI LỆNH</b> trải cú đẩy ra nhiều nến.</li>
            <li><b>Tổ Chức</b>: thua tới −8% vốn màn là <b>tự chốt</b>, búa pháp lý đập xuống, nút xám. Có dải <b>XÁC SUẤT</b>
              dưới chân đồ thị — khả năng tạo đáy (▼) và đỉnh (▲) theo từng khúc thời gian, của một mô hình chỉ biết thẻ của
              vòng; không ô nào quá 67%.</li>
          </ul>
          <p className={s.chuY}>
            Hết màn, bấm <b>VÌ SAO</b> để thấy ba lớp: thị trường đi bao nhiêu · đường đi ra sao · phần của bạn.
          </p>
        </Muc>

        <Muc so="18" ten="BA CÂU DẶN CUỐI">
          <ul className={s.gach}>
            <li>Chip trong Đấu trường là <b>chip ảo</b>, reset mỗi trận, không quy đổi ra bất cứ thứ gì.</li>
            <li>Không tín hiệu nào đúng 100% — kể cả đường giá trị, kể cả chuỗi đang chạy đẹp.</li>
            <li>Cách học nhanh nhất vẫn là bàn tập ở đầu trang: thua không mất gì.</li>
          </ul>
        </Muc>

        </details>

        <Link to={ROUTE_ARENA} className={s.nutVe}>← VỀ SẢNH — VÀO TRẬN THÔI</Link>
      </div>
    </ScreenFrame>
  );
}
