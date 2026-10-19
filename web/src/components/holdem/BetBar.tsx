/**
 * TỐ BÀI (POSITION SIZING) — preset + thanh kéo.
 *
 * Kéo hết = ALL IN → thanh RỰC CHÁY, tàn lửa bay lên liên tục. Đây là nút duy
 * nhất được phép ồn TRƯỚC khi biết kết quả, vì nó là cam kết không rút lại được.
 *
 * Tàn lửa dựng bằng state chứ không phải DOM tay: React sở hữu cây DOM này,
 * chèn node thủ công vào là sẽ bị ghi đè ở lần render sau.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { dinhDangChip } from '@/api/holdem';
import { T_DON_HET_UPPER } from '@/lib/vocab';
import { PixelIcon } from '@/components/ui/PixelIcon';
import s from './BetBar.module.css';

/**
 * ALL IN KHÔNG PHẢI "100%".
 *
 * ⚠ Founder báo lỗi này ba lượt liền: bấm ALL IN mà thanh ra 60%, 63%. Tôi
 * không tái hiện được con số đó từ code — và chính chỗ đó là dấu hiệu: khi một
 * hành động phải đi vòng qua phần trăm rồi mới quay lại thành tiền, có ít nhất
 * bốn con số phải khớp nhau (phần trăm hiển thị · vị trí thanh kéo · số tiền
 * tính ra · trần server chấm). Lệch một chỗ là sai, mà chỗ nào lệch thì rất
 * khó chỉ mặt.
 *
 * Nên ALL IN nay là MỘT CHẾ ĐỘ RIÊNG (`ALL_IN`), không phải một mức phần trăm:
 * nó gửi thẳng đúng số còn đặt được. Không còn phần trăm nào để mà lệch.
 */
export const ALL_IN = -1;

const PRESET = [
  { nhan: 'MIN', v: 0 },
  { nhan: '25%', v: 25 },
  { nhan: '50%', v: 50 },
  { nhan: T_DON_HET_UPPER, v: ALL_IN },
] as const;

interface Tan { id: number; left: number; dx: number }

