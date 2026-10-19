/**
 * DẢI THỊ TRƯỜNG — SÁU MÃ CÙNG NHÍCH SAU CHỐT (12/09/2026, Q3 "liên kết nhìn thấy").
 *
 * ─── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Đo 12/09: client chỉ nhận dây chuyền của ghế mình ⇒ mã KHÔNG cầm không có một
 * pixel nào trên bàn, và không chỗ nào đặt "cái kéo" (ô vừa lật) với "thứ bị
 * kéo" (sáu mã) trong cùng một khung, cùng một lúc. Người chơi phải tự thống kê
 * ~10 trận mới đoán ra "ba thứ này động như một". Founder 12/09: *"hiển thị cả
 * 6 mã cùng lúc trong trận … bằng hình ảnh/hiệu ứng thay vì chữ trong phần lý do"*.
 *
 * Khối này đứng NGAY DƯỚI bản đồ (cùng khung `data-tap="map"`): ô vừa lật ở
 * trên, sáu lá ở dưới, cùng một nhịp. Gestalt *common fate*: thứ nhích cùng
 * nhau được mắt gom thành một nhóm, không cần một chữ nào.
 *
 * ─── LUẬT ──────────────────────────────────────────────────────────────────
 * · CHỈ SAU CHỐT (HOP-MOAT M.2): trước quyết định dải đứng yên, không mũi tên,
 *   không gợi ý. Dữ liệu là `ket_qua_vong.thi_truong_vong` — lợi suất công khai
 *   EX-POST của đủ sáu mã, không β (M.6.3). Vắng ⇒ dải đứng yên, không dấu hỏi.
 * · HÌNH, KHÔNG CHỮ, KHÔNG SỐ: chiều = mũi tên pixel + mặt nạ màu; độ mạnh = SỐ MŨI TÊN
 *   (1 nhẹ · 2 mạnh · "=" đứng giá) — lá ĐỨNG YÊN (D398, founder 24/09: *"cho nó đứng im đi
 *   chứ cứ lên xuống rối mắt quá. (thay vào đó giảm mạnh thì 2 icon giảm, tăng mạnh thì 2
 *   icon tăng và tương tự cho giảm ít/ ko ảnh hưởng nhiều"*). Cùng thứ tiếng với chip trên
 *   mặt lá ("CRYPTO ▼▼ · USDT ▲"). "Cùng cái kéo" = cùng một nhịp; nhóm ngược chiều hiện
 *   mũi tên nhịp thứ hai. Vạch dưới lá mang MÀU của cái kéo (cùng màu ô).
 * · A11.18: lá là VẬT ⇒ `steps()`; huy hiệu cái kéo là ÁNH SÁNG ⇒ `ease-in-out`;
 *   chỉ `transform`/`opacity`; một phần tử một chủ `animation`; nhánh
 *   `prefers-reduced-motion` giữ nguyên thời lượng (nháy mờ thay vì nhích).
 * · MÔ TẢ, KHÔNG KÊ ĐƠN (A10): khối này chỉ tả vòng vừa đóng. Không có chế độ
 *   người mới riêng (D90) — người mới đọc "cùng nhau", người thạo đọc "ai mạnh".
 * · Art: lá + 4 lưới huy hiệu đã có sẵn; 13/09 thêm ĐÚNG HAI lưới 8 hàng cho mũi
 *   tên lên/xuống (`mui_len`/`mui_xuong`) vào chính hệ icon pixel — không dựng lại
 *   tam giác CSS, không thuê art ngoài (A11.14).
 */
import type { CSSProperties } from 'react';
import type { ThanhKhoanVongDTO } from '@/api/holdem';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import s from './DaiThiTruong.module.css';
import { htmlTinh } from '@/lib/html_tinh';

export interface LaThiTruong {
  id: string;
  ten: string;
  nhom: 'rui_ro' | 'phong_thu';
  /** SVG hằng số của repo (`/holdem/art`) — vắng thì ô hình trống, không nổ. */
  svg?: string | undefined;
  /** Số chip DÀY đang cầm (0 = không cầm ⇒ lá mờ, không cọc). */
  chipDay: number;
}

/** Cái kéo của vòng vừa chốt — huy hiệu tính chất (ô sự kiện) hoặc null (ô giai đoạn). */
export interface KeoThiTruong {
  icon?: PixelIconName | undefined;
  ten: string;
  /** Màu ô (MAU_O của MarketMap) — chảy xuống vạch dưới lá. */
  mau?: string | undefined;
}

