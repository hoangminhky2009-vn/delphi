/**
 * DẢI ĐỐI THỦ — bàn phải có SỰ SỐNG.
 *
 * Founder 20/07: "nếu là người chơi thì t phải thấy thằng kia stand/hit hay
 * fold chứ. Trong khi đó thấy mỗi cái tên và số tiền."
 *
 * Nên mỗi ghế cho thấy: avatar · tên · bậc rank · vốn · MẤY LÁ đang cầm ·
 * vòng vừa rồi CHECK/RAISE/FOLD · có HIT không · lãi lỗ bao nhiêu.
 *
 * RANH GIỚI THÔNG TIN ẨN: hành động cược và SỐ lá là công khai (poker luôn
 * thấy hai thứ đó). Danh mục CỤ THỂ vẫn giấu — đó mới là thứ tạo ra thông tin
 * bất đối xứng của trò chơi.
 *
 * D25/R1 — render VÔ ĐIỀU KIỆN, không thu gọn: server ghi log "đang thấy bậc
 * Vàng"; UI giấu là log thành sai sự thật, mà events append-only nên hỏng
 * vĩnh viễn.
 */
import {
  dinhDangChip, pctBp,
  type DoiThuDTO, type FxGheDTO, type HuongLenhDTO, type KetQuaGheDTO,
} from '@/api/holdem';
import {
  T_CAT_LO_UPPER, T_GIU_VI_THE_UPPER, T_HUONG_LENH_UPPER, T_TANG_CAM_KET_UPPER,
} from '@/lib/vocab';
import { useState } from 'react';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { useMe } from '@/api/queries';
import { GheAvatar } from './BotAvatar';
import { LuaMomentum, type NacLua } from './LuaMomentum';
import s from './DoiThuStrip.module.css';

/** Nhãn vai — NGẮN vì ô ghế hẹp tới 45px ở bàn 8. Id ↔ chữ, không logic.
 *  12/09: export cho màn CHIA VAI (`ChaoVai`) — cùng một chữ ở hai chỗ, một nguồn. */
export const NHAN_VAI: Record<string, string> = {
  ca_nhan: 'CÁ NHÂN', doi_lai: 'ĐỘI LÁI', ca_map: 'CÁ MẬP', to_chuc: 'TỔ CHỨC',
};

/**
 * Trạng thái cảm xúc → tên class. Bảng tra, KHÔNG if-else rải trong JSX: thêm
 * một trạng thái ở server thì chỉ thêm một dòng ở đây.
 */
const FX_LOP: Record<FxGheDTO, string> = {
  binh_thuong: '',
  lai_dam: 'fxLaiDam',
  lo_dam: 'fxLoDam',
  nguy_kich: 'fxNguyKich',
  chay: 'fxChay',
};

/**
 * v32 — tên icon từ server → lưới pixel sẵn có (target · chart · bolt · candle).
 * Không khớp thì KHÔNG vẽ: thà thiếu icon còn hơn một ô trống không ai hiểu.
 */
const laIconKyNgo = (x: string): x is 'target' | 'chart' | 'bolt' | 'candle' =>
  x === 'target' || x === 'chart' || x === 'bolt' || x === 'candle';

const NHAN: Record<string, { chu: string; cls: string }> = {
  giu_vi_the: { chu: T_GIU_VI_THE_UPPER, cls: 'nCheck' },
  tang_cam_ket: { chu: T_TANG_CAM_KET_UPPER, cls: 'nRaise' },
  cat_lo: { chu: T_CAT_LO_UPPER, cls: 'nFold' },
};

/**
 * D302 — nhãn HƯỚNG LỆNH (trận NAV). Từ v10a máy cược tắt nên `hanh_dong` là
 * GIỮ VỊ THẾ cho CẢ BÀN ở MỌI vòng — năm ghế một chữ, tức là không có thông tin;
 * founder 07/09 đọc dải này thành "chẳng thấy đối thủ làm gì". Ưu tiên: cắt lỗ
 * (vẫn là một hành động thật ở NAV — bỏ ô này) → hướng lệnh → nhãn cược cũ
 * (trận không NAV, server không gửi `huong_lenh`). HIT ẩn khi đã có hướng lệnh:
 * "có lệnh" đã nằm trong VÀO/RA/ĐẢO, hai badge là nói một điều hai lần trên ô 45px.
 */
