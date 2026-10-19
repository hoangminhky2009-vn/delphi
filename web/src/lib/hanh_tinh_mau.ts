/**
 * MÀU 9 HÀNH TINH của chân dung PFM — MỘT nguồn cho màn chân dung (`screens/tai-chinh/ChanDungPfm.tsx`) và bản xem trước PFM ở Hub
 * (`screens/hub/HubPfmXemTruoc.tsx`, lúc PFM web khoá). Khoá = `${hàng}${cột}` của `oHanhTinh`; tên ở `CHU_HANH_TINH` (`lib/pfm_chu.ts`).
 */
export const HANH_TINH_MAU: Readonly<Record<string, string>> = {
  '00': '#b9a48e', '01': '#3b82f6', '02': '#e0a458',
  '10': '#c1440e', '11': '#d8b878', '12': '#c88b5a',
  '20': '#9aa0a6', '21': '#7fd8d8', '22': '#3b5bdb',
};
