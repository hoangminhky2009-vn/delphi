/**
 * RUỘT LỚP TRƯỢT "Bạn có nhu cầu quản lý tài chính cá nhân?" — mở từ link nhỏ dưới ô Tài chính đang khoá (SPEC chan-truoc-beta 4.3).
 *
 * ⚠ CHỖ CHỪA CHO SPEC `khao-sat-nhu-cau-pfm` (cửa sổ THI CÔNG khảo sát, đang dựng song song): luồng thật (≥ 10 trận Alpha Draft →
 * Oracle đoán → vấn đề → nhu cầu → quà) THAY ruột tệp này. Hub chỉ biết "link mở lớp trượt này" — đổi ruột không phải chạm Hub.
 * Tới lúc đó lớp nói thật: phần hỏi chưa mở, và nói điều kiện đã CHỐT của nó (10 trận) — không hứa thêm gì.
 */
import { CHU_HUB } from '@/lib/hub_chu';
import t from './HubTam.module.css';

export function RuotNhuCauPfm(): React.ReactElement {
  return (
    <>
      <p className={t.tamMo}>{CHU_HUB.nhuCauPfm}</p>
      <p className={t.ghiChu}>{CHU_HUB.nhuCauPfmCho}</p>
    </>
  );
}