const NHAN_HUONG: Record<HuongLenhDTO, { chu: string; cls: string }> = {
  vao: { chu: T_HUONG_LENH_UPPER.vao, cls: 'nVao' },
  ra: { chu: T_HUONG_LENH_UPPER.ra, cls: 'nRa' },
  dao: { chu: T_HUONG_LENH_UPPER.dao, cls: 'nDao' },
  dung: { chu: T_HUONG_LENH_UPPER.dung, cls: 'nDung' },
};

function nhanCuaGhe(kq: KetQuaGheDTO | undefined): { chu: string; cls: string } | undefined {
  if (!kq) return undefined;
  if (kq.da_cat_lo) return NHAN.cat_lo;
  if (kq.huong_lenh) return NHAN_HUONG[kq.huong_lenh];
  return NHAN[kq.hanh_dong];
}

export function DoiThuStrip({
  doiThu, vongTruoc, ban, tenTaiSan,
}: {
  doiThu: DoiThuDTO[];
  /** Kết quả vòng vừa rồi của từng ghế — giữ hiển thị TỚI vòng sau, không chớp rồi mất. */
  vongTruoc: Map<string, KetQuaGheDTO>;
  /** Ghế của chính người chơi — để cả bàn 5 ghế nằm trong CÙNG một lưới. */
  ban?: {
    von: number; so_the: number; bac_rank: string; con_song: boolean;
    fx: FxGheDTO;
    /** v32 — icon con đường kỳ ngộ của CHÍNH mình (server cấp, cùng luật che). */
    ky_ngo_icon?: string;
    /** VAI bất đối xứng (22/08). Vắng = không có vai (map 8 / trận cũ). */
    vai?: string;
    /** Hạng phong cách CỦA MÌNH — cùng thang với đối thủ, để tấm chi tiết nói cùng một thứ. */
    phong_cach_hang?: string;
    /** Mã mình đang nắm. Của MÌNH thì không cần lõi nào: đây là danh mục của chính mình. */
    tai_san?: readonly string[];
    /** v55 (D409) — nấc lửa đà của mình (0–3), cùng thang với `lua_nac` của đối thủ. */
    lua_nac?: number;
  };
  /** Nhãn mã tài sản (`btc` → `Crypto`) cho tấm chi tiết. Vắng ⇒ hiện đúng id. */
  tenTaiSan?: Readonly<Record<string, string>>;
}) {
  /*
   * DIỆN MẠO CỦA CHÍNH MÌNH — lấy từ `useMe()`, không phải từ payload trận.
   *
   * Nó là một cột trên `users` và `/auth/me` đã trả sẵn, nên đây là 0 request
   * thêm (D11: ngân sách 1M request/tháng). Payload trận chỉ mang diện mạo của
   * NGƯỜI KHÁC — thứ mình không tự biết được.
   *
   * D25/R1: avatar mình cháy/sáng cùng luật với đối thủ, KHÔNG có ngoại lệ — nên
   * ghế mình đi qua đúng một đường render với mọi ghế khác, chỉ khác nguồn chuỗi.
   */
  const me = useMe();
  const dmCuaToi = me.data?.user?.dien_mao ?? null;

  // Ghế mình đứng ĐẦU lưới. Trước đây nó nằm ở một khối khác hẳn phía dưới,
  // nên không bao giờ so trực tiếp được vốn mình với vốn đối thủ — mà đó đúng
  // là việc người chơi làm nhiều nhất ở bàn poker.
  const caBan: DoiThuDTO[] = ban
    ? [{
      ghe_id: 'ban', loai: 'nguoi', ten: 'BẠN', bac_rank: ban.bac_rank,
      von: ban.von, con_song: ban.con_song, so_the: ban.so_the, fx: ban.fx,
      /*
       * ⚠ GHẾ MÌNH KHÔNG ĐI QUA LUẬT CHE. Danh mục của chính mình thì mình biết, nên nó
       * chảy vào ĐÚNG trường mà tấm chi tiết đọc — nếu không, tấm sẽ báo "cần lõi ĐI NGƯỢC"
       * ngay trên ghế của chính người đang chơi (đo thấy trên bàn thật 13/09).
       */
      ...(ban.tai_san && ban.tai_san.length > 0 ? { tai_san_thay: [...ban.tai_san] } : {}),
      ...(ban.phong_cach_hang ? { phong_cach_hang: ban.phong_cach_hang } : {}),
      ...(ban.ky_ngo_icon ? { ky_ngo_icon: ban.ky_ngo_icon } : {}),
      ...(ban.vai ? { vai: ban.vai } : {}),
      ...(ban.lua_nac !== undefined ? { lua_nac: ban.lua_nac } : {}),
    } as DoiThuDTO, ...doiThu]
    : doiThu;

  /*
   * TẤM CHI TIẾT MỘT GHẾ (13/09 tối muộn, kiểu TFT). Bản đầu mở ra một BẢNG CẢ BÀN liệt
   * kê tám dòng — founder bác: *"đừng làm cái hiển thị tên như này, học hỏi TFT ấy, bấm
   * vào ai thì hiện thông tin chi tiết người đó thôi"*. Nên state là MÃ GHẾ, không phải
   * một cờ bật/tắt: chạm ai mở đúng người ấy.
   */
  const [gheMo, setGheMo] = useState<string | null>(null);

  return (
    /*
     * D3 — SỐ CỘT ĐI THEO SỐ GHẾ THẬT (bàn 4–8).
     *
     * Lưới trước đây gõ cứng `repeat(5, 1fr)` trong CSS. Khi D3 mở bàn tới 8 ghế
     * thì 3 ghế cuối tràn xuống hàng hai và dải cao gấp đôi. CSS Modules KHÔNG đổi
     * tên biến CSS (chỉ đổi tên class), nên truyền `--so-ghe` từ đây là cách hợp
     * pháp để TS điều khiển lưới — cùng lối `lib/nhip.ts` đang dùng cho thời lượng.
     *
     * ⚠ MẢNH `<>` MỞ Ở NGAY DƯỚI, KHÔNG Ở TRÊN KHỐI CHÚ THÍCH NÀY. Đứng trên thì
     * đoạn chú thích rơi VÀO TRONG JSX, và trong JSX một `/* *\/` trần là VĂN BẢN —
     * đúng lỗi đã in nguyên một đoạn ghi chú kỹ thuật ra giữa bàn đấu suốt một
     * tháng (xem AlphaDraftMatch, khối "DẢI LƯỢT CƯỢC ĐÃ GỠ").
     */
    <>
    <div
      className={`${s.dai} ${caBan.length >= 7 ? s.daiDong : ''}`}
      style={{ '--so-ghe': caBan.length } as React.CSSProperties}
      // 07/09 — neo cho CoachTap bước `vai` (bàn tập 12 ô): rọi dải này khi kể
      // "bạn là CÁ NHÂN, bàn có CÁ MẬP vốn gấp ba" — đây là nơi vai hiện ra.
      data-tap="doi-thu"
    >
      {caBan.map((d) => {
        const kq = vongTruoc.get(d.ghe_id);
        const nhan = nhanCuaGhe(kq);
        // D312 — ghế mình và ghế đối thủ hiện hai bộ thông tin khác nhau.
        const laBan = d.ghe_id === 'ban';
        /*
         * ⭐ 13/09 tối — GHẾ LÀ MỘT CÁI NÚT, VÀ NÓ CHỈ CÒN BA THỨ.
         * Founder (brief HUD): *"lưới các ô nhỏ với text rí rích… tiếp thu nhanh là bất khả
         * thi"* + *"thông số phụ của từng bot nên được ẩn đi và chỉ gọi ra khi chạm"*. Nên
         * mặt ngoài giữ đúng thứ đọc được trong một nhịp mắt: AVATAR (ai) · HẠNG (chơi ra
         * sao) · VẠCH BÀI (đang cầm mấy lá) — cộng các dấu trạng thái vốn đã là hình chứ
         * không phải chữ. Tên, vai, số lá bằng chữ, vốn của mình: vào TẤM TRƯỢT khi chạm.
         * ⚠ KHÔNG xoá khỏi DOM để "cho gọn": chúng vẫn nằm trong `aria-label` của nút và
         * trong tấm trượt, vì D25/R1 cấm giấu thứ server đã ghi là "đang thấy".
         */
        return (
          <button
            key={d.ghe_id}
            type="button"
            // D401 — chỗ xu của ghế này bay lên GIẢI ở bước chia quỹ (`GiaiVong`).
            data-ghe={d.ghe_id}
            onClick={() => setGheMo(d.ghe_id)}
            aria-label={[d.ten, d.vai ? NHAN_VAI[d.vai] : null, `${d.so_the} lá`,
              laBan ? `vốn ${dinhDangChip(d.von ?? 0)}` : (d.phong_cach_hang ? `hạng ${d.phong_cach_hang}` : null),
            ].filter(Boolean).join(" · ")}
            className={[
              s.o,
              d.ghe_id === 'ban' ? s.toi : '',
              !d.con_song ? s.chet : '',
              kq?.hanh_dong === 'tang_cam_ket' ? s.raise : '',
              kq?.hanh_dong === 'cat_lo' ? s.fold : '',
              // TRẠNG THÁI CẢM XÚC — server suy, client chỉ vẽ (D25: đối thủ
              // thấy mình chính là cái để mất). Lớp này nằm SAU các lớp hành
              // động để quầng sáng/rung của nó thắng khi cả hai cùng có.
              s[FX_LOP[d.fx]] ?? '',
            ].filter(Boolean).join(' ')}
          >
            {nhan && (
              <span
                className={`${s.nhan} ${s[nhan.cls]}`}
                {...(kq?.huong_lenh ? { 'data-huong-lenh': kq.huong_lenh } : {})}
              >
                {nhan.chu}
              </span>
            )}
            {kq?.da_hit && !kq.huong_lenh && <span className={s.nHit}>HIT</span>}
            {/* Cảnh báo chỉ hiện ở mức NGUY KỊCH — hiện ở mọi mức thì thành
                tiếng ồn nền và người chơi ngừng đọc. */}
            {/* Không icon: nhãn này cao 7px, lưới pixel nhỏ nhất đã là 8px nên
                nhét vào là đội cả badge. Mà cảnh báo ở đây không thiếu tín hiệu —
                ghế đang giật theo nhịp tim và viền đỏ gắt (xem `.fxNguyKich`). */}
            {d.fx === 'nguy_kich' && <span className={s.nguyKichCanh}>SẮP CHÁY</span>}
            {d.fx === 'chay' && <span className={s.tro}>TRO</span>}

            {/*
              RẼ THEO `loai`, KHÔNG theo mã ghế — xem docstring `BotAvatar.tsx`.
              Cỡ 32 chứ không 26: 26 không tồn tại về mặt kỹ thuật ở lưới 32 hàng
              (làm tròn ra 32), và 32px vừa lòng ô 37px của bàn 8 ghế với 2,5px dư
              mỗi bên — phép tính nằm ngay trong `DoiThuStrip.module.css`.
            */}
            {/*
              ⚠ AVATAR BỌC TRONG MỘT KHUNG ĐỊNH VỊ để icon con đường đậu lên
              góc — không đổi cỡ 32 của avatar (cỡ lẻ bị lưới pixel làm tròn
              IM LẶNG, xem ghi chú ngay trên).
            */}
            <span className={s.oAvatar}>
              <GheAvatar
                ghe={d.loai === 'nguoi'
                  ? { loai: 'nguoi', dm: d.ghe_id === 'ban' ? dmCuaToi : d.dm ?? null }
                  : { loai: 'may', hat: d.ten }}
                ten={d.ten}
                size={32}
              />
              {/*
                v32 — ICON CON ĐƯỜNG KỲ NGỘ (founder 15/08).
                ⚠ VẮNG MẶT khi chính người xem chưa chốt — SERVER quyết điều đó
                (khuôn A3.1, che ở tầng API). Client TUYỆT ĐỐI không tự suy điều
                kiện lộ: một bản kiểm thứ hai ở đây sẽ trôi, và cú trôi này lộ
                lựa chọn của người khác TRƯỚC khi mình chọn — đúng thứ luật che
                sinh ra để chặn.
              */}
              {d.ky_ngo_icon && laIconKyNgo(d.ky_ngo_icon) && (
                <span className={s.iconDuong} title="con đường kỳ ngộ">
                  <PixelIcon name={d.ky_ngo_icon} size={8} />
                </span>
              )}
              {/* v55 (D409) — NGỌN LỬA ĐÀ của ghế (công khai như hạng): chỉ vẽ khi còn lửa — tàn thì không có gì để khoe. */}
              {d.lua_nac !== undefined && d.lua_nac > 0 && (
                <span className={s.lua} title={`lửa đà nấc ${d.lua_nac}`} data-lua-nac={d.lua_nac}>
                  <LuaMomentum nac={Math.min(3, d.lua_nac) as NacLua} co={16} />
                </span>
              )}
            </span>
            <div>
              {/* TÊN + VAI rời mặt ghế, sang tấm trượt (13/09): tám cái tên hai dòng 9,5px là
                  đúng thứ founder gọi là "text rí rích". Avatar đã phân biệt được ghế. */}
              {/*
                ⭐⭐ D312 — GHẾ MÌNH VÀ GHẾ ĐỐI THỦ NÓI HAI THỨ KHÁC NHAU.
                Founder 08/09: *"ẩn số tiền chi tiết mà đối thủ đang cầm đi"*, và
                chốt ghế đối thủ chỉ hiện HẠNG PHONG CÁCH · số thẻ · icon con
                đường. Số tiền của CHÍNH mình thì giữ nguyên.
                ⚠ Đây không phải "ẩn ở UI": server đã thôi gửi `von` cho ghế đối
                thủ (`bangDoiThu`), nên nhánh dưới không có gì để lộ kể cả khi ai
                đó sửa nhầm điều kiện.
              */}
              {laBan ? (
                <>
                  <div className={s.bac}>{d.bac_rank}</div>
                  {/* Xu 8px (không phải `wallet` 16px): ô ghế hẹp tới 45px ở bàn 8
                      người và dòng vốn chỉ 10px — lưới 16 hàng sẽ đội hàng lên. */}
                  <div className={s.von}>
                    <PixelIcon name="coin" size={8} />
                    {dinhDangChip(d.von ?? 0)}
                  </div>
                </>
              ) : (
                /*
                  HẠNG PHONG CÁCH — "hiển thị rõ" theo đúng chữ founder, nên nó
                  đứng ở CHỖ CŨ CỦA SỐ TIỀN và to hơn dòng bậc.
                  ⚠ Chưa chốt vòng nào ⇒ '—', KHÔNG phải 'E-': hạng thấp nhất là
                  một lời phán về cách chơi, còn '—' là "chưa đủ để nói".
                */
                <div
                  className={`${s.hang} ${d.phong_cach_hang ? s.hangCo : ''}`}
                  title="phong cách chơi của ghế này"
                >
                  {d.phong_cach_hang ?? '—'}
                </div>
              )}

              <div className={s.dongThe}>
                {Array.from({ length: Math.min(6, d.so_the) }, (_, i) => (
                  <span key={i} className={s.laBai} />
                ))}
              </div>

              {/* % lãi/lỗ từng vòng: CHỈ ghế mình (D312 — đối thủ chỉ ba thứ). */}
              {laBan && kq && !kq.da_cat_lo && (
                <div className={`${s.pnl} ${kq.pnl_bp >= 0 ? s.lai : s.lo}`}>
                  {pctBp(kq.pnl_bp)}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
    {/*
      ⭐ TẤM CHI TIẾT MỘT GHẾ — kiểu TFT: chạm ai mở đúng người ấy.

      LUẬT LỘ, và ba mức của nó:
        · SỐ TIỀN: ẩn tuyệt đối. Không có mức nào mở được — server thôi gửi từ D312, nên
          ở đây không có gì để vẽ kể cả khi ai đó sửa nhầm điều kiện.
        · TÀI SẢN ĐANG NẮM: ẩn mặc định; ai cầm lõi ĐI NGƯỢC thì thấy DANH SÁCH MÃ (không
          thấy số lượng) của một phần bàn — đặc quyền có từ 28/07 (`tai_san_thay` ở
          `bangDoiThu`) mà tới hôm nay MÀN HÌNH MỚI VẼ RA. Trước đó nó chỉ nằm trong
          payload, tức người chơi mua lá mà không thấy mình mua được gì.
        · VAI: đang lộ cả bàn vì chính màn CHIA VAI lật ngửa vai từng ghế lúc vào trận
          (D107). Muốn ẩn nó sau một lõi thì phải sửa cả màn ấy + hai bước bàn tập —
          chờ founder chốt, không tự đổi (A8.1).

      ⚠ Client KHÔNG tự suy điều kiện lộ: nó chỉ vẽ thứ server đã gửi. Một bản kiểm thứ
      hai ở đây sẽ trôi, và cú trôi ấy lộ thông tin của người khác (A3.1 · C4).
    */}
    {(() => {
      const d = caBan.find((x) => x.ghe_id === gheMo);
      if (!d) return null;
      const laBanGhe = d.ghe_id === 'ban';
      const ma = d.tai_san_thay ?? [];
      return (
        <>
          <button
            type="button"
            className={s.bangNen}
            aria-label="Đóng chi tiết ghế"
            onClick={() => setGheMo(null)}
          />
          <div className={s.bang} role="dialog" aria-label={`Chi tiết ${d.ten}`}>
            <div className={s.bangDau}>
              <GheAvatar
                ghe={d.loai === 'nguoi'
                  ? { loai: 'nguoi', dm: laBanGhe ? dmCuaToi : d.dm ?? null }
                  : { loai: 'may', hat: d.ten }}
                ten={d.ten}
                size={32}
              />
              <b className={laBanGhe ? s.bangToi : undefined}>{d.ten}</b>
              {d.vai && NHAN_VAI[d.vai] && <span className={s.bangVai}>{NHAN_VAI[d.vai]}</span>}
              <button type="button" className={s.bangDong} onClick={() => setGheMo(null)}>
                ✕ ĐÓNG
              </button>
            </div>
            <div className={s.bangHang}>
              <span>HẠNG PHONG CÁCH</span>
              <span className={s.bangSo}>{d.phong_cach_hang ?? (laBanGhe ? '—' : '—')}</span>
            </div>
            <div className={s.bangHang}>
              <span>ĐANG CẦM</span>
              <span className={s.bangSo}>{d.so_the} lá</span>
            </div>
            <div className={s.bangHang}>
              <span>TÀI SẢN ĐANG NẮM</span>
              <span className={s.bangSo}>
                {ma.length > 0
                  ? ma.map((x) => tenTaiSan?.[x] ?? x).join(' · ')
                  : (laBanGhe
                    ? <span className={s.bangKhoa}>chưa nắm mã nào</span>
                    : <span className={s.bangKhoa}>🔒 cần lõi ĐI NGƯỢC</span>)}
              </span>
            </div>
            {ma.length > 0 && !laBanGhe && (
              <div className={s.bangGhiChu}>
                Đi Ngược cho thấy CẦM GÌ, không cho thấy cầm BAO NHIÊU.
              </div>
            )}
            <div className={s.bangHang}>
              <span>SỐ TIỀN</span>
              <span className={s.bangSo}>
                {laBanGhe
                  ? dinhDangChip(d.von ?? 0)
                  : <span className={s.bangKhoa}>🔒 ẩn cả trận</span>}
              </span>
            </div>
            {!d.con_song && <div className={s.bangGhiChu}>Ghế này đã cháy.</div>}
          </div>
        </>
      );
    })()}
    </>
  );
}
