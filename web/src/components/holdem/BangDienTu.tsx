/**
 * BẢNG ĐIỆN TỬ — pop-up TRẢ PHÍ, mở bằng icon ở đầu vòng.
 *
 * Triết lý (founder 26/07): công khai thông số MÔI TRƯỜNG, giấu kín thông số MAY
 * RỦI và vị thế đối thủ. Bảng không nói tương lai; nó dọn dữ liệu thô của hiện
 * tại để ai chịu suy nghĩ nối lại được thành bước đi tốt hơn.
 *
 * ─── FILE NÀY KHÔNG TÍNH GÌ CẢ ─────────────────────────────────────────────
 * Mọi con số tới từ `server/holdem/bang_dien_tu.ts`: nấc thanh khoản, vạch pin,
 * lực bp, tổng ròng, số dòng chưa rõ, và cả PHÍ. Client chỉ VẼ. Bịa lại một công
 * thức ở đây là dựng nguồn chân lý thứ hai cho cùng một con số — mà người chơi
 * vừa TRẢ TIỀN cho con số đó và không có cách nào biết bên nào đúng.
 *
 * ─── BA CHỖ UI PHẢI NÓI RA, KHÔNG ĐƯỢC IM ──────────────────────────────────
 *  1. `so_dong_chua_ro` — thiếu nó thì tổng ròng bị đọc như một con số đầy đủ.
 *  2. `suong_mu` — biên độ là GỢI Ý, nấc thật được phép nằm ngoài (LUẬT 2).
 *     Vẽ nó như một khoảng bảo đảm là hứa hộ server một lời server không hứa.
 *  3. `gia_dinh_tin_that` — thanh khoản đang trả lời "sổ lệnh sâu bao nhiêu NẾU
 *     tin này thật", không phải "tin này thật hay giả".
 *
 * ─── VÌ SAO NÚT GIỮ LẠI DỮ LIỆU ĐÃ MUA ─────────────────────────────────────
 * Nội dung bảng là hàm thuần của (seed, vòng) nên lần mở thứ hai trong cùng vòng
 * KHÔNG bán thêm một mẩu nào. Server đã chặn thu phí lần hai
 * (`BANG_DIEN_TU.TOI_DA_MOI_VONG`), nhưng client vẫn không được bắn thêm POST:
 * mỗi POST thừa là một dòng thừa trong `action_log`, mà log là nguồn replay dựng
 * lại trận. Nên đóng rồi mở lại trong cùng vòng = đọc lại bản đã mua, MIỄN PHÍ,
 * và nút nói rõ là miễn phí.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PixelIcon } from '@/components/ui';
import { T_VON } from '@/lib/vocab';
import {
  PHI_BANG_DIEN_TU_MAC_DINH, useMoBangDienTu,
  type BangDienTuDTO, type DongSoCaiDTO, type DuBaoDTO, type NacThanhKhoanDTO,
  type ThanhThanhKhoanDTO,
} from '@/api/holdem';
import s from './BangDienTu.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * Giá NIÊM YẾT cho nút — catalog thắng, hằng số chỉ đỡ khi catalog chưa có
 * trường (xem điều kiện gỡ ở `PHI_BANG_DIEN_TU_MAC_DINH`).
 *
 * Tách thành hàm để chiều ưu tiên này khoá được bằng test: lệch giá ở đây nghĩa
 * là màn hình niêm yết một đằng, Vốn bị trừ một nẻo.
 */
export function phiNiemYet(phiCatalog?: number): number {
  return typeof phiCatalog === 'number' && Number.isFinite(phiCatalog) && phiCatalog >= 0
    ? phiCatalog
    : PHI_BANG_DIEN_TU_MAC_DINH;
}

const CHU_NAC: Record<NacThanhKhoanDTO, string> = {
  can: 'cạn', mong: 'mỏng', vua: 'vừa', day: 'dày', rat_day: 'rất dày',
};

const nacChu = (n: NacThanhKhoanDTO | null | undefined): string =>
  (n ? CHU_NAC[n] ?? String(n) : '?');

/** bp có DẤU. Dùng '−' (U+2212) như mọi chỗ khác trong trận, không phải gạch nối. */
function bpCoDau(v: number): string {
  const d = v < 0 ? '−' : '+';
  return `${d}${Math.abs(v).toLocaleString('vi-VN')} bp`;
}

// ══════════════════════ CHỈ BÁO 1 — vạch pin ══════════════════════

