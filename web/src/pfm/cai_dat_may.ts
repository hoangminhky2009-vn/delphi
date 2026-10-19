/**
 * PFM — CÀI ĐẶT CỤC BỘ CỦA MÁY NÀY (khối ⑥ màn Cài đặt, D295): tắt Gương · tắt nhắc.
 *
 * ⚠ VÌ SAO TÁCH KHỎI `components/pfm/CaiDatPfm.tsx`: `ket_chay.ts` phải KỂ TÊN id này trong
 * `META_O_LAI_MAY` (bài canh §I `pfm_ket_chay.test.ts` đòi mọi id `meta` phải được xếp loại),
 * mà `web/src/pfm/` không được import ngược từ `components/` — chiều phụ thuộc là màn dùng
 * module, không phải module dùng màn. Một tệp lá chỉ chứa id + hình dạng + mặc định là chỗ
 * cả hai bên cùng trỏ tới.
 *
 * ⚠ Ở LẠI MÁY có chủ ý: "tắt Gương trên máy này" là câu chữ demo — cài đặt của MÁY, không
 * phải của tài khoản; đưa vào két là mang sở thích của điện thoại cũ sang điện thoại mới.
 * `META_VAO_KET` là danh sách CHO PHÉP nên vắng tên đã đủ để không vào két; ghi tên vào
 * `META_O_LAI_MAY` là để bài canh biết đây là QUYẾT ĐỊNH, không phải bỏ sót.
 */
export const ID_CAI_DAT_MAY = 'cai_dat_may';
export interface CaiDatMay { guongTat: boolean; nhacTat: boolean }
export const CAI_DAT_MAY_MAC_DINH: CaiDatMay = { guongTat: false, nhacTat: false };
