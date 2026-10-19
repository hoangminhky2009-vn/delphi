/**
 * THƯ VIỆN HÌNH CHUNG của dòng giá minigame (D465) — CHÉP NGUYÊN số từ demo đã chốt `docs/ui-ux/demo/minigame-bat-day.html` (khối `HINH`,
 * thứ tự giữ nguyên vì bốc ngẫu nhiên đi theo thứ tự). Bỏ phần CHỮ (tên hình, câu tin gắn hình) — chữ ở client (D26).
 * `song`: [số nến gốc, đích (đơn vị hình quanh 100), kiểu: deu · tang_toc · giam_toc · gap, cờ: lang · cao_trao].
 * `tests/minigame_dong_gia.test.ts` bắt bản server ra đúng từng số của demo — sửa hình ở DEMO trước (A11.25).
 */
export type KieuDoan = 'deu' | 'tang_toc' | 'giam_toc' | 'gap';
export interface HinhMinigame {
  id: string; o: readonly string[]; dau: number;
  song: readonly (readonly [number, number, KieuDoan, ('lang' | 'cao_trao')?])[];
  w?: number; wCrypto?: number; mot_chieu?: boolean;
}
export const HINH_CHUNG: readonly HinhMinigame[] = [
  {id: 'roi_mot_chieu', o: ['giam'], dau: 110, song: [[6, 94, 'deu'], [2, 95.5, 'deu'], [6, 88, 'deu'], [2, 89.2, 'deu'], [7, 80, 'tang_toc'], [7, 74, 'deu']], w: 0.6, mot_chieu: true},
  {id: 'meo_chet_nay', o: ['giam'], dau: 104, song: [[6, 82, 'tang_toc', 'cao_trao'], [6, 90, 'giam_toc'], [1, 90.5, 'deu'], [8, 78, 'deu'], [9, 72, 'deu']], w: 0.6, mot_chieu: true},
  {id: 'sap_gap', o: ['giam'], dau: 101, song: [[5, 101, 'deu', 'lang'], [1, 85, 'gap', 'cao_trao'], [6, 82, 'deu'], [4, 86, 'deu'], [14, 79, 'deu']], w: 0.6, mot_chieu: true},
  {id: 'bay_hoi_gay_nen', o: ['giam'], dau: 108, song: [[5, 93, 'deu'], [4, 99, 'tang_toc'], [3, 88, 'deu'], [1, 84, 'gap', 'cao_trao'], [5, 82, 'deu', 'lang'], [12, 89, 'deu']], w: 1.4},
  {id: 'ru_chu_v', o: ['tang'], dau: 103, song: [[5, 94, 'deu'], [5, 78, 'tang_toc', 'cao_trao'], [1, 77, 'deu'], [7, 94, 'giam_toc'], [12, 104, 'deu']]},
  {id: 'day_kep', o: ['tang', 'ngang'], dau: 106, song: [[6, 88, 'deu'], [5, 95, 'giam_toc'], [5, 89, 'deu', 'lang'], [4, 90, 'deu', 'lang'], [10, 101, 'deu']]},
  {id: 'bat_tran_v', o: ['tang'], dau: 104, song: [[5, 92, 'tang_toc', 'cao_trao'], [2, 89, 'deu'], [1, 96, 'gap', 'cao_trao'], [1, 103, 'gap', 'cao_trao'], [6, 106, 'deu'], [15, 110, 'deu']], wCrypto: 2},
  {id: 'ru_roi_tang', o: ['tang'], dau: 98, song: [[4, 92, 'tang_toc', 'cao_trao'], [3, 90, 'deu', 'lang'], [8, 100, 'deu'], [2, 98.5, 'deu'], [13, 110, 'deu']]},
  {id: 'pha_nen_gia', o: ['ngang'], dau: 100, song: [[6, 99, 'deu', 'lang'], [3, 93, 'tang_toc', 'cao_trao'], [3, 100, 'giam_toc'], [6, 103, 'deu'], [6, 98, 'deu'], [6, 100.5, 'deu']]},
  {id: 'parabol_sap', o: ['giam', 'tang'], dau: 95, song: [[8, 108, 'deu'], [8, 128, 'tang_toc'], [2, 134, 'tang_toc', 'cao_trao'], [4, 112, 'deu'], [8, 96, 'deu']], mot_chieu: true},
  {id: 'bom_xa', o: ['giam'], dau: 100, song: [[4, 100.5, 'deu', 'lang'], [5, 138, 'tang_toc', 'cao_trao'], [1, 140, 'deu'], [1, 112, 'gap', 'cao_trao'], [19, 98, 'deu']], mot_chieu: true},
  {id: 'bay_vuot_dinh', o: ['ngang', 'tang'], dau: 100, song: [[8, 101, 'deu', 'lang'], [3, 109, 'tang_toc', 'cao_trao'], [2, 110, 'deu'], [4, 99, 'deu'], [13, 95, 'deu']], mot_chieu: true},
  {id: 'bo_len_ben', o: ['tang'], dau: 96, song: [[6, 105, 'deu'], [2, 103.5, 'deu'], [6, 110, 'deu'], [2, 108.5, 'deu'], [7, 116, 'deu'], [2, 114.5, 'deu'], [5, 121, 'deu']]},
  {id: 'hai_nhip', o: ['tang'], dau: 95, song: [[8, 112, 'deu'], [6, 104, 'deu'], [1, 104, 'deu', 'lang'], [10, 122, 'tang_toc'], [5, 119, 'deu']]},
  {id: 'dinh_tham', o: ['tang'], dau: 95, song: [[8, 106, 'deu'], [7, 124, 'tang_toc', 'cao_trao'], [1, 126, 'deu'], [5, 113, 'deu'], [9, 116, 'deu']], w: 0.8},
  {id: 'rung_nhe_roi_bung', o: ['tang'], dau: 95, song: [[6, 104, 'deu'], [3, 100, 'deu', 'lang'], [1, 99.5, 'deu', 'lang'], [3, 107, 'tang_toc', 'cao_trao'], [1, 114, 'gap', 'cao_trao'], [1, 121, 'gap', 'cao_trao'], [6, 126, 'deu'], [9, 130, 'deu']], w: 0.6, wCrypto: 1.2},
  {id: 'tran_lien_tiep', o: ['tang'], dau: 98, song: [[5, 103, 'deu'], [1, 110, 'gap', 'cao_trao'], [1, 117, 'gap', 'cao_trao'], [1, 124, 'gap', 'cao_trao'], [4, 120, 'deu'], [2, 118, 'deu', 'lang'], [8, 128, 'deu'], [8, 131, 'deu']], w: 0.6, wCrypto: 1.2},
  {id: 'tich_luy_but_pha', o: ['tang', 'ngang'], dau: 100, song: [[8, 101, 'deu', 'lang'], [3, 98.5, 'deu', 'lang'], [2, 103, 'tang_toc'], [1, 110, 'gap', 'cao_trao'], [6, 114, 'deu'], [10, 118, 'deu']], w: 0.6, wCrypto: 1.2},
  {id: 'hoi_ky_thuat', o: ['giam'], dau: 108, song: [[3, 98, 'deu'], [7, 108, 'giam_toc'], [1, 108.5, 'deu', 'cao_trao'], [6, 96, 'deu'], [13, 88, 'deu']], mot_chieu: true},
  {id: 'song_ngang', o: ['ngang'], dau: 100, song: [[5, 100, 'deu', 'lang'], [3, 107, 'tang_toc', 'cao_trao'], [4, 100, 'deu'], [5, 99, 'deu', 'lang'], [3, 106, 'tang_toc', 'cao_trao'], [10, 99, 'deu']]},
  {id: 'song_len', o: ['tang'], dau: 97, song: [[4, 105, 'deu'], [2, 102, 'deu'], [5, 110, 'deu'], [2, 106.5, 'deu'], [5, 114, 'deu'], [3, 109.5, 'deu'], [5, 118, 'deu'], [4, 115, 'deu']]},
  {id: 'song_xuong', o: ['giam'], dau: 103, song: [[4, 95, 'deu'], [2, 98.5, 'deu'], [5, 90, 'deu'], [2, 93.5, 'deu'], [5, 86, 'deu'], [3, 90.5, 'deu'], [5, 82, 'deu'], [4, 85, 'deu']]},
  {id: 'song_hai_chieu', o: ['ngang', 'bien_dong'], dau: 100, song: [[4, 104, 'deu'], [3, 97.5, 'deu'], [4, 104.5, 'deu'], [3, 97, 'deu'], [4, 103.5, 'deu'], [3, 98.5, 'deu'], [5, 105.5, 'deu'], [4, 100.5, 'deu']]},
  {id: 'giat_hai_dau', o: ['giam', 'tang', 'ngang', 'bien_dong'], dau: 100, song: [[2, 106, 'tang_toc'], [2, 99, 'deu'], [2, 105, 'deu'], [2, 96, 'deu'], [3, 104, 'deu'], [3, 95, 'deu'], [4, 103, 'deu'], [4, 97, 'deu'], [4, 104, 'deu'], [4, 100, 'deu']]},
  {id: 'song_du', o: ['bien_dong'], dau: 100, song: [[3, 109, 'tang_toc', 'cao_trao'], [3, 97, 'tang_toc', 'cao_trao'], [4, 110, 'deu'], [3, 95, 'tang_toc', 'cao_trao'], [4, 107, 'deu'], [3, 94, 'tang_toc', 'cao_trao'], [4, 105, 'deu'], [3, 97, 'deu'], [3, 101, 'deu']]},
  {id: 'quay_dau_lien', o: ['bien_dong'], dau: 100, song: [[2, 106, 'tang_toc'], [2, 98, 'tang_toc'], [3, 108, 'deu', 'cao_trao'], [2, 99, 'deu'], [3, 93, 'tang_toc', 'cao_trao'], [3, 103, 'deu'], [2, 96, 'deu'], [3, 107, 'tang_toc', 'cao_trao'], [3, 99, 'deu'], [3, 104, 'deu'], [4, 100, 'deu']]},
  {id: 'bien_rong', o: ['bien_dong'], dau: 100, song: [[5, 111, 'deu'], [1, 104, 'gap', 'cao_trao'], [4, 92, 'tang_toc', 'cao_trao'], [1, 99, 'gap', 'cao_trao'], [4, 110, 'deu'], [5, 94, 'tang_toc'], [5, 106, 'deu'], [5, 100, 'deu']]},
  {id: 'no_hai_chieu', o: ['bien_dong'], dau: 100, song: [[4, 101, 'deu', 'lang'], [2, 113, 'tang_toc', 'cao_trao'], [2, 98, 'tang_toc', 'cao_trao'], [3, 90, 'tang_toc', 'cao_trao'], [4, 104, 'giam_toc'], [3, 96, 'deu'], [4, 107, 'deu'], [4, 99, 'deu'], [4, 103, 'deu']]},
  {id: 'rung_cay', o: ['tang'], dau: 97, song: [[5, 104, 'deu'], [4, 94, 'tang_toc', 'cao_trao'], [3, 96, 'deu'], [8, 106, 'deu'], [10, 112, 'deu']]},
  {id: 'leo_doc', o: ['tang'], dau: 96, song: [[8, 105, 'deu'], [4, 99.5, 'deu'], [10, 112, 'deu'], [3, 107, 'deu'], [5, 115, 'deu']]},
  {id: 'truot_doc', o: ['giam'], dau: 104, song: [[6, 103, 'deu'], [6, 96, 'deu'], [4, 98, 'deu'], [7, 90, 'tang_toc'], [7, 86, 'deu']], mot_chieu: true},
  {id: 'xuong_roi_hoi', o: ['giam'], dau: 100, song: [[6, 94, 'deu'], [3, 91.5, 'deu', 'cao_trao'], [6, 99, 'deu'], [5, 95, 'deu'], [10, 101, 'deu']]},
  {id: 'quet_hai_dau', o: ['ngang', 'bien_dong'], dau: 100, song: [[6, 101, 'deu', 'lang'], [2, 94.5, 'tang_toc', 'cao_trao'], [4, 100, 'deu'], [6, 103, 'deu'], [3, 96.5, 'deu'], [9, 102, 'deu']]},
  {id: 'ep_roi_sap', o: ['giam'], dau: 102, song: [[4, 98, 'deu'], [4, 111, 'tang_toc', 'cao_trao'], [2, 113, 'deu'], [6, 100, 'deu'], [14, 87, 'deu']]},
  {id: 'roi_deu', o: ['giam'], dau: 104, song: [[6, 96, 'deu'], [2, 99, 'deu'], [6, 92, 'deu'], [2, 95, 'deu'], [7, 87, 'deu'], [7, 84, 'deu']], w: 1.5},
  {id: 'ep_khong_dung', o: ['tang'], dau: 100, song: [[5, 99, 'deu'], [5, 108, 'tang_toc', 'cao_trao'], [3, 105.5, 'deu'], [7, 116, 'tang_toc'], [10, 122, 'deu']], mot_chieu: true},
  {id: 'dinh_phan_phoi', o: ['tang', 'ngang'], dau: 96, song: [[8, 106, 'deu'], [4, 108, 'deu', 'lang'], [3, 104, 'deu'], [2, 107, 'deu'], [13, 95, 'deu']]},
  {id: 'thung_gia', o: ['ngang'], dau: 100, song: [[5, 96, 'deu'], [3, 93, 'deu'], [4, 101, 'giam_toc', 'cao_trao'], [8, 104, 'deu'], [10, 102, 'deu']]},
];