/**
 * Một thanh sức khoẻ thanh khoản.
 *
 * Ba loại ô, và ba loại phải KHÁC NHAU BẰNG MẮT chứ không chỉ bằng chữ:
 *   sáng  — chắc chắn có tới nấc này;
 *   bấp bênh — nằm trong biên độ nhấp nháy, tức KHÔNG biết (chỉ khi sương mù);
 *   tắt   — chắc chắn không tới.
 *
 * ⚠ CHỊU ĐƯỢC PAYLOAD LỆCH PHIÊN BẢN. Frontend và API deploy bằng hai lệnh riêng
 * nên "thiếu trường" là trạng thái bình thường: `bien_vach` vắng mặt thì thanh
 * rơi về 0 vạch chứ không được ném lỗi — một pop-up tuỳ chọn không được phép hạ
 * cả bàn đấu đang chơi.
 */
function ThanhPin({ t, art }: { t: ThanhThanhKhoanDTO; art: Record<string, string> }) {
  const tong = Number.isFinite(t.tong_vach) && t.tong_vach > 0 ? t.tong_vach : 3;
  const bien = t.bien_vach ?? [0, 0];
  const chac = t.suong_mu ? Math.min(bien[0], bien[1]) : (t.vach ?? 0);
  const toi = t.suong_mu ? Math.max(bien[0], bien[1]) : (t.vach ?? 0);

  const doc = t.suong_mu
    ? `${t.label}: ước lượng ${nacChu(t.bien?.[0])} đến ${nacChu(t.bien?.[1])}`
    : `${t.label}: ${nacChu(t.nac)}, ${chac}/${tong} vạch`;

  return (
    <div className={s.hangTK}>
      {/*
        ⭐ Hình mã dùng lại art ĐÃ CÓ của 6 mã (lá mới `server/art/la_bai.ts`, D393).
        Người chơi nhận ra dòng bằng HÌNH trước khi đọc tên — đúng thứ founder
        đặt: "nhìn màu sắc/biểu tượng là biết sơ qua ý nghĩa".
      */}
      {art[t.tai_san_id] && (
        // eslint-disable-next-line react/no-danger -- SVG hằng số trong repo
        <span className={s.tkArt} dangerouslySetInnerHTML={htmlTinh(art[t.tai_san_id]!)} />
      )}
      <span className={s.tenTS}>{t.label}</span>
      <span className={s.pin} role="img" aria-label={doc}>
        {Array.from({ length: tong }, (_, i) => (
          <span
            key={i}
            className={i < chac ? s.oSang : i < toi ? s.oBap : s.oTat}
          />
        ))}
      </span>
      <span className={s.nacChu}>
        {t.suong_mu ? (
          <>
            ≈ <b>{nacChu(t.bien?.[0])}–{nacChu(t.bien?.[1])}</b>
            {' · '}<span className={s.uocLuong}>ƯỚC LƯỢNG</span>
          </>
        ) : (
          <>
            <b>{nacChu(t.nac)}</b>
            {t.do_sau != null && ` · sổ lệnh ${t.do_sau.toLocaleString('vi-VN')}`}
            {t.nac !== t.nac_nen && ` · nền ${nacChu(t.nac_nen)}`}
          </>
        )}
      </span>
    </div>
  );
}

// ══════════════════════ CHỈ BÁO 2 — sổ cái ══════════════════════

/**
 * Một dòng sổ cái. BA trạng thái, vẽ khác nhau — gộp bất kỳ hai cái nào lại là
 * nói dối theo một trong hai hướng:
 *
 *   A. ĐỦ SÁNG  `luc_bp` có số → vào tổng ròng.
 *   B. NỬA SÁNG `luc_bp` null nhưng `do_lon_bp` có số: biết ĐỘ LỚN, chưa biết
 *      CHIỀU (cờ tin giả chưa lộ). Gộp vào (C) là giấu mất một con số server đã
 *      chịu bán.
 *   C. "?"      `an` — LUẬT 1, ô vừa lật đầu vòng này. TÊN sự kiện không bị che
 *      (người chơi đã thấy ô lật rồi); chỉ SỐ bị che.
 */
function DongSoCai({ d }: { d: DongSoCaiDTO }) {
  const luc = d.luc_bp;
  return (
    <div className={`${s.hangSC} ${d.an ? s.hangAn : ''}`}>
      <span className={s.scVong}>V{d.vong}</span>
      <span className={s.scTen}>{d.label}</span>
      <span className={`${s.scLuc} ${luc == null ? s.mo : luc < 0 ? s.am : s.duong}`}>
        {luc == null ? '?' : bpCoDau(luc)}
      </span>
      <span className={s.scPhu}>
        {d.an ? (
          <>Báo cáo trễ một vòng — tin này chưa vào sổ. Tự cộng nhẩm.</>
        ) : (
          <>
            {d.do_lon_bp != null && `độ lớn ${d.do_lon_bp.toLocaleString('vi-VN')} bp`}
            {d.con_vong != null
              && ` · ${d.con_vong === 0 ? 'vòng cuối' : `còn ${d.con_vong} vòng`}`}
            {d.dao === null
              ? <> · <b>chưa rõ chiều</b> — không tính vào tổng ròng</>
              : d.dao
                ? <> · <span className={s.nhanDao}>ĐẢO (tin giả đã lộ)</span></>
                : ' · thuận chiều'}
          </>
        )}
      </span>
    </div>
  );
}

