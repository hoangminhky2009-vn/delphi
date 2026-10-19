/**
 * CỜ "NGƯỜI DÙNG ĐANG THAO TÁC" — để lớp phủ toàn cục biết đường nhường chỗ.
 *
 * ⚠⚠ VÌ SAO CẦN MỘT CỜ TOÀN CỤC, chứ không phải mỗi màn tự ẩn thứ nó vướng: lớp phủ
 * (`OracleChat`) sống ở `AppShell`, còn thứ biết "người dùng đang giữa chừng một thao
 * tác" lại nằm sâu trong màn. Hai bên là ANH EM, không phải cha con — nên không có
 * đường CSS nào nối chúng, và cũng không nên có: màn không được biết tên lớp phủ nào
 * đang tồn tại, bằng không mỗi lớp phủ mới lại phải sửa mọi màn.
 * ⇒ Màn khai "tôi đang bận"; lớp phủ tự quyết phải làm gì với thông tin ấy.
 *
 * ⚠ ĐẾM CHỒNG, không phải cờ bật/tắt. Hai chỗ cùng khai bận rồi một chỗ xong trước:
 * nếu chỉ xoá thuộc tính thì chỗ còn lại **mất cờ trong khi vẫn đang bận**, và lớp phủ
 * hiện lại đúng giữa lúc người ta đang bấm. Đếm thì chỉ hạ khi người cuối cùng xong.
 */
import { useEffect } from 'react';

/** `document.body[data-dang-thao-tac="co"]` — CSS của lớp phủ bám vào đúng chuỗi này. */
export const THUOC_TINH_THAO_TAC = 'dangThaoTac';

let dangGiu = 0;

function capNhat(): void {
  if (typeof document === 'undefined') return;
  if (dangGiu > 0) document.body.dataset[THUOC_TINH_THAO_TAC] = 'co';
  else delete document.body.dataset[THUOC_TINH_THAO_TAC];
}

/** Chỉ cho test: quên mọi lượt giữ đang treo. */
export function quenThaoTac(): void {
  dangGiu = 0;
  capNhat();
}

/**
 * Khai "màn này đang có một thao tác dở dang" trong lúc `bat === true`.
 *
 * ⚠ Nhả cả khi UNMOUNT, không chỉ khi `bat` thành `false`: người dùng đang cầm tiền mà
 * bấm nút back thì component biến mất **giữa lúc cờ đang bật** — thiếu dọn ở đây là cờ
 * kẹt vĩnh viễn và lớp phủ không bao giờ trở lại.
 */
export function useDangThaoTac(bat: boolean): void {
  useEffect(() => {
    if (!bat) return;
    dangGiu += 1;
    capNhat();
    return () => { dangGiu = Math.max(0, dangGiu - 1); capNhat(); };
  }, [bat]);
}
