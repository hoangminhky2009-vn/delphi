/**
 * NGÂN HÀNG — sổ tiết kiệm, cần gạt vốn thứ ba (v43, D314/D317).
 *
 * Khoá một phần tiền mặt N ô lấy lãi cố định cao hơn coupon trái phiếu. Huỷ
 * trước hạn: gốc về ví, LÃI TREO MẤT SẠCH.
 *
 * ⚠ Ô này THAY CHỖ **KHOÁ NẮM GIỮ** trên bàn — v43 khai tử cơ chế đó
 * (`khoaTaiSanTat`). Hai thứ không bao giờ cùng sống, và đó là chủ ý: cả hai đều
 * là "hứa giữ nguyên để đổi lấy một khoản thưởng", nên để cả hai là bắt người
 * chơi học hai luật cho một ý niệm.
 *
 * ─── BỐ CỤC: MỘT KHUNG HÌNH ────────────────────────────────────────────────
 * Founder 09/09: *"cồng kềnh quá, làm cho nó gọn lại trong 1 khung hình nhưng
 * vẫn đủ chức năng, cái nào ko phải nút bấm hoặc nội dung ko quan trọng thì làm
 * cơ chế tiết lộ khi tương tác."* Nên: một sổ = MỘT dòng (chi tiết + nút HUỶ sau
 * cú bấm) · ba viên kỳ hạn một hàng · thanh trượt và kết quả cùng dòng · mọi lời
 * giải thích gộp sau một dòng `ⓘ`. Giữ nguyên mọi NÚT và lãi từng mốc — lãi là
 * thứ để SO, giấu nó đi là giấu chính thứ cần để chọn.
 *
 * ─── BA THỨ FILE NÀY TUYỆT ĐỐI KHÔNG LÀM ───────────────────────────────────
 *  1. KHÔNG TÍNH LÃI. `lai_bp` từng mốc do server báo (`tiet_kiem_bao_gia`).
 *     Gõ lại công thức ở đây là nguồn chân lý thứ hai, và biểu hiện khi nó lệch
 *     là màn niêm yết một đằng, engine chốt hợp đồng một nẻo (C4/D61).
 *  2. KHÔNG TỰ SUY "gửi được hay không". `tiet_kiem_duoc` gộp cả ba điều kiện,
 *     trong đó vế "còn mốc nào KỊP đáo hạn" tắt dần về cuối bàn.
 *  3. KHÔNG tự viết một phép nhân tiền nào. Gốc = `tienTuMoc` (chính hàm
 *     `apMoTietKiem` gọi); lãi mỗi ô = `laiMoiO` (chính hàm `chotPhien` cộng).
 *     `laiMoiO` được rút thành hàm riêng CHÍNH VÌ màn này: niêm yết 42 mà sổ
 *     cộng 41 là loại lỗi tiền người chơi không tha.
 *
 * ─── ĐƠN VỊ: % , KHÔNG PHẢI ‱ ──────────────────────────────────────────────
 * ⚠⚠ Bản đầu in thẳng `+275‱/ô` và founder đọc ra **"lãi 275%, điên à"** trong
 * hai giây. Đúng — `‱` (phần vạn) không xuất hiện ở BẤT KỲ màn nào khác của
 * app; mọi chỗ khác đổi bp → % bằng `pctBp`. Một đơn vị chỉ sống ở một màn là
 * một đơn vị người chơi chưa từng học, và họ sẽ đọc nó bằng ký hiệu gần nhất
 * mà họ biết. Dùng `pctBp` — cùng hàm với cả game.
 *
 * ─── VÌ SAO LÀ "CHỌN", KHÔNG PHẢI POST NGAY ────────────────────────────────
 * Lệnh chạy ở nhịp 1 và đi kèm `POST /rounds`. Một POST riêng đẻ thêm một dòng
 * `action_log`, mà log LÀ nguồn dựng lại trận.
 *
 * Bám demo đã chốt: `docs/ui-ux/demo/ngan-hang-so-tiet-kiem.html` (A11.25).
 */
import { useState } from 'react';
import { PixelIcon } from '@/components/ui';
import { laiMoiO } from '@config/holdem';
import { tienTuMoc } from '@server/holdem/nav';
import { pctBp } from '@/api/holdem';
import { T_NGAN_HANG_UPPER, T_SO_TIET_KIEM_UPPER } from '@/lib/vocab';
import type { TrangThaiDTO } from '@/api/holdem';
import s from './NganHang.module.css';