// ══════════════════════ Pop-up ══════════════════════

/**
 * D33 — KHỐI DỰ BÁO 3 TÊN (nấc +30 của thẻ Lướt Sóng).
 *
 * ⚠ CÂU "ÍT NHẤT MỘT TÊN SAI" LÀ BẮT BUỘC, không phải chú thích trang trí. Đây
 * là phương án A của founder và là toàn bộ điểm cân bằng của đặc quyền: nó biến
 * "biết trước" thành "biết hẹp hơn". Bỏ câu đó đi thì người chơi đọc ba tên như
 * ba khả năng ngang nhau và đặt cược nặng hơn thứ dữ liệu cho phép — tức UI tự
 * hứa hộ một lời server cố ý không hứa.
 *
 * KHÔNG đánh số, KHÔNG sắp lại: thứ tự đã xáo ở server và cố ý không phản ánh
 * xác suất. Đánh số 1·2·3 là dựng lại một bảng xếp hạng không tồn tại.
 */
/**
 * CẤP 2 LƯỚT SÓNG — XÁC THỰC TIN. Founder 22/08: *"lv2 sẽ cho phép thấy thêm
 * những thứ giúp dự đoán và xác thực thông tin (tin giả–thật) dễ dàng hơn"*.
 * Hai dòng, cả hai đều phải nói rõ mình là GÌ: xác suất là xác suất (vẫn phải
 * đoán), lộ sớm là lộ sớm (chỉ tâm bão). Không dòng nào được đọc thành "đáp án".
 */
function KhoiXacThuc({ d }: { d: NonNullable<BangDienTuDTO['xac_thuc']> }) {
  if (d.xac_suat_gia_bp === null && !d.lo_som) return null;
  return (
    <div className={s.muc} data-tap="bang-xac-thuc">
      <div className={s.mucTen}>XÁC THỰC TIN · LƯỚT SÓNG CẤP 2</div>
      {d.xac_suat_gia_bp !== null && ((giaBp: number) => (
        /*
         * 117 ký tự để chở MỘT con số phần trăm. Nay: icon `news` (lưới ĐÃ CÓ,
         * và docstring của chính nó khai "nhánh TIN GIẢ dùng CÙNG lưới, đổi màu
         * ở CSS" — tức nó được vẽ sẵn cho đúng chỗ này) + con số + một THANH
         * VẠCH cùng ngôn ngữ với vạch thanh khoản ngay dưới. Người chơi đọc ra
         * mức mà không phải parse chữ số.
         * ⚠ Vế rào đón ("không phải lời phán về chính tin này") KHÔNG bị vứt —
         * hiệu chuẩn null D106 đo ra `phan_tin_gia` chính là tỷ lệ NỀN của map,
         * nên nó đúng và phải giữ. Nó chỉ là thứ đọc MỘT LẦN nên vào `?`.
         */
        <div className={s.tinGia}>
          <PixelIcon name="news" size={12} className={s.tinGiaIcon} />
          <b className={s.tinGiaSo}>GIẢ {Math.round(giaBp / 100)}%</b>
          <span className={s.tinGiaVach} aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i
                key={i}
                className={i < Math.round(giaBp / 1000) ? s.vachDay : ''}
              />
            ))}
          </span>
          <ChuGiai>
            Tin đang nổ có <b>{Math.round(giaBp / 100)}%</b> khả năng
            là <b>GIẢ</b> — con số của loại tin này trong bối cảnh này, không phải
            lời phán về chính tin này.
          </ChuGiai>
        </div>
      ))(d.xac_suat_gia_bp)}
      {d.lo_som && (
        <div className={s.duRo}>
          Tin <b>{d.lo_som.label}</b> vòng trước:{' '}
          <b>{d.lo_som.la_tin_gia ? 'GIẢ' : 'THẬT'}</b> — biết sớm một vòng vì bạn
          đang cầm đúng mã tâm bão.
        </div>
      )}
    </div>
  );
}

