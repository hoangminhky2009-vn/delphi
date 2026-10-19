/**
 * BÁNH RĂNG CÀI ĐẶT CỦA KHU PFM — góc phải khung màn.
 *
 * Chỉ thị founder 07/09, lượt hai: bản đầu tôi nhét nó thành một Ô trong dải tab
 * SỔ·HŨ·GƯƠNG·THẺ. Sai hai điều cùng lúc — founder khoanh đỏ đúng chỗ:
 *   · nó ĐỨNG NHẦM HÀNG. Dải tab là bốn màn ngang hàng nhau; cài đặt không phải
 *     màn thứ năm, nên để chung hàng là nói dối về cấu trúc;
 *   · nó MẶC ÁO NÚT (`pixel.nut` — viền, nền, vát). *"Ko cần button đâu, biểu
 *     tượng cái bánh răng thôi"*.
 *
 * Nên ở đây: biểu tượng TRẦN, đặt qua khe `goc` của `ScreenFrame` (góc phải, ngang
 * dòng breadcrumb). Vẫn là `<button>` — nó mở hộp thoại, và một `<span>` bấm được
 * thì bàn phím lẫn trình đọc màn hình đều không thấy.
 *
 * ⚠ TỰ GIỮ TRẠNG THÁI. Bốn màn PFM đều gắn nó, và nếu state nằm ở màn thì bốn màn
 * có bốn bản cùng một cú mở/đóng (A11.5). Màn chỉ việc `goc={<NutCaiDatPfm />}`.
 */
import { useState } from 'react';
import { BoardCaiDatPfm } from './BoardCaiDatPfm';
import s from './NutCaiDatPfm.module.css';

export function NutCaiDatPfm(): React.ReactElement {
  const [mo, setMo] = useState(false);
  return (
    <>
      <button
        type="button"
        className={s.banhRang}
        onClick={() => setMo(true)}
        aria-label="Cài đặt khu Tài chính"
        aria-haspopup="dialog"
      >
        ⚙
      </button>
      {mo && <BoardCaiDatPfm onDong={() => setMo(false)} />}
    </>
  );
}
