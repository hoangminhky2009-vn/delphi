/**
 * PFM — DẢI TAB CỦA KHU TÀI CHÍNH.
 *
 * ⚠⚠ ROUTE PHẲNG, TAB TỰ VẼ — không dùng route lồng. Chốt founder 04/09: PFM nằm CHUNG
 * khu `/tai-chinh`, không thêm tab ở BottomNav. Mỗi màn tự đặt dải này ở đầu mình, nên
 * tập `path` của router **bằng đúng** `MAN_HOP_LE` — và đẳng thức ấy có bài canh
 * (`web/tests/telemetry.test.ts`). Route lồng thì hai danh sách lệch nhau và phép so bằng
 * kia biến thành một danh sách ngoại lệ phải bảo trì.
 *
 * ⚠ DANH SÁCH TAB CHỈ CHỨA MÀN ĐÃ CÓ THẬT. Một tab trỏ tới màn chưa dựng là một cú chạm
 * dẫn tới 404 — tệ hơn hẳn việc chưa thấy tab. GƯƠNG đã vào đây 06/09, cùng lượt với màn
 * của nó (`screens/tai-chinh/Guong.tsx`), đúng một dòng.
 */
import { NavLink } from 'react-router-dom';
import { DomBao, useDomHien } from '@/components/DomBao';
import type { MaDom } from '@/lib/dom_bao';
import {
  ROUTE_TAI_CHINH_THE, ROUTE_TAI_CHINH_SO, ROUTE_TAI_CHINH_HU, ROUTE_TAI_CHINH_GUONG,
} from '@/lib/vocab';
import pixel from '@/styles/pixel.module.css';
import s from './TabTaiChinh.module.css';

export interface TabPfm {
  duong: string;
  nhan: string;
  /** Mã đốm mà tab này là đích (vắng = tab không bao giờ có đốm). */
  dom?: MaDom;
  /** `end` cho route gốc: `/tai-chinh` không được sáng khi đang ở `/tai-chinh/so`. */
  cuoi?: boolean;
}

/**
 * ⚠ 07/09 — THẺ TRỎ SANG `/tai-chinh/the`, KHÔNG còn trỏ `/tai-chinh`.
 * `/tai-chinh` nay là bộ điều phối (xem `ROUTE_TAI_CHINH_THE` ở `vocab.ts`): nó
 * KHÔNG vẽ màn nào, nên để tab trỏ vào đó là để một tab dẫn tới một cú nhảy.
 * Thứ tự cũng đổi: SỔ đứng đầu vì đó là màn dùng HÀNG NGÀY (chỉ thị founder).
 */
export const TAB_TAI_CHINH: readonly TabPfm[] = [
  { duong: ROUTE_TAI_CHINH_SO, nhan: 'SỔ' },
  { duong: ROUTE_TAI_CHINH_HU, nhan: 'HŨ' },
  { duong: ROUTE_TAI_CHINH_GUONG, nhan: 'GƯƠNG' },
  /* ⚠ `dom` khai ĐÍCH của một mã đốm. Tạo hũ xong thì lời mời là "vào THẺ xem chân dung". */
  { duong: ROUTE_TAI_CHINH_THE, nhan: 'THẺ', dom: 'hu_dau_tien' as const },
  // 13/09 — tab NĂNG LỰC (D323) gộp vào THẺ: ba dấu kỹ năng in trên mặt lá bài, không tab thứ năm.
];

/*
 * ⚠ DẢI NÀY CHỈ CHỨA MÀN. Bánh răng cài đặt từng nằm ở đây (07/09 bản đầu) và
 * founder bác: cài đặt không phải màn thứ năm, nên nó không được đứng cùng hàng
 * với bốn tab. Nó dọn sang khe `goc` của `ScreenFrame` — xem `NutCaiDatPfm`.
 */
export function TabTaiChinh(): React.ReactElement {
  /* ⚠ Nghe sự kiện, KHÔNG đọc một lần lúc dựng: dải tab đã có sẵn trên màn lúc người dùng
     tạo hũ, nên đọc-một-lần thì chấm chỉ hiện sau khi rời màn rồi quay lại. */
  const domHien = useDomHien();
  return (
    <nav className={s.dai} aria-label="Khu tài chính">
      {TAB_TAI_CHINH.map((t) => (
        <NavLink
          key={t.duong}
          to={t.duong}
          end={t.cuoi}
          className={({ isActive }) =>
            [pixel.nut, s.tab, isActive ? s.dangXem : ''].filter(Boolean).join(' ')}
        >
          {t.nhan}
          {/* Đốm chỉ đậu lên tab mà mã của nó khai là đích — xem `DOM_CUA_TAB`. */}
          <DomBao hien={t.dom !== undefined && domHien.includes(t.dom)} />
        </NavLink>
      ))}
    </nav>
  );
}
