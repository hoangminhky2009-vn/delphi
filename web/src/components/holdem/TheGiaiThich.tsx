/**
 * TỜ GIẢI THÍCH LÁ BÀI — mở bằng nút (!) ở góc thẻ.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Founder 25/07 (lần 1): "đừng cho chú thích ngay trên thẻ bài, hãy cho 1 dấu !
 * hình tròn ở góc của thẻ và khi bấm vào thì mới mở phần giải thích. Thẻ bài
 * thuần chỉ có tên và hình ảnh."
 *
 * Founder 25/07 (lần 2, bác bản đầu của tôi): "dấu (!) không phải chỉ ra cụ thể
 * đặc tính từng loại tài sản hay chiến thuật mà chỉ là mô tả khái quát đặc điểm
 * và tác dụng của nó và cách nó phản ứng với từng giai đoạn thị trường (cho hiện
 * thị hết ra rõ ràng +/- bao nhiêu % thì game sẽ bị dễ đoán và nhanh chán)."
 *
 * Bản đầu của tôi in bảng "+9,0% / −6,0%" cho từng ô ma trận — tức biến trò chơi
 * thành bài toán TRA BẢNG. Người chơi mở (!), cộng nhẩm, và không còn gì để đọc
 * thị trường nữa; mà đọc thị trường là thứ duy nhất mode này muốn đo (A1).
 *
 * Nay tờ này chỉ nói:
 *   · một đoạn mô tả khái quát đặc điểm + tác dụng;
 *   · phản ứng theo từng giai đoạn ở dạng MỨC (rất khoẻ → rất yếu);
 *   · hình dạng rủi ro của thẻ chiến thuật, không kèm con số.
 *
 * Con số đã bị cắt ở TẦNG SERVER (server/holdem/tu_dien.ts) — không phải ở đây.
 * Cắt ở tầng render thì F12 vẫn có bảng tra, tức người chịu khó vẫn có lợi thế
 * còn người thường thì không: tệ hơn cả việc hiện cho mọi người.
 */
import { useEffect, useRef } from 'react';
import type {
  MucDinhTinhDTO, NhanDTO, TuDienChienThuatDTO, TuDienTaiSanDTO,
} from '@/api/holdem';
import { MUC_DINH_TINH } from '@/lib/muc_dinh_tinh';
import { LOI_CHI_TRONG_MAN_CHU, LOI_NUT_MAN } from '@/lib/khung_minigame';
import type { ChienThuatId } from '@config/holdem';
import s from './TheGiaiThich.module.css';

/** Mức → chữ + ký hiệu + lớp màu — một bảng chung với bách khoa (D334, `lib/muc_dinh_tinh.ts`). */
const MUC: Record<MucDinhTinhDTO, { chu: string; dau: string; lop: string }> = MUC_DINH_TINH;

/**
 * Nhãn giai đoạn / sự kiện — CHỈ chữ.
 *
 * `NhanDTO.icon` do server cấp là emoji (config/holdem.ts), tức hình do font hệ
 * điều hành vẽ: cùng ký tự ra đơn sắc trên Windows và ra MÀU trên iPhone (luật 4
 * ở styles/pixel.module.css). Tờ này là bảng tra dày đặc dòng — mỗi dòng lệch
 * chiều cao một chút vì hình khác cỡ là cả bảng so le. Nhãn chữ đứng ngay đó nên
 * bỏ hình không mất thông tin nào.
 */
function nhanCua(ds: NhanDTO[], id: string): string {
  return ds.find((n) => n.id === id)?.label ?? id;
}