export interface DaiThiTruongProps {
  /** Sáu mã theo thứ tự catalog. */
  la: readonly LaThiTruong[];
  /** `ket_qua_vong.thi_truong_vong` của vòng vừa chốt; vắng = chưa chốt / API cũ. */
  thiTruong: readonly { ma: string; delta_bp: number }[] | undefined;
  keo: KeoThiTruong | null;
  /** Vòng của kết quả — đổi vòng là remount ⇒ hoạt ảnh chạy lại (cùng nếp MarketMap). */
  vong: number;
  /** Đã tới nhịp nhích chưa (cha bật sau khi ô lật xong — `NHIP.CUA_SO_LAT`). */
  nhich: boolean;
  /**
   * v54 (D395) — `ket_qua_vong.thanh_khoan_vong`: THƯỚC THANH KHOẢN dưới mỗi lá, co/giãn theo lá vừa
   * lật (founder 24/09). Vắng (chưa chốt / trận không có thước / API cũ) ⇒ không vẽ thước.
   */
  thanhKhoan?: readonly ThanhKhoanVongDTO[] | undefined;
  /**
   * Trận này CÓ thước (`thanh_khoan_nam_nac` của trạng thái trận) ⇒ giữ chỗ hàng thước cả khi chưa có dữ
   * liệu, để dải chỉ có MỘT chiều cao. Vắng/false ⇒ dải y hệt trước D395 (v53 · v45 · API cũ).
   */
  coThuoc?: boolean | undefined;
}

/**
 * Trạng thái từng vạch của thước. Trước nhịp nhích thước nằm ở NỀN (vạch nền sáng — nấc nền là thông tin
 * công khai); tới nhịp nhích nó co/giãn tới vạch của vòng: vạch mất nháy đỏ rồi tối (`co`), vạch thêm bật
 * xanh (`gian`).
 * ⚠ MÃ ĐẦU CƠ (`vach: null`, sương mù — luật 2 của Bảng điện tử): đúng các vạch NỀN THỞ MỜ (`mo`), vạch ngoài
 * nền tắt — không co không giãn. Nấc nền công khai, nấc của vòng này thì không: thở = "không đọc được".
 * Soi mắt D395 bắt HAI lần trên màn thật: (1) vẽ theo biên của bảng (cố ý lệch 30%) ⇒ Crypto "giãn" hai vạch
 * dưới một lá không chạm sổ; (2) cả thước thở mờ năm vạch ⇒ dưới CẠN THANH KHOẢN (lá ghi "CRYPTO ▼▼") thước
 * Crypto đi từ 2 vạch LÊN 5 — mắt đọc là giãn, và đứng cạnh VN30 năm vạch thì đọc là "rất dày".
 * Tách thành hàm thuần để bài canh đọc được mà không cần dựng DOM.
 */
export type VachThuoc = 'tat' | 'sang' | 'gian' | 'co' | 'mo';
export function vachThuoc(tk: ThanhKhoanVongDTO, dong: boolean): VachThuoc[] {
  const nen = tk.vach_nen;
  return Array.from({ length: tk.tong_vach }, (_, i) => {
    const k = i + 1;
    if (!dong) return k <= nen ? 'sang' : 'tat';
    if (tk.vach === null) return k <= nen ? 'mo' : 'tat';
    if (k <= tk.vach) return k <= nen ? 'sang' : 'gian';
    return k <= nen ? 'co' : 'tat';
  });
}

/**
 * NGƯỠNG NẤC (bp trên lợi suất công khai của mã). Dưới nấc 1 = "không ảnh hưởng nhiều" (dấu "=").
 * ⚠ PLAYTEST-TUNE: số hiển thị, không phải số engine; đổi không qua `balance_version`.
 */
export const NGUONG_NAC_BP = [100, 700, 1500] as const;

export function nacCua(bp: number): 0 | 1 | 2 | 3 {
  const a = Math.abs(bp);
  if (a >= NGUONG_NAC_BP[2]) return 3;
  if (a >= NGUONG_NAC_BP[1]) return 2;
  if (a >= NGUONG_NAC_BP[0]) return 1;
  return 0;
}

/** D398 — SỐ MŨI TÊN theo nấc: nấc 1 = 1 (nhẹ) · nấc 2–3 = 2 (mạnh) · nấc 0 = 0 (hiện "=" đứng giá). */
export function soMuiTen(nac: 0 | 1 | 2 | 3): 0 | 1 | 2 {
  return nac >= 2 ? 2 : nac === 1 ? 1 : 0;
}