/**
 * CHÚ GIẢI THU SAU MỘT DẤU `?` — founder 23/08: *"xóa những text không cần
 * thiết và thu gọn những text cần thiết lại thành icon chú thích… chỉ cần nhìn
 * màu sắc/biểu tượng là có thể biết sơ qua ý nghĩa"*.
 *
 * ⚠ Dùng `<details>` THUẦN, không hook — đúng nếp SỔ CÁI DƯ ÂM ngay dưới đã
 * đặt: không state, trạng thái mở/đóng sống qua re-render, và **nội dung vẫn
 * nằm trong DOM khi đóng** nên trình đọc màn hình lẫn bài test vẫn với tới.
 * Đó là lý do KỸ THUẬT để chọn `<details>` thay vì render có điều kiện: thu gọn
 * mà làm rơi mất tin thì không phải thu gọn.
 *
 * ⚠ Ký tự `?` do JetBrains Mono vẽ — KHÔNG phải emoji (D47), không cần lưới mới.
 */
function ChuGiai({ children }: { children: React.ReactNode }) {
  return (
    <details className={s.chuGiai}>
      {/*
        ⚠ GLYPH LÀ `!`, KHÔNG PHẢI `?` — va chạm nghĩa trên CHÍNH bảng này:
        cột lực của SỔ CÁI dùng `?` với nghĩa "CHƯA BIẾT giá trị". Hai ký hiệu
        giống nhau, hai nghĩa khác hẳn, cùng một pop-up. `!` lại đúng ký hiệu
        "giải thích" mà lá bài đã dạy người chơi (`GameCard` dấu (!)).
      */}
      <summary className={s.chuGiaiNut} aria-label="Giải nghĩa khối này">!</summary>
      <div className={s.chuGiaiChu}>{children}</div>
    </details>
  );
}