export function BetBar({
  phanTram, von, camKetNen, vohieu, onDoi, toiDa, conThieu = 0,
  allInMo = true, conThieuThe = 0,
}: {
  phanTram: number;
  von: number;
  camKetNen: number;
  vohieu?: boolean;
  onDoi: (v: number) => void;
  /**
   * Trần thật sự đặt thêm được lúc này (server chấm). Bỏ trống thì lấy `von`.
   *
   * ⚠ Đây là chỗ sinh ra "ALL IN mà tính thành 60%" founder gặp. Thanh này vốn
   * tính % trên TỔNG vốn, trong khi phần còn đặt được đã bị trừ tiền cửa và
   * phần đã theo trong vòng. Kéo 100% ra một con số, server nhận về một con số
   * khác — nên phần trăm hiển thị thành lời nói dối ngay khi vòng cược đã chạy
   * được vài nước.
   */
  toiDa?: number;
  /** Đang nợ bao nhiêu để theo cho kịp giá. */
  conThieu?: number;
  /**
   * D34 — ALL-IN ĐÃ MỞ CHƯA. Mặc định `true` để mọi chỗ dùng cũ không đổi hành vi.
   *
   * ⚠ SERVER SUY (`ban.all_in_mo`), client chỉ vẽ. Engine đã kẹp trần tố khi
   * chưa mở (xem `choiVongCuoc`), nên UI mà tự suy sai thì hoặc là hiện một nút
   * bấm vào không có tác dụng, hoặc là giấu mất một nước đi hợp lệ.
   */
  allInMo?: boolean;
  /** Còn thiếu mấy thẻ chiến thuật nữa — để nút nói RÕ vì sao đang khoá. */
  conThieuThe?: number;
}) {
  const itMotion = useReducedMotion();
  /**
   * ⚠ KÉO HẾT THANH CŨNG LÀ ALL IN.
   *
   * Founder bắt được 20/07: bấm nút ALL IN thì thanh cháy, nhưng KÉO hết thanh
   * — bản chất y hệt — thì không có hiệu ứng gì. Đó là hậu quả của việc tôi
   * tách ALL IN thành chế độ riêng: hai đường dẫn tới cùng một hành động mà
   * chỉ một đường được công nhận.
   *
   * Nay 100% và ALL_IN là MỘT. Ai kéo tới đáy xứng đáng thấy lửa y như người
   * bấm nút — họ vừa làm đúng một việc như nhau.
   */
  const laAllIn = phanTram === ALL_IN || phanTram >= 100;
  const dangChay = laAllIn;
  const [tan, setTan] = useState<Tan[]>([]);
  const dem = useRef(0);

  useEffect(() => {
    if (!dangChay || itMotion) { setTan([]); return undefined; }
    const t = setInterval(() => {
      dem.current += 1;
      const moi: Tan = {
        id: dem.current,
        left: 12 + Math.random() * 76,
        dx: Math.random() * 24 - 12,
      };
      setTan((cu) => [...cu.slice(-14), moi]);
      setTimeout(() => setTan((cu) => cu.filter((x) => x.id !== moi.id)), 1100);
    }, 90);
    return () => clearInterval(t);
  }, [dangChay, itMotion]);

  // Mốc trên = số CÒN ĐẶT THÊM ĐƯỢC, không phải tổng vốn.
  const tran = Math.max(0, toiDa ?? von);
  const soTien = laAllIn
    ? tran
    : (phanTram === 0
      ? Math.max(camKetNen, conThieu)
      : Math.max(camKetNen, conThieu, Math.floor((tran * phanTram) / 100)));

  // Bọc CHUNG một lớp `chay`: CSS dùng `.chay .thanh` / `.chay .phanTram`,
  // nên thanh kéo phải nằm TRONG phần tử mang lớp đó, không phải anh em.
  return (
    <div className={dangChay ? s.chay : undefined}>
      <div className={s.bet}>
        {PRESET.map((p) => {
          /*
           * D34 — nút DỒN HẾT khoá cho tới khi chốt đủ 3 thẻ chiến thuật.
           *
           * Vô hiệu CHỨ KHÔNG ẨN: ẩn thì người chơi không biết nước đi đó tồn
           * tại và mở ở đâu, còn nhãn "còn N thẻ" dạy đúng luật ngay tại chỗ
           * họ đang định bấm.
           */
          const khoaAllIn = p.v === ALL_IN && !allInMo;
          return (
            <button
              key={p.v}
              type="button"
              disabled={vohieu || khoaAllIn}
              title={khoaAllIn
                ? `Mở sau khi chọn xong 3 thẻ chiến thuật (còn ${conThieuThe})`
                : undefined}
              onClick={() => onDoi(p.v)}
              className={`${s.nut} ${phanTram === p.v ? s.nutOn : ''}`}
            >
              {khoaAllIn ? `${p.nhan} · CÒN ${conThieuThe} THẺ` : p.nhan}
            </button>
          );
        })}
        {/*
          * Dạng CHỮ và dạng SỐ dùng chung một khung cố định (xem CSS `.phanTram`),
          * chỉ khác cỡ chữ. Trước đây ô co theo nội dung nên nhãn dài đẩy cả hàng
          * và nằm dạt trái — founder báo 26/07.
          */}
        <span
          className={[
            s.phanTram,
            laAllIn ? s.phanTramChu : '',
            dangChay ? s.phanTramChay : '',
          ].filter(Boolean).join(' ')}
        >
          {laAllIn ? T_DON_HET_UPPER : `${phanTram}%`}
        </span>
        <span className={s.grow} />
        <div className={s.hop}>
          <div className={s.hopNhan}>MỨC CAM KẾT</div>
          {/* Lưới 16px (`wallet`) chứ không phải `coin` 8px: đây là khối chữ lớn
              19px, xu 8px đứng cạnh sẽ tụt hẳn xuống dưới cap-height. */}
          <div className={s.hopSo}>
            <PixelIcon name="wallet" size={16} />
            {dinhDangChip(soTien)}
          </div>
        </div>

        {tan.map((t) => (
          <span
            key={t.id}
            className={s.tan}
            style={{ left: `${t.left}%`, ['--dx' as string]: `${t.dx}px` }}
          />
        ))}
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={laAllIn ? 100 : phanTram}
        disabled={vohieu}
        aria-label="Tỷ lệ vốn đưa vào vòng này"
        onChange={(e) => {
          // Kéo chạm đáy thì CHUYỂN HẲN sang chế độ ALL_IN, không giữ số 100.
          // Một hành động một cách biểu diễn — nếu không thì "100%" và ALL_IN
          // là hai trạng thái phải nhớ đồng bộ với nhau ở mọi nơi dùng.
          // Chưa mở All-in thì kéo chạm đáy KHÔNG chuyển sang chế độ dồn hết —
          // nếu không thì thanh kéo là cửa sau đi vòng qua nút vừa khoá.
          const v = Number(e.target.value);
          onDoi(v >= 100 && allInMo ? ALL_IN : Math.min(v, allInMo ? 100 : 99));
        }}
        className={`${s.thanh} ${dangChay ? s.thanhChay : ''}`}
        style={{ ['--p' as string]: `${laAllIn ? 100 : phanTram}%` }}
      />
    </div>
  );
}