type Ban = TrangThaiDTO['ban'];
export type HopDongDTO = NonNullable<Ban['tiet_kiem']>[number];
export type BaoGiaDTO = NonNullable<Ban['tiet_kiem_bao_gia']>[number];

/** Lệnh gửi đang chọn — cùng hình dạng với `NopVongInput.tiet_kiem.mo`. */
export interface LenhMoTietKiem {
  moc_bp: number;
  so_vong: number;
}

export interface NganHangProps {
  /** Tiền mặt tự do của ghế — mẫu số của mốc %. */
  tienMat: number;
  /** D447 — `tienMat` là tiền mặt SAU các lệnh đang xếp (server gửi tiết kiệm sau chuỗi lệnh lúc CHỐT). */
  sauLenh?: boolean;
  /** Sổ đang mở (server gửi, đã kèm `con_vong`). */
  hopDong: readonly HopDongDTO[];
  /** Mốc kỳ hạn còn KỊP đáo hạn + lãi báo vòng này. Rỗng ⇒ hết cửa gửi. */
  baoGia: readonly BaoGiaDTO[];
  /** Server suy đủ ba điều kiện — client KHÔNG suy lại. */
  guiDuoc: boolean;
  /** Gốc tối thiểu một hợp đồng (server gửi qua catalog). */
  gocToiThieu: number;
  /** Bước mốc, bp (`BUOC_MOC_BP` = 500 ⇒ 5%). */
  buocMocBp: number;
  /** Lệnh mở đang chọn (null = chưa chọn gì). */
  chonMo: LenhMoTietKiem | null;
  /** Id các hợp đồng đang chọn huỷ. */
  chonHuy: readonly string[];
  onChonMo: (l: LenhMoTietKiem | null) => void;
  onChonHuy: (ids: string[]) => void;
  /** Vì sao lệnh vòng trước bị từ chối (mã lỗi engine đã dịch). */
  loi?: string | null;
  /**
   * v54 (D405) — luật sổ của trận (server `tiet_kiem_kinh_te`). VẮNG ⇒ sổ cổ điển, giữ nguyên bốn câu cũ. Có ⇒ câu
   * lãi / lạm phát đổi theo cờ, thêm câu đổ vỡ với số của server. Không có cờ thì không câu nào đổi (trận v53 prod).
   */
  kinhTe?: TrangThaiDTO['tiet_kiem_kinh_te'];
}

const so = (n: number) => n.toLocaleString('vi-VN');