function KhoiDuBao({ d, art }: { d: DuBaoDTO; art: Record<string, string> }) {
  return (
    <div className={s.muc}>
      {/*
        ⚠ VẾ "CÓ N TÊN SAI" LÊN TIÊU ĐỀ, KHÔNG THU VÀO `?`. D33 tuyên nó là
        TOÀN BỘ điểm cân bằng của đặc quyền ("biến BIẾT TRƯỚC thành BIẾT HẸP
        HƠN"), nên nó phải ở chỗ mắt chắc chắn nhìn. Thứ thu vào là vế GIẢI
        THÍCH ("thứ tự không nói lên khả năng") — vế đó đang mô tả bằng lời một
        điều BỐ CỤC đã nói: ba ô cùng viền, cùng nền, cùng cỡ, không đánh số.
      */}
      <div className={s.mucTen}>
        DỰ BÁO Ô VÒNG {d.vong}
        <span className={s.mucCanh}>✕{d.so_ten_sai} SAI</span>
        <ChuGiai>
          Trong ba tên này có <b>ít nhất {d.so_ten_sai} tên SAI</b>. Thứ tự không
          nói lên khả năng — bảng cố ý không xếp hạng và không hiện xác suất.
        </ChuGiai>
      </div>
      <div className={s.duBaoHang}>
        {d.ten.map((t) => {
          /*
           * ⭐ ART DÙNG LẠI, KHÔNG VẼ MỚI. `server/holdem_art_grids.ts` đã có đủ
           * lưới cho cả 12 sự kiện lẫn 5 giai đoạn, và `art` đã nạp sẵn ở màn
           * trận (đang truyền cho MarketMap + ShopManHinh). Cái lợi không chỉ là
           * tiết kiệm công: ô dự báo nay mang ĐÚNG hình người chơi sẽ thấy lật
           * trên bản đồ, nên hai chỗ thôi nói về cùng một sự kiện bằng hai ngôn
           * ngữ khác nhau — bỏ hẳn bước bắc cầu bằng cách đọc tên.
           */
          const hinh = art[`${t.kind === 'su_kien' ? 'sk' : 'gd'}_${t.id}`];
          return (
            <span key={`${t.kind}:${t.id}`} className={s.duBaoTen}>
              {hinh && (
                // eslint-disable-next-line react/no-danger -- SVG hằng số trong repo
                <span className={s.duBaoArt} dangerouslySetInnerHTML={htmlTinh(hinh)} />
              )}
              {t.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * K4 (D164) — VỊ TRÍ TRONG CHUỖI VĨ MÔ, VẼ BẰNG VẬT.
 *
 * ⚠ D336 lượt 2 (founder 15/09, khoanh đúng dòng này): *"nhiều chữ và hơi vướng víu, có thể đổi
 * thành hình ảnh trực quan"*. Bản cũ là một hộp vàng viết "CHUỖI VĨ MÔ: ▼ GIẢM · 3 ô · tiền ĐẮT".
 * Nay: MỘT MŨI TÊN CHO MỖI Ô chuỗi đã sống (đếm bằng mắt, trần 8), màu theo hướng, và một chip
 * tiền. Câu đầy đủ nằm ở `aria-label`/`title` — người dùng trình đọc màn hình không mất chữ nào.
 * Chữ vẫn dịch từ ID server (D26); bảng chỉ đưa con số gộp, cách SUY tuổi chuỗi dạy ở màn tập.
 */
function ChuoiViMo({ c }: { c: NonNullable<BangDienTuDTO['chuoi_vi_mo']> }) {
  const huong = c.huong === 'len' ? 'TĂNG' : c.huong === 'xuong' ? 'GIẢM' : 'ĐI NGANG';
  const tien = c.moi_truong === 're' ? 'RẺ' : c.moi_truong === 'dat' ? 'ĐẮT' : 'TRUNG TÍNH';
  const dau = c.huong === 'len' ? '▲' : c.huong === 'xuong' ? '▼' : '▬';
  const mau = c.huong === 'len' ? s.duong : c.huong === 'xuong' ? s.am : s.mo;
  const cau = `Chuỗi vĩ mô: ${huong} · ${c.dai} ô · tiền ${tien}`;
  return (
    <div className={s.chuoi} role="img" aria-label={cau} title={cau} data-huong={c.huong}>
      <span className={s.chuoiNhan} aria-hidden>CHUỖI</span>
      <span className={`${s.chuoiVach} ${mau}`} aria-hidden>
        {dau.repeat(Math.max(1, Math.min(8, c.dai)))}{c.dai > 8 ? '+' : ''}
      </span>
      <span
        className={`${s.chuoiTien} ${c.moi_truong === 're' ? s.duong : c.moi_truong === 'dat' ? s.am : s.mo}`}
        aria-hidden
      >
        TIỀN {tien}
      </span>
    </div>
  );
}

function NoiDung({ d, art }: { d: BangDienTuDTO; art: Record<string, string> }) {
  const chuaRo = d.so_dong_chua_ro ?? 0;
  return (
    <>
      {d.sach && (
        <div className={s.duRo}>
          Hạng <b>SẠCH</b> — dữ liệu không bị trễ một vòng, không mã nào bị ước
          lượng. Đặc quyền của thẻ <b>Lướt Sóng</b>.
        </div>
      )}
      {d.du_bao && <KhoiDuBao d={d.du_bao} art={art} />}
      {d.xac_thuc && <KhoiXacThuc d={d.xac_thuc} />}

      {/*
        ⚠ D336 lượt 2 — dòng "Nhìn hai chỗ: độ dài vạch · dấu của số lớn." (chỉ ở màn tập) GỠ theo
        founder 15/09 (*"nhiều chữ và hơi vướng víu … xóa nếu ko cần thiết"*). Nó tả bằng lời thứ hình
        đã nói, và chỗ chỉ tay khi bảng mở là Oracle thu gọn (`goiY`), không phải một hộp chữ nữa.
        Prop `gonTap` gỡ cùng lượt: dòng ấy là việc duy nhất nó còn làm.
      */}
      {d.chuoi_vi_mo && <ChuoiViMo c={d.chuoi_vi_mo} />}
      {/* v16 — icon pixel TRẠNG THÁI thiên nga đen (founder 01/08): thẻ đã
        * chia 5 mặt có tên, con thiên nga ở lại đây — dấu hiệu "một rủi ro
        * đuôi đang còn dư âm trên bàn". Render vô điều kiện khi true (R1). */}
      {(d as { thien_nga?: boolean }).thien_nga && (
        <div className={s.canhBao ?? ''} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden>
            <rect x="0" y="0" width="7" height="7" fill="#1e1b3a" />
            <rect x="3" y="1" width="1" height="1" fill="#0a0618" />
            <rect x="4" y="1" width="1" height="1" fill="#ef4444" />
            <rect x="3" y="2" width="1" height="3" fill="#0a0618" />
            <rect x="2" y="4" width="4" height="2" fill="#0a0618" />
            <rect x="2" y="4" width="1" height="1" fill="#a78bfa" />
          </svg>
          <b>RỦI RO ĐUÔI CÒN DƯ ÂM</b>
        </div>
      )}
      {/*
        ⚠ HAI ĐOẠN CHÚ GIẢI CỦA KHỐI NÀY (điều kiện "tin THẬT" + cách đọc vạch)
        GỘP VÀO MỘT `?` TRÊN TIÊU ĐỀ — founder chụp ảnh đúng hai chỗ này.
        Điều kiện áp cho cả khối thì đặt lên TIÊU ĐỀ khối là đúng chỗ hơn một
        hộp riêng phía trên: nó gắn vào chính thứ nó điều kiện hoá. Chip
        "nếu tin THẬT" vẫn NÓI, chỉ nói ngắn — thứ mất đi là 122 ký tự giải
        thích VÌ SAO, thứ giữ lại là điều kiện.
      */}
      <div className={s.muc}>
        <div className={s.mucTen}>
          THANH KHOẢN SỔ LỆNH
          {d.gia_dinh_tin_that && <span className={s.mucCanh}>nếu tin THẬT</span>}
          <ChuGiai>
            Vạch đầy = sổ lệnh dày = trượt giá nhẹ. Vạch <b>nhấp nháy</b> là ƯỚC
            LƯỢNG cho mã đầu cơ: nấc thật <b>có thể nằm ngoài</b> khoảng đó.
            {d.gia_dinh_tin_that && (
              <>
                {' '}Số ở đây tính theo <b>giả định tin vòng này là THẬT</b>. Tin
                giả thì sổ lệnh không hề co lại — bảng cố ý không bán câu trả lời đó.
              </>
            )}
          </ChuGiai>
        </div>
        {d.thanh_khoan.map((t) => <ThanhPin key={t.tai_san_id} t={t} art={art} />)}
      </div>

      <div className={s.muc}>
        {/*
          * Founder 02/08 — "sổ cái dư âm cũng đang hơi vô dụng": thứ hành động
          * được là TỔNG LỰC KÉO RÒNG (và cảnh báo còn dòng bị che), nên hai
          * thứ đó hiện LUÔN; bảng dòng chi tiết thu sau một cú bấm — cùng nếp
          * "VÌ SAO ▾" founder đặt cho màn trận. Dùng <details> thuần: không
          * hook, không JS, trạng thái mở/đóng sống qua re-render.
          */}
        {/*
          ⚠ D336 lượt 2 — "còn N dòng chưa đọc được" thôi là một hộp 25 chữ dưới tổng (founder 15/09
          khoanh nó cùng hai hộp trên). Nó vẫn là CẢNH BÁO, không phải chú thích: thiếu nó thì tổng ròng
          đọc như một con số đủ. Nên cảnh báo dời LÊN CHÍNH HÀNG TỔNG, thành N ô gạch — một ô một dòng bị
          che — đứng ngay trước con số; câu giải thích thu sau dấu (!) như mọi khối khác của bảng.
        */}
        <div className={s.tong}>
          <span className={s.tongNhan}>
            TỔNG LỰC KÉO RÒNG
            <ChuGiai>
              Tổng chỉ cộng những dòng đã đọc được. Mỗi ô gạch là <b>một dòng còn bị che</b> —
              tổng thật có thể lệch khỏi số này. Báo cáo tài chính nào cũng có độ trễ.
            </ChuGiai>
          </span>
          <span className={s.tongPhai}>
            {chuaRo > 0 ? (
              <span
                className={s.anDong}
                role="img"
                data-an={chuaRo}
                aria-label={`Còn ${chuaRo} dòng chưa đọc được — tổng ròng CHƯA ĐỦ`}
                title={`Còn ${chuaRo} dòng chưa đọc được — tổng ròng CHƯA ĐỦ`}
              >
                {Array.from({ length: Math.min(chuaRo, 6) }, (_, i) => <i key={i} className={s.oGach} />)}
                <b>+{chuaRo}</b>
              </span>
            ) : (
              <span className={s.duDong} role="img" aria-label="Không còn dòng nào bị che ở vòng này" title="Không còn dòng nào bị che ở vòng này">
                ✓ ĐỦ
              </span>
            )}
            <span className={`${s.tongSo} ${d.tong_rong_bp < 0 ? s.am : s.duong}`}>
              {bpCoDau(d.tong_rong_bp)}
            </span>
          </span>
        </div>

        <details className={s.soCaiGap}>
          <summary className={`${s.mucTen} ${s.soCaiMo}`}>
            SỔ CÁI DƯ ÂM · {d.so_cai.length} dòng — bấm mở
          </summary>
          {d.so_cai.length === 0
            ? <div className={s.rong}>Chưa có dư âm nào đang chồng chập.</div>
            : d.so_cai.map((x) => <DongSoCai key={`${x.vong}-${x.su_kien}`} d={x} />)}
          <div className={s.chuThich}>
            bp = phần vạn (10.000 bp = 100%). Lực tính trên <b>danh mục hiện tại</b>{' '}
            của bạn — mua thêm thẻ là số này đổi.
          </div>
        </details>
      </div>
    </>
  );
}

// ══════════════════════ Nút + lớp phủ ══════════════════════

export function BangDienTu({
  matchId, vong, von, phi, phiDuBao, onMo, onDoiTrangThai, art = {}, gon = false,
}: {
  /** Lưới art pixel do màn trận nạp sẵn (đã dùng cho MarketMap + ShopManHinh). */
  art?: Record<string, string>;
  matchId: string | null;
  vong: number;
  /** Vốn hiện có — chỉ để BÁO TRƯỚC là không đủ; server vẫn là bên chốt. */
  von: number;
  /**
   * Giá niêm yết hạng CƠ BẢN của CHÍNH ghế này (server đã tính thẻ Lướt Sóng).
   * Truyền qua `phiNiemYet(st.ban.gia_bang?.co_ban ?? catalog?.luat.PHI_BANG_DIEN_TU)`.
   */
  phi: number;
  /**
   * D33 — giá hạng CÓ DỰ BÁO. `null` = ghế này không cầm Lướt Sóng nên nấc +30
   * không tồn tại với họ; nút thứ hai KHÔNG được hiện.
   *
   * ⚠ Server suy, client vẽ. Đừng suy "có thẻ Lướt Sóng thì +30": bảng giá là
   * `MC-TUNE`, và chép tay ở đây là màn hình niêm yết một đằng, Vốn trừ một nẻo.
   */
  phiDuBao?: number | null;
  /*
   * ⚠ Prop `gonTap` (bảng gọn màn tập, founder 03/08) GỠ 15/09 (D336 lượt 2): hai khối chú
   * thích dài nó từng giấu đã thu sau dấu (!) cho MỌI người từ lâu, việc cuối cùng nó còn làm
   * là in dòng "Nhìn hai chỗ…" — dòng founder bảo xoá. Giữ một prop không làm gì là dựng sẵn
   * chỗ cho người sau tưởng nó còn tác dụng.
   */
  /** Gọi một lần khi người chơi mở bảng — xem `CoachTap` bước `mo-bang`. */
  onMo?: () => void;
  /**
   * D336 — báo CẢ HAI chiều mở/đóng. Khác `onMo` (mốc "đã từng mở"): trợ lý màn tập cần
   * biết bảng ĐANG che bàn để không rọi vào nút nằm dưới lớp phủ bảng (z-index 85).
   */
  onDoiTrangThai?: (mo: boolean) => void;
  /** D443 — bản GỌN cho hàng nút thanh đáy (cạnh SHOP): icon · BẢNG · giá, xếp dọc. Giá vẫn in thẳng trên nút. */
  gon?: boolean;
}) {
  const [mo, setMo] = useState(false);
  useEffect(() => { onDoiTrangThai?.(mo); }, [mo, onDoiTrangThai]);
  /*
   * Báo ra ngoài khi bảng ĐƯỢC MỞ — trợ lý màn tập cần biết để không cho đi
   * tiếp tới khi người chơi tự tay mở (founder 04/08: "cầm tay chỉ việc").
   * ⚠ Chỉ báo chiều MỞ, không báo chiều đóng: đây là mốc "đã từng mở", không
   * phải trạng thái hiện thời — đóng lại rồi mà bắt học lại là phiền vô cớ.
   */
  useEffect(() => { if (mo) onMo?.(); }, [mo, onMo]);
  /** Bản đã MUA của vòng nào. Khác vòng ⇒ phải trả tiền lại. */
  const [daMua, setDaMua] = useState<{ vong: number; data: BangDienTuDTO } | null>(null);
  const moBang = useMoBangDienTu(matchId);

  const banDaCo = daMua?.vong === vong ? daMua.data : null;
  const duVon = von >= phi;
  /*
   * NÂNG HẠNG — chỉ chào khi ĐÃ mở hạng cơ bản mà CHƯA có dự báo. Server thu
   * đúng phần chênh (xem endpoint `/bang-dien-tu`), nên nút phải niêm yết đúng
   * phần chênh đó chứ không phải giá đủ.
   */
  const conNangHang = !!banDaCo && !banDaCo.du_bao && typeof phiDuBao === 'number';
  const phiNang = conNangHang ? Math.max(0, phiDuBao! - phi) : 0;

  // Sang vòng mới thì đóng lớp phủ: nội dung cũ nói về vòng cũ, để nó nằm lại là
  // bán số liệu sai cho một vòng người chơi chưa trả tiền.
  useEffect(() => { setMo(false); moBang.reset(); },
    [vong]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Esc đóng — lớp phủ này che cả bàn đấu, không được phép bẫy người chơi trong
  // đó nếu nút ✕ trượt ra ngoài vùng cuộn trên một màn thấp.
  useEffect(() => {
    if (!mo) return undefined;
    const nghe = (e: KeyboardEvent) => { if (e.key === 'Escape') setMo(false); };
    window.addEventListener('keydown', nghe);
    return () => window.removeEventListener('keydown', nghe);
  }, [mo]);

  function goi(duBao = false) {
    if (!matchId) return;
    moBang.mutate({ vong, ...(duBao ? { du_bao: true } : {}) },
      { onSuccess: (data) => setDaMua({ vong, data }) });
  }

  function bamMo() {
    setMo(true);
    // Đã mua vòng này → xem lại, KHÔNG bắn POST (xem docstring đầu file).
    if (banDaCo || !duVon) return;
    goi();
  }

  const dangTai = moBang.isPending;
  const coLoi = moBang.isError && !banDaCo;

  return (
    <>
      <button
        type="button"
        className={gon ? `${s.nutMo} ${s.nutMoGon}` : s.nutMo}
        // D336 — neo trợ lý màn tập nằm trên CHÍNH nút này, không trên cả hàng chứa nó.
        data-tap="bang"
        onClick={bamMo}
        aria-label={banDaCo
          ? `Xem lại Bảng điện tử vòng ${vong} (miễn phí)`
          : `Mở Bảng điện tử — phí ${phi} ${T_VON}`}
      >
        <PixelIcon name="chart" size={16} />
        <span className={s.nutChu}>{gon ? 'BẢNG' : 'BẢNG ĐIỆN TỬ'}</span>
        {/*
          * GIÁ IN THẲNG TRÊN NÚT, không nằm trong tooltip: thu tiền mà không báo
          * giá trước là lừa, và "báo giá sau khi rê chuột" vẫn là không báo.
          */}
        <span className={`${s.gia} ${banDaCo ? s.giaMienPhi : duVon ? '' : s.giaThieu}`}>
          {banDaCo ? 'ĐÃ MỞ' : `${phi} ${T_VON}`}
        </span>
      </button>

      {/*
        D443 — lớp phủ đi qua PORTAL ra <body>. Nút nay nằm trong thanh đáy (sticky, z-index 45 ⇒ một ngữ cảnh xếp
        chồng riêng): để lớp phủ ở trong đó thì `z-index: 85` của nó chỉ có nghĩa BÊN TRONG thanh, và menu chính
        (fixed, 50) đè lên bảng.
      */}
      {mo && createPortal(
        <div className={s.lop} role="dialog" aria-label="Bảng điện tử">
          <div className={s.tam}>
            <div className={s.dau}>
              <span className={s.ten}>
                BẢNG ĐIỆN TỬ <span className={s.tenVong}>· VÒNG {vong}</span>
              </span>
              <button
                type="button" className={s.dong}
                onClick={() => setMo(false)} aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className={s.than}>
              {/*
                * THỨ TỰ NHÁNH LÀ CỐ Ý: lỗi và thiếu Vốn đứng TRƯỚC skeleton.
                * Màn chỉ có "đang chờ" thì không phân biệt được chậm với chết —
                * đã dính đúng lỗi đó ở bàn đấu, và nó là lỗi thiết kế chứ không
                * phải lỗi mạng.
                */}
              {!duVon && !banDaCo ? (
                <div className={s.thieu} role="status">
                  Không đủ <b>{T_VON}</b> để mở bảng. Cần <b>{phi}</b>, bạn còn{' '}
                  <b>{von.toLocaleString('vi-VN')}</b>.
                  <br />
                  Chốt phiên vài vòng cho vốn dày lên rồi quay lại — bảng vẫn ở đây.
                </div>
              ) : coLoi ? (
                <div className={s.loi} role="alert">
                  Không mở được Bảng điện tử. Có thể mạng vừa gián đoạn, hoặc vòng
                  này đã sang vòng khác.
                  <div className={s.hangNut}>
                    {/* Bọc arrow: `onClick` truyền MouseEvent làm đối số đầu,
                        mà `goi(duBao)` nhận boolean — truyền thẳng là mỗi lần
                        thử lại tự bật nấc +30 và thu thêm tiền. */}
                    <button type="button" className={s.nutPhu} onClick={() => goi()}>
                      ↻ THỬ LẠI
                    </button>
                    <button
                      type="button" className={s.nutPhu}
                      onClick={() => setMo(false)}
                    >
                      ‹ ĐÓNG
                    </button>
                  </div>
                </div>
              ) : banDaCo && !dangTai ? (
                <>
                  <NoiDung d={banDaCo} art={art} />
                  {/*
                    * NÚT NÂNG HẠNG — chỉ hiện khi nấc +30 còn mua được, và GIÁ
                    * IN THẲNG TRÊN NÚT như nút mở. Đây là quyết định THỨ HAI của
                    * vòng ("có cần nhìn TỚI TRƯỚC không?"), tách hẳn khỏi quyết
                    * định thứ nhất ("có đáng mở bảng không") — D33 nói rõ hai
                    * hạng là hai kiểu người khác nhau và phải log riêng.
                    */}
                  {conNangHang && (
                    <button
                      type="button"
                      className={s.nutPhu}
                      disabled={von < phiNang}
                      onClick={() => goi(true)}
                    >
                      + DỰ BÁO Ô VÒNG SAU — {phiNang} {T_VON}
                    </button>
                  )}
                </>
              ) : (
                <div className={s.dangTai} aria-busy="true" data-cho="bang-dien-tu">
                  ĐANG NỐI BẢNG ĐIỆN TỬ…
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
