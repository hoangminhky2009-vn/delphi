/**
 * LÕI ĐÒN BẨY GÃY ĐÔI — hình của khoảnh khắc GỌI KÝ QUỸ (founder 24/08:
 * *"thêm lớp phủ đỏ nháy 1 phát và rung nhẹ màn hình khi bị margin call, hiển
 * thị lõi đòn bẩy bị gãy đôi"*, rồi chỉnh: *"chỉ rung ở khoảnh khắc lõi gãy
 * đôi thôi"*).
 *
 * ─── VÌ SAO LÀ HÌNH CHỨ KHÔNG PHẢI CHỮ ──────────────────────────────────────
 * `ChuPixel` chỉ có 22 glyph — `E D C B A S`, `0-9`, và `. , × + − %`. Không
 * chữ cái nào khác, không dấu tiếng Việt. Viết "MARGIN CALL" bằng nó ra `ACA`,
 * viết "GỌI KÝ QUỸ" ra RỖNG — và ký tự thiếu glyph bị lọc IM LẶNG
 * (`ChuPixel.tsx` `[...chuoi].filter(coGlyph)`), đúng bẫy D119 nhưng nặng hơn
 * (D119 mất một dấu trừ; đây mất cả dòng chữ).
 * ⇒ Nghĩa đi bằng HÌNH: chính lá Đòn Bẩy người chơi đang cầm, gãy làm đôi. Số
 * chip bị lấy thì viết được trọn vẹn bằng glyph có sẵn (`−` + chữ số + `.`).
 *
 * ─── HAI NỬA LÀ HAI BẢN CẮT CỦA CÙNG MỘT BỨC ────────────────────────────────
 * Không có art "lá gãy" và không vẽ thêm (đó là nợ art thật, phải xin founder).
 * Thay vào đó render CÙNG một SVG hai lần, mỗi bản `clip-path: inset()` một
 * nửa, rồi tách hai nửa ra bằng `transform`. `clip-path` là nếp sẵn của repo
 * (khung pixel cắt khấc bốn góc, thanh phong cách cắt mực ở D124), và nó CẮT
 * chứ không kéo giãn — nửa lá vẫn đúng tỷ lệ gốc.
 *
 * ⚠ Chỉ `transform` và `opacity` được động — tập giao ba runtime (web · Discord
 * Activity · RN/Flutter). `clip-path` ở đây là giá trị TĨNH đặt một lần, không
 * animate, nên không phạm luật đó.
 */
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '@/lib/hooks';
import { ChuPixel } from './ChuPixel';
import { PixelIcon } from '@/components/ui/PixelIcon';
import { dinhDangChip } from '@/api/holdem';
import s from './LoiGay.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * Nhịp gãy — lá đứng nguyên một lúc RỒI mới gãy.
 *
 * ⚠ Khoảng chờ này là toàn bộ ý nghĩa của hoạt ảnh, không phải thời gian chết:
 * gãy ngay ở khung hình đầu thì người chơi chưa kịp nhận ra đó là lá của mình,
 * và cú gãy thành một vệt loé vô nghĩa. Gacha cố ý làm chậm cú lộ vì đúng lý do
 * này (D113 luật 3: độ trễ mới làm nên hoành tráng, không phải hạt bay).
 */
export const NHIP_GAY_MS = 420;

export function LoiGay({ svg, mat }: {
  /** Art lá `don_bay` từ catalog — vắng thì rơi về icon, không vẽ ô trống. */
  svg?: string;
  /** Số chip bị lấy khỏi NAV. */
  mat: number;
}) {
  const itMotion = useReducedMotion();
  const [daGay, setDaGay] = useState(itMotion);
  const hen = useRef<number | null>(null);

  useEffect(() => {
    /*
     * ⚠ Tiết kiệm chuyển động: hiện NGAY trạng thái ĐÃ GÃY, giữ nguyên thời
     * gian đọc. Thứ bị tắt là cái ĐỘNG, không phải cái TIN — kẹp thời lượng về
     * gần 0 là lỗi D116 đã vá cho chính lớp phủ này.
     */
    if (itMotion) return undefined;
    hen.current = window.setTimeout(() => setDaGay(true), NHIP_GAY_MS);
    return () => { if (hen.current !== null) window.clearTimeout(hen.current); };
  }, [itMotion]);

  const nua = (ben: 'trai' | 'phai') => (
    <span
      className={`${s.nua} ${ben === 'trai' ? s.trai : s.phai} ${daGay ? s.gay : ''}`}
      aria-hidden
    >
      {svg
        ? <span className={s.art} dangerouslySetInnerHTML={htmlTinh(svg)} />
        : <PixelIcon name="bolt" size={64} />}
    </span>
  );

  return (
    <div className={s.khoi}>
      <div className={`${s.la} ${daGay ? s.laGay : ''}`}>
        {nua('trai')}
        {nua('phai')}
        {/* Vết nứt: chỉ hiện SAU cú gãy — trước đó lá còn lành. */}
        <span className={`${s.nut} ${daGay ? s.nutHien : ''}`} aria-hidden />
      </div>
      {/*
        Số chip mất — viết được TRỌN VẸN bằng glyph pixel sẵn có.
        ⚠ Dấu phải là `-` (U+002D), KHÔNG phải `−` (U+2212): lưới khai U+002D và
        ký tự lạ bị lọc im lặng ⇒ số âm mất dấu, trông y hệt số dương (bug D119).
      */}
      <div className={`${s.so} ${daGay ? s.soHien : ''}`}>
        <ChuPixel chuoi={`-${dinhDangChip(mat)}`} px={4} />
      </div>
    </div>
  );
}