/**
 * Một hàng "nhãn ··· mức". Không có con số nào ở đây, và đó là chủ ý.
 *
 * ⚠ CHỊU ĐƯỢC MỨC LẠ, KHÔNG ĐƯỢC SẬP. Bản trước viết `MUC[muc].lop` thẳng, nên
 * một giá trị ngoài thang 5 bậc là `undefined.lop` → ném lỗi → ErrorBoundary của
 * router ăn trọn, và NGƯỜI CHƠI MẤT CẢ BÀN ĐẤU đang chơi giữa trận.
 *
 * Không phải giả định: gặp thật 25/07/2026 trên stack local, khi frontend đã có
 * tờ từ điển mà API chưa gửi `tu_dien`. Và trong dự án này lệch phiên bản là
 * chuyện BÌNH THƯỜNG chứ không phải sự cố — frontend deploy lên Cloudflare bằng
 * `wrangler deploy`, API lên Vercel bằng `npm run deploy`, HAI LỆNH RIÊNG. Giữa
 * hai lệnh đó luôn có một quãng frontend mới gặp API cũ; nếu một lệnh trượt thì
 * quãng đó là vĩnh viễn.
 *
 * Nguyên tắc: tờ giải thích là thông tin PHỤ. Nó thiếu dữ liệu thì bỏ trống một
 * dòng, tuyệt đối không được kéo theo thứ đang chơi.
 */
function Hang({ ten, muc }: { ten: string; muc: MucDinhTinhDTO }) {
  const m = MUC[muc];
  if (!m) return null;
  return (
    <div className={s.hang}>
      <span>{ten}</span>
      <b className={s[m.lop]}>{m.dau} {m.chu}</b>
    </div>
  );
}

/**
 * Cặp `[id, mức]` hợp lệ mới được vẽ.
 *
 * Cùng lý do như `Hang`: API cũ (hoặc bản sau này đổi hình dạng) có thể gửi mảng
 * không phải cặp, và `.map(([id, muc]) => …)` trên phần tử không-mảng là ném lỗi
 * ngay tại chỗ render.
 */
function locCap(ds: unknown): [string, MucDinhTinhDTO][] {
  if (!Array.isArray(ds)) return [];
  return ds.filter((p): p is [string, MucDinhTinhDTO] =>
    Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && !!MUC[p[1] as MucDinhTinhDTO]);
}