/**
 * CHIỀU CHÍNH của vòng = dấu TRUNG VỊ sáu delta (cùng thước với `cho_bp` của
 * engine — chợ đổi bao nhiêu); hoà thì dấu tổng. 0 = không có chiều (mọi mũi
 * tên hiện cùng nhịp). Nhóm ngược chiều chính hiện mũi tên NHỊP THỨ HAI: đó là
 * cách duy nhất "trú ẩn ngược dòng" hiện ra mà không cần một chữ.
 */
export function chieuChinh(deltas: readonly number[]): -1 | 0 | 1 {
  if (deltas.length === 0) return 0;
  const sx = [...deltas].sort((a, b) => a - b);
  const n = sx.length;
  const tv = n % 2 ? sx[(n - 1) / 2]! : (sx[n / 2 - 1]! + sx[n / 2]!) / 2;
  const dau = tv > 0 ? 1 : tv < 0 ? -1 : 0;
  if (dau !== 0) return dau;
  const tong = deltas.reduce((a, b) => a + b, 0);
  return tong > 0 ? 1 : tong < 0 ? -1 : 0;
}

export function DaiThiTruong({ la, thiTruong, keo, vong, nhich, thanhKhoan, coThuoc }: DaiThiTruongProps) {
  const delta = new Map((thiTruong ?? []).map((x) => [x.ma, x.delta_bp] as const));
  const tkCua = new Map((thanhKhoan ?? []).map((x) => [x.ma, x] as const));
  const coKq = thiTruong !== undefined && thiTruong.length > 0;
  const chinh = coKq ? chieuChinh([...delta.values()]) : 0;
  const dong = coKq && nhich;
  return (
    <div
      className={s.dai}
      data-tap="thi-truong"
      role="group"
      aria-label="Thị trường vòng"
      style={keo?.mau ? ({ '--keo-mau': keo.mau } as CSSProperties) : undefined}
    >
      <span
        className={`${s.keo} ${dong && keo ? s.keoSang : ''}`}
        title={keo ? `Cái kéo: ${keo.ten}` : undefined}
        aria-label={keo ? `Cái kéo: ${keo.ten}` : 'Chưa có cái kéo'}
        role="img"
      >
        {keo?.icon ? <PixelIcon name={keo.icon} size={16} /> : <i className={s.keoTrong} aria-hidden />}
      </span>
      {la.map((x) => {
        const d = coKq ? (delta.get(x.id) ?? 0) : 0;
        const chieu = d > 0 ? 1 : d < 0 ? -1 : 0;
        const nac = dong ? nacCua(d) : 0;
        const soMui = soMuiTen(nac);
        const nhipSau = dong && nac > 0 && chinh !== 0 && chieu !== chinh;
        // D398 — dưới nấc 1 là "không ảnh hưởng nhiều": không màu chiều, chỉ dấu "=".
        const chieuHien = nac > 0 ? chieu : 0;
        return (
          <span
            key={`${vong}-${x.id}`}
            className={[
              s.la,
              x.chipDay > 0 ? s.cam : '',
              nac > 0 ? s.dong : '',
              nac >= 2 ? s[`nac${nac}` as keyof typeof s] ?? '' : '',
              // 12/09 — CHIỀU đi bằng MÀU PHỦ LÊN CHÍNH LÁ (founder: *"cho mặt nạ
              // xanh/đỏ cho asset đó"*); D398 — chỉ từ nấc 1, dưới đó là đứng giá.
              dong && chieuHien > 0 ? s.len : '',
              dong && chieuHien < 0 ? s.xuong : '',
            ].filter(Boolean).join(' ')}
            data-ma={x.id}
            data-nac={nac}
            data-chieu={dong ? chieu : 0}
            title={x.ten}
          >
            {/* eslint-disable-next-line react/no-danger -- SVG hằng số trong repo, xem GameCard */}
            <span className={s.hinh} dangerouslySetInnerHTML={htmlTinh(x.svg ?? '')} />
            {/*
              ⭐ 13/09 — HUY HIỆU CHIỀU quay lại, lần này là ICON PIXEL.
              12/09 founder bảo bỏ tam giác dưới lá và mã hoá chiều bằng mặt nạ màu;
              bấm thử xong thì bác chính cái đó: *"hiệu ứng tương quan của 6 lá m làm
              chán quá, thôi thêm vào icon tăng/giảm biểu thị đi"*. Nên mặt nạ Ở LẠI
              (nó chở ĐỘ MẠNH theo nấc), icon THÊM VÀO để chở CHIỀU — hai kênh khác
              nhau trên cùng một vật, không phải hai bản sao của một tin.
              ⚠ Chỉ hiện SAU CHỐT: trước quyết định dải phải câm (HOP-MOAT M.2), một
              mũi tên lúc đó là lời khuyên chứ không phải mô tả.
              D398 — ĐỘ MẠNH = SỐ MŨI TÊN, lá thôi nhích (founder 24/09: "cứ lên xuống rối
              mắt quá"): 1 nhẹ · 2 mạnh · "=" đứng giá (dưới nấc 1).
            */}
            {dong && (soMui > 0 ? (
              <span
                className={`${s.dauChieu} ${nhipSau ? s.dauSau : ''}`}
                role="img"
                aria-label={`${x.ten} ${chieu > 0 ? 'tăng' : 'giảm'} ${soMui === 2 ? 'mạnh' : 'nhẹ'}`}
                data-so-mui={soMui}
              >
                {Array.from({ length: soMui }, (_, k) => (
                  <PixelIcon key={k} name={chieu > 0 ? 'mui_len' : 'mui_xuong'} size={8} />
                ))}
              </span>
            ) : (
              <span
                className={`${s.dauChieu} ${s.dauDung}`}
                role="img"
                aria-label={`${x.ten} gần như đứng giá`}
                data-so-mui={0}
              >
                =
              </span>
            ))}
            <span className={s.ten}>{x.ten}</span>
            {/*
              ⭐ D395 — THƯỚC THANH KHOẢN (founder 24/09: *"co dãn theo thẻ sự kiện đang được lật"*).
              Chỉ có mặt khi vòng vừa chốt mang `thanh_khoan_vong` — tức trong nhịp kết quả; trước quyết
              định dải vẫn câm (M.2). Vạch là VẬT ⇒ `steps()`; nhịp thở của mã sương mù là ÁNH SÁNG ⇒ ease-in-out.
              Chữ chỉ ở aria/tooltip — trên mặt dải là hình (luật của khối này).
            */}
            {(() => {
              const tk = tkCua.get(x.id);
              /*
               * ⚠ Trận CÓ thước mà chưa có dữ liệu (trước chốt) ⇒ vẫn GIỮ CHỖ hàng thước, trống trơn. Đo trên màn
               * thật D395: thước mọc sau chốt làm dải 61 → 67px ⇒ mọi khối bên dưới tụt 6px đúng nhịp kết quả, rồi
               * nhảy ngược lại khi sang vòng. Giữ chỗ thì dải chỉ có một chiều cao; ô trống ⇒ trước chốt vẫn câm (M.2).
               * Trận không có thước (v53 · v45) ⇒ không giữ chỗ: dải y hệt trước D395.
               */
              if (!tk) return coThuoc ? <span className={s.thuoc} aria-hidden data-cho-thuoc="" /> : null;
              const vach = vachThuoc(tk, dong);
              const nhan = !dong
                ? `Thanh khoản ${x.ten}: nền ${tk.vach_nen}/${tk.tong_vach} vạch`
                : tk.vach !== null
                  ? `Thanh khoản ${x.ten} vòng này: ${tk.vach}/${tk.tong_vach} vạch (nền ${tk.vach_nen})`
                  : `Thanh khoản ${x.ten} vòng này: không đọc được — mã đầu cơ (nền ${tk.vach_nen}/${tk.tong_vach})`;
              return (
                <span className={s.thuoc} role="img" aria-label={nhan} title={nhan} data-thuoc={vach.join(',')}>
                  {vach.map((v, i) => <i key={i} className={`${s.vach} ${s[v] ?? ''}`} />)}
                </span>
              );
            })()}
            {/* Hàng chân CHỈ còn cọc chip, và chỉ mọc khi có chip — lá không cầm
                không tốn một pixel chiều cao nào. */}
            {x.chipDay > 0 && (
              <span className={s.chan} aria-hidden>
                <span className={s.coc}>
                  {Array.from({ length: Math.min(4, x.chipDay) }, (_, i) => (
                    <i key={i} className={s.chip} />
                  ))}
                </span>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