export function NganHang({
  tienMat, sauLenh, hopDong, baoGia, guiDuoc, gocToiThieu, buocMocBp,
  chonMo, chonHuy, onChonMo, onChonHuy, loi, kinhTe,
}: NganHangProps) {
  /* Cổng huỷ: id đang HỎI, chưa phải id đã chọn. Hai thứ khác nhau — chọn là
     thứ đi kèm cú nộp vòng, hỏi chỉ sống trong màn hình. */
  const [hoiHuy, setHoiHuy] = useState<string | null>(null);
  /** Sổ đang mở chi tiết (tiết lộ khi tương tác). */
  const [moSo, setMoSo] = useState<string | null>(null);
  /** Khối giải thích đang mở. */
  const [moLo, setMoLo] = useState(false);
  const [moc, setMoc] = useState(2_500);

  const kyHan = chonMo?.so_vong ?? baoGia[0]?.so_vong ?? null;
  const bg = baoGia.find((b) => b.so_vong === kyHan) ?? null;
  const goc = tienTuMoc(moc, tienMat);
  const duGoc = goc >= gocToiThieu;

  /*
   * THU GỌN KHI KHÔNG CÓ VIỆC — cùng nguyên tắc QuanTriVon: giá của một nước đi
   * chỉ đáng chỗ trên màn hình khi nước đi đó bấm được. Nhưng KHÔNG biến mất
   * hẳn: một dòng nói vì sao, nếu không thì lần nó hiện ra sẽ như một thứ lạ.
   */
  if (!guiDuoc && hopDong.length === 0) {
    return (
      <div className={s.hop}>
        <div className={s.tat}>
          {T_NGAN_HANG_UPPER}
          {' — '}
          {baoGia.length === 0
            ? 'không kỳ hạn nào kịp đáo hạn trước khi trận kết thúc.'
            : 'vòng này chưa gửi được.'}
        </div>
      </div>
    );
  }

  const doiHuy = (id: string) => {
    onChonHuy(chonHuy.includes(id) ? chonHuy.filter((x) => x !== id) : [...chonHuy, id]);
    setHoiHuy(null);
  };

  return (
    /*
     * ⚠ `data-tap` LÀ NEO CỦA MÀN TẬP, không phải thuộc tính trang trí — trợ lý
     * `CoachTap` khoét lỗ spotlight theo đúng chuỗi này. Đổi/xoá nó là làm bước
     * dạy ngân hàng rọi vào chỗ trống, và `web/tests/coach_ban_tap.test.ts`
     * mục III sẽ đỏ ngay (đó là việc của nó).
     */
    <div className={s.hop} data-tap="ngan-hang">
      <div className={s.tieu}>
        <PixelIcon name="vault" size={16} />
        {T_NGAN_HANG_UPPER}
        <span className={s.von}>{sauLenh ? 'tiền mặt sau lệnh' : 'tiền mặt'} <b>{so(tienMat)}</b></span>
      </div>

      {/* ── Mỗi sổ MỘT dòng; chi tiết + nút HUỶ sau cú bấm ── */}
      {hopDong.map((h) => {
        if (hoiHuy === h.id) {
          return (
            <div className={s.cong} key={h.id} role="alertdialog">
              <div className={s.congTieu}>
                ⚠ HUỶ {T_SO_TIET_KIEM_UPPER} {h.so_vong} Ô — MẤT TOÀN BỘ LÃI TREO
              </div>
              <div className={s.congChu}>
                Lấy lại <b style={{ color: 'var(--text-body)' }}>{so(h.goc)}</b> gốc,
                {' '}mất <b>{so(h.lai_don)}</b> lãi đã tích.
              </div>
              <div className={s.congNut}>
                <button type="button" className={s.nutDo} onClick={() => doiHuy(h.id)}>
                  HUỶ THẬT
                </button>
                <button type="button" className={s.nutNhat} onClick={() => setHoiHuy(null)}>
                  THÔI
                </button>
              </div>
            </div>
          );
        }
        const daChon = chonHuy.includes(h.id);
        const chot = h.con_vong <= 0;
        return (
          <div className={s.so} key={h.id}>
            <button
              type="button"
              className={s.soDong}
              aria-expanded={moSo === h.id}
              onClick={() => setMoSo(moSo === h.id ? null : h.id)}
            >
              <span className={s.soTen}>{T_SO_TIET_KIEM_UPPER} {h.so_vong}Ô</span>
              <span className={s.soGoc}>{so(h.goc)}</span>
              <span className={s.soLai}>+{so(h.lai_don)}</span>
              <span className={`${s.soCon} ${chot ? s.soChot : ''}`}>
                {chot ? 'ĐÁO HẠN' : `còn ${h.con_vong}v`}
              </span>
            </button>
            {moSo === h.id && (
              <div className={s.soMo}>
                <span>lãi <b>{pctBp(h.lai_bp)}/ô</b> · mở vòng {h.vong_mo}</span>
                {daChon ? (
                  <button
                    type="button"
                    className={s.nutNhat}
                    style={{ marginLeft: 'auto' }}
                    onClick={() => doiHuy(h.id)}
                  >
                    BỎ CHỌN HUỶ
                  </button>
                ) : (
                  <button
                    type="button"
                    className={s.nutDo}
                    style={{ marginLeft: 'auto' }}
                    onClick={() => setHoiHuy(h.id)}
                  >
                    HUỶ SỚM
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Ba viên kỳ hạn một hàng; lãi HIỆN vì đó là thứ để so ── */}
      {guiDuoc && bg && (
        <>
          {/* Neo riêng cho hàng kỳ hạn: bước dạy "kỳ dài lãi cao hơn" phải rọi
              vào ĐÚNG ba viên, không rọi cả panel — lỗ khoét bằng cả panel thì
              câu ấy không chỉ vào cái gì cụ thể. */}
          <div className={s.hang} data-tap="ngan-hang-ky">
            {baoGia.map((b) => (
              <button
                type="button"
                key={b.so_vong}
                aria-pressed={b.so_vong === kyHan}
                className={`${s.vien} ${b.so_vong === kyHan ? s.vienChon : ''}`}
                onClick={() => onChonMo({ moc_bp: moc, so_vong: b.so_vong })}
              >
                {b.so_vong}Ô <span className={s.rate}>{pctBp(b.lai_bp)}</span>
              </button>
            ))}
          </div>

          <div className={s.mot}>
            <input
              className={s.thanh}
              type="range"
              min={buocMocBp}
              max={10_000}
              step={buocMocBp}
              value={moc}
              aria-label="Phần tiền mặt đem gửi"
              onChange={(e) => {
                const m = Number(e.target.value);
                setMoc(m);
                if (chonMo) onChonMo({ ...chonMo, moc_bp: m });
              }}
            />
            <span className={s.ket}>
              {moc / 100}% → <b>{so(goc)}</b> · <i>+{so(laiMoiO(goc, bg.lai_bp))}/ô</i>
            </span>
          </div>

          {!duGoc && (
            <div className={s.canh}>Gốc tối thiểu {so(gocToiThieu)} chip — kéo lên.</div>
          )}

          <button
            type="button"
            className={s.nutChinh}
            /*
             * ⚠ CHỈ khoá khi CHƯA chọn. Khoá cả lúc đã chọn là một cái bẫy: người
             * chơi chọn gửi, rồi mua thêm một mã làm tiền mặt tụt dưới gốc tối
             * thiểu — và bây giờ không BỎ CHỌN được nữa, trong khi lệnh vẫn sẽ đi
             * kèm cú nộp vòng. Đường LÙI không bao giờ được khoá theo cùng điều
             * kiện với đường TIẾN.
             */
            disabled={!duGoc && !chonMo}
            onClick={() => onChonMo(chonMo ? null : { moc_bp: moc, so_vong: kyHan! })}
          >
            {chonMo ? 'BỎ CHỌN GỬI' : `GỬI ${kyHan} Ô · CHỜ CHỐT VÒNG`}
          </button>

          {/*
            * TIẾT LỘ KHI TƯƠNG TÁC — bốn câu này đều đúng và đều đáng biết, nhưng
            * không câu nào cần đọc LẠI mỗi vòng. Dòng thu gọn giữ đúng vế đắt nhất
            * ("huỷ sớm mất hết lãi") để người chưa bấm vẫn thấy cái giá.
            */}
          {moLo ? (
            <div className={s.loMo}>
              {kinhTe?.tha_noi
                ? <span data-luat-so="tha_noi">Lãi <b>thả nổi theo lãi suất nền</b> — mỗi ô tính lại, sau kỳ họp ⚖ cả sổ cũ đổi theo.</span>
                : <span>Lãi <b>chốt lúc gửi</b>, không đổi về sau — ô kỳ họp ⚖ đáng chờ.</span>}
              <span>Huỷ trước hạn: <b>mất toàn bộ lãi treo</b>, {kinhTe?.lam_phat ? 'gốc còn lại vẫn về ví.' : 'gốc vẫn về đủ.'}</span>
              {kinhTe?.lam_phat
                ? <span data-luat-so="lam_phat">Tiền trong sổ <b>cũng bị lạm phát ăn</b> như tiền mặt — lãi thấp hơn lạm phát là lỗ thật.</span>
                : <span>Tiền trong sổ <b>không bị lạm phát ăn</b> — nhưng vẫn bị đếm khi cháy.</span>}
              {kinhTe?.do_vo && (
                <span data-luat-so="do_vo">
                  Tin xấu dồn dập thì <b>ngân hàng có thể đổ vỡ</b>: phần gửi vượt {so(kinhTe.do_vo.bao_hiem_toi_da)} mất{' '}
                  {(kinhTe.do_vo.mat_bp / 100).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}%.
                </span>
              )}
              <span>Ngân hàng <b>đóng cửa về cuối bàn</b>: kỳ hạn nào không kịp đáo hạn thì
                không nhận.</span>
            </div>
          ) : (
            <button type="button" className={s.lo} onClick={() => setMoLo(true)}>
              ⓘ {kinhTe?.tha_noi ? 'lãi thả nổi' : 'lãi chốt lúc gửi'} · huỷ sớm mất hết lãi
            </button>
          )}
        </>
      )}

      {loi && <div className={s.canh}>Lệnh vòng trước bị từ chối: {loi}</div>}
    </div>
  );
}