export function TheGiaiThich({
  ten, moTa, taiSan, chienThuat, tenChienThuat, giaiDoan, suKien, onDong, lay, idThe,
}: {
  ten: string;
  /** D530 — id lá chiến thuật: tờ `trong_man` tra hàng nút của chính lõi này (`LOI_NUT_MAN`). */
  idThe?: string;
  /*
   * Không còn prop `icon`. Nó vốn nhận emoji từ catalog, và không nơi gọi nào
   * truyền — tức nó chỉ đang chèn một dấu cách thừa trước tên thẻ. Bỏ hẳn thay
   * vì để đó: còn khai là còn có người điền emoji vào (luật 4 cấm).
   */
  /** Mô tả một câu của thẻ chiến thuật (catalog đã có sẵn `mo_ta`). */
  moTa?: string;
  taiSan?: TuDienTaiSanDTO;
  chienThuat?: TuDienChienThuatDTO;
  /** Tra id chiến thuật → tên hiển thị (cho xung đột / cộng hưởng). */
  tenChienThuat: (id: string) => string;
  giaiDoan: NhanDTO[];
  suKien: NhanDTO[];
  onDong: () => void;
  /**
   * D526 (founder 05/10: *"bỏ chỗ 'mua' của lõi, thay vào đó bấm vào lõi sẽ hiện tương tự như trait, hiện chú thích, lấy hoặc ko
   * lấy"*) — tờ mở từ MÀN CHỌN của shop thành bảng xác nhận như tấm trait: chân tấm ĐÓNG (không lấy) + LẤY. `trangThai`: `lay` = còn
   * lấy được · `da_lay` = chính lá này đã lấy · `het` = vòng này đã lấy lá khác. Vắng ⇒ tờ chỉ để đọc như cũ.
   */
  lay?: { trangThai: 'lay' | 'da_lay' | 'het'; onLay: () => void };
}) {
  const nutDong = useRef<HTMLButtonElement>(null);

  // Esc để đóng + đưa focus vào nút đóng: tờ này là lớp phủ, mở ra mà bàn phím
  // vẫn ở dưới là bẫy focus.
  useEffect(() => {
    nutDong.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDong(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDong]);

  const gd = (id: string) => nhanCua(giaiDoan, id);
  const sk = (id: string) => nhanCua(suKien, id);

  return (
    <div className={s.lop} role="dialog" aria-modal="true" aria-label={`Giải thích ${ten}`}>
      <div className={s.tam}>
        <header className={s.dau}>
          <span className={s.ten}>{ten}</span>
          <button ref={nutDong} type="button" className={s.dong} onClick={onDong} aria-label="Đóng">
            ✕
          </button>
        </header>

        {(taiSan?.mo_ta || moTa) && <p className={s.moTa}>{taiSan?.mo_ta ?? moTa}</p>}

        {/* ── TÀI SẢN ─────────────────────────────────────────────── */}
        {taiSan && (
          <>
            <div className={s.nhom}>PHẢN ỨNG THEO GIAI ĐOẠN THỊ TRƯỜNG</div>
            {locCap(taiSan.giai_doan).length === 0 ? (
              <p className={s.trong}>Không đổi theo giai đoạn.</p>
            ) : (
              locCap(taiSan.giai_doan).map(([id, muc]) => <Hang key={id} ten={gd(id)} muc={muc} />)
            )}

            {locCap(taiSan.su_kien).length > 0 && (
              <>
                <div className={s.nhom}>KHI CÓ TIN LỚN</div>
                {locCap(taiSan.su_kien).map(([id, muc]) => <Hang key={id} ten={sk(id)} muc={muc} />)}
                {/*
                  ⚠ ĐUÔI KHÔNG PHẢI TRUNG BÌNH (founder chốt A, 28/07): vài mã
                  "tốt" trong khủng hoảng thanh khoản NHƯNG bị đám đông kéo sập
                  ở đuôi xấu (β D39). Giữ số, thêm chữ — dòng này là phần chữ,
                  server suy từ config nên đổi ma trận là nó tự theo.
                */}
                {taiSan.luu_y && <p className={s.canhBaoDuoi}>⚠ {taiSan.luu_y}</p>}
              </>
            )}

            <p className={s.ghiChu}>
              Cầm nhiều bản sao cùng mã thì hiệu ứng mạnh lên, nhưng mỗi lá thêm
              vào đóng góp ít hơn lá trước.
            </p>
          </>
        )}

        {/* ── CHIẾN THUẬT ─────────────────────────────────────────── */}
        {chienThuat && (
          <>
            {/*
              ĐẶC QUYỀN ĐỨNG ĐẦU, trước mọi mục khác — founder 27/07: tờ này phải
              "mô tả rõ thứ người chơi sẽ nhận được khi chọn chiến thuật này".

              Từ D33, thẻ chiến thuật LÀ đặc quyền chứ không còn là con số cộng
              thêm, nên đây là lý do duy nhất để chọn một lá. Xung đột · cộng
              hưởng · canh nhịp là chi tiết phụ và phải nằm dưới. Trước bản này
              tờ (!) có đủ phần phụ mà thiếu đúng phần chính.
            */}
            {/* D530 — khoá v60: lõi chỉ tác động trong màn ⇒ tờ nói đúng một điều đó + hàng nút; mọi khối cũ vắng (server không gửi). */}
            {chienThuat.trong_man && (
              <>
                <div className={s.nhom}>TRONG MÀN LÕI</div>
                <p className={s.manh}>{LOI_CHI_TRONG_MAN_CHU}</p>
                {idThe && LOI_NUT_MAN[idThe as ChienThuatId] && <p className={s.trong}>Trong màn: {LOI_NUT_MAN[idThe as ChienThuatId]}.</p>}
              </>
            )}

            {(chienThuat.dac_quyen ?? []).length > 0 && (
              <>
                <div className={s.nhom}>ĐẶC QUYỀN — thứ bạn nhận được</div>
                {(chienThuat.dac_quyen ?? []).map((d) => (
                  <p key={d} className={s.manh}>{d}</p>
                ))}
              </>
            )}

            {chienThuat.nhan_doi && (
              <p className={s.manh}>Nhân ĐÔI lãi/lỗ của vòng — cả hai chiều.</p>
            )}

            {chienThuat.canh_nhip && (
              <>
                <div className={s.nhom}>CANH NHỊP</div>
                <p className={s.trong}>
                  Chỉ tính sau giai đoạn {gd(chienThuat.canh_nhip.sau_giai_doan)}. Ăn khi
                  thị trường quay sang{' '}
                  {chienThuat.canh_nhip.trung_khi.map(gd).join(' hoặc ')}.
                  {chienThuat.canh_nhip.truot_nang_hon
                    && ' Bắt trượt thì trả giá nặng hơn phần ăn được khi bắt trúng.'}
                </p>
              </>
            )}

            {chienThuat.phong_thu && (
              <>
                <div className={s.nhom}>PHÒNG THỦ</div>
                <p className={s.trong}>
                  Che được đòn khi {chienThuat.phong_thu.an_khi.map(gd).join(' / ')}, nhưng
                  tốn phí giữ khi {chienThuat.phong_thu.phi_khi.map(gd).join(' / ')}.
                </p>
              </>
            )}

            {chienThuat.da_dang && (
              <>
                <div className={s.nhom}>ĐA DẠNG HÓA</div>
                <p className={s.trong}>
                  Thưởng theo số mã KHÁC NHAU đang nắm, trừ một khoản phí cố định — nên
                  dàn mỏng chỉ có lãi khi đủ nhiều mã.
                </p>
              </>
            )}

            {locCap(chienThuat.su_kien).length > 0 && (
              <>
                <div className={s.nhom}>PHẢN ỨNG VỚI TIN</div>
                {locCap(chienThuat.su_kien).map(([id, muc]) => (
                  <Hang key={id} ten={sk(id)} muc={muc} />
                ))}
              </>
            )}

            {(chienThuat.xung_dot ?? []).length > 0 && (
              <>
                <div className={s.nhom}>XUNG ĐỘT — cầm cùng thì bị trừ</div>
                <p className={s.trong}>{(chienThuat.xung_dot ?? []).map(tenChienThuat).join(' · ')}</p>
              </>
            )}

            {(chienThuat.cong_huong ?? []).length > 0 && (
              <>
                <div className={s.nhom}>CỘNG HƯỞNG — cầm cùng thì được thêm</div>
                <p className={s.trong}>{(chienThuat.cong_huong ?? []).map(tenChienThuat).join(' · ')}</p>
              </>
            )}

            {(chienThuat.dac_quyen ?? []).length === 0 && !chienThuat.trong_man
              && !chienThuat.nhan_doi && !chienThuat.canh_nhip && !chienThuat.phong_thu
              && !chienThuat.da_dang && !chienThuat.su_kien
              && (chienThuat.xung_dot ?? []).length === 0
              && (chienThuat.cong_huong ?? []).length === 0 && (
              <p className={s.trong}>Thẻ này chưa có cơ chế riêng nào.</p>
            )}
          </>
        )}

        {lay && (
          <div className={s.chanLay} data-tap="chan-lay-loi">
            <button type="button" className={s.nutKhongLay} onClick={onDong} data-tap="khong-lay-loi">ĐÓNG</button>
            <button
              type="button"
              className={s.nutLay}
              data-tap="lay-loi"
              disabled={lay.trangThai !== 'lay'}
              onClick={lay.onLay}
            >
              {lay.trangThai === 'lay' ? 'LẤY LÕI NÀY' : lay.trangThai === 'da_lay' ? 'ĐÃ LẤY ✓' : 'ĐÃ LẤY LÕI KHÁC'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
