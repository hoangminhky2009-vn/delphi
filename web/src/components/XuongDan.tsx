/**
 * XƯỞNG DÁN NHÃN — UI đầu tiên của `/avatar/dan` (điểm mù #14: server sống từ
 * lâu, không một màn nào gọi). D36, ba luật cứng:
 *   · Dán TỰ DO TOÀN KHUNG (founder chốt B) — lưới 32×32, bấm đâu dán đó.
 *   · DÁN LÀ TIÊU VĨNH VIỄN — bắt buộc hộp xác nhận nói rõ không gỡ, không hoàn.
 *   · Đo NGẦN NGẠI (A7): đếm số lần dời chỗ + ms cân nhắc, gửi kèm cú dán.
 *
 * ⚠⚠ XEM TRƯỚC LÀ BẢN GHÉP THẬT (viết lại 12/08). Founder: *"m cho mỗi một cái
 * chấm đó thì t nhìn kiểu gì? Phải cho t thấy rõ nó trông như nào trước khi chốt
 * chứ?"* — đúng, và bản cũ tệ hơn vẻ ngoài của nó: người chơi chọn một nhãn CHỈ
 * THẤY TÊN CHỮ, đặt vào một ô vuông trống, rồi chốt VĨNH VIỄN. Làm tác phẩm mà
 * bịt mắt, trong khi D36 dựng cả cơ chế này để mỗi tấm thành MỘT TÁC PHẨM.
 *
 * Chú thích cũ khai lý do không ghép: *"bản ghép nháp sai là lời hứa sai trên
 * một thao tác không thu hồi được"*. Lo ngại ĐÚNG, kết luận NGƯỢC — câu trả lời
 * cho "bản nháp có thể sai" là làm cho nó ĐÚNG THEO CẤU TRÚC, không phải bỏ hẳn
 * xem trước; bỏ đi thì người ta chốt mù, tệ hơn hẳn.
 *
 * ⇒ Ghép bằng CHÍNH `vietDienMao` — bộ mã hoá server dùng để dựng chuỗi thật
 * (`dongBoDienMao`) — rồi vẽ bằng CHÍNH `<Avatar>`. Cùng bộ mã hoá, cùng bộ đọc,
 * cùng bộ vẽ, nên bản xem trước KHÔNG THỂ trôi khỏi bản thật. Đúng nếp
 * `xemTruocLenh` của D67: bản cài đặt thứ hai của một công thức sẽ trôi (D61), và
 * cú trôi ở đây biểu hiện là "xem một đằng, dán ra một nẻo" — trên một thao tác
 * không hoàn tác được.
 * C4 nguyên vẹn: server vẫn là nơi DUY NHẤT áp cú dán; đây thuần hiển thị.
 */
import { useMemo, useRef, useState } from 'react';
import { Avatar, NeonButton } from '@/components/ui';
import { docDienMao, vietDienMao } from '@config/avatar';
import {
  useDanSticker, type AvatarCatalogDTO, type AvatarMeDTO, type TacPhamDTO,
} from '@/api/avatar';
import s from './XuongDan.module.css';

const O_LUOI = 32;      // khớp config/avatar.ts — server kiểm lại, client chỉ vẽ
const CO_VE = 128;      // 32 ô × 4px — nấc lớn nhất Avatar hỗ trợ, bội số nguyên (D29)
const CO_NHAN = 64;     // ô kho nhãn — Avatar chỉ nhận cỡ pixel-perfect (§XI)
const CO_DOI = 64;      // hai ô TRƯỚC → SAU trong hộp xác nhận

interface Props {
  tacPham: TacPhamDTO;
  kho: AvatarMeDTO['kho'];
  catalog: AvatarCatalogDTO;
  onDong: () => void;
}

export function XuongDan({ tacPham, kho, catalog, onDong }: Props) {
  const dan = useDanSticker();
  const [chonSticker, setChonSticker] = useState<string | null>(null);
  const [viTri, setViTri] = useState<{ x: number; y: number } | null>(null);
  const [hoiXacNhan, setHoiXacNhan] = useState(false);
  /** Đo ngần ngại — ref để không re-render theo từng cú bấm thử chỗ. */
  const moLuc = useRef(Date.now());
  const soLanDoi = useRef(-1);   // cú đặt đầu tiên không tính là "dời"

  const [lat, setLat] = useState(false);

  const tenMon = (id: string) => catalog.mon.find((m) => m.id === id)?.ten ?? id;
  const dayNhan = tacPham.so_dan >= catalog.dan_toi_da;

  /** Nhãn đang có trên tác phẩm, đọc từ chuỗi thật. */
  const dmHienTai = useMemo(() => docDienMao(tacPham.chuoi), [tacPham.chuoi]);
  const danCu = useMemo(
    () => dmHienTai.dan.map((d) => ({ mon: d.mon.id, x: d.x, y: d.y, lat: d.lat })),
    [dmHienTai],
  );

  /** Chuỗi GIẢ ĐỊNH sau khi dán — dựng bằng đúng bộ mã hoá của server. */
  const ghep = (mon: string, x: number, y: number, l: boolean) => vietDienMao({
    goc: dmHienTai.goc,
    bang_mau: dmHienTai.bang_mau,
    khung: dmHienTai.khung?.id ?? null,
    dan: [...danCu, { mon, x, y, lat: l }],
  });

  const sanSang = chonSticker !== null && viTri !== null;
  const chuoiThu = chonSticker !== null && viTri !== null
    ? ghep(chonSticker, viTri.x, viTri.y, lat)
    : tacPham.chuoi;

  const chonO = (e: React.MouseEvent<HTMLButtonElement>) => {
    const khung = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(O_LUOI - 1,
      Math.floor(((e.clientX - khung.left) * O_LUOI) / khung.width)));
    const y = Math.max(0, Math.min(O_LUOI - 1,
      Math.floor(((e.clientY - khung.top) * O_LUOI) / khung.height)));
    soLanDoi.current += 1;
    setViTri({ x, y });
  };

  const guiDan = () => {
    if (chonSticker === null || viTri === null) return;
    dan.mutate({
      avatar_id: tacPham.avatar_id,
      sticker_id: chonSticker,
      x: viTri.x,
      y: viTri.y,
      lat,
      ms_can_nhac: Date.now() - moLuc.current,
      so_lan_doi_cho: Math.max(0, soLanDoi.current),
    }, { onSuccess: () => onDong() });
  };

  const o = CO_VE / O_LUOI;
  return (
    <div className={s.phu} role="dialog" aria-label="Xưởng dán nhãn">
      <div className={s.hop}>
        <header className={s.dau}>
          <span>XƯỞNG DÁN — NỀN #{tacPham.seri} · {tacPham.so_dan}/{catalog.dan_toi_da} nhãn</span>
          <button type="button" className={s.dong} onClick={onDong} aria-label="Đóng">✕</button>
        </header>

        {/* Khung tác phẩm — vẽ BẢN GHÉP THẬT: `chuoiThu` dựng bằng chính bộ mã
            hoá của server, nên cái thấy ở đây là cái sẽ dán. Vòng nhỏ chỉ là
            dấu neo cho biết ô nào đang chọn, không còn là thứ DUY NHẤT để nhìn. */}
        <button
          type="button"
          className={s.khung}
          style={{ width: CO_VE, height: CO_VE }}
          onClick={chonO}
          aria-label="Chọn vị trí dán trên khung"
        >
          <Avatar
            dm={chuoiThu}
            size={CO_VE}
            alt={sanSang ? 'Bản ghép thử' : `Nền #${tacPham.seri}`}
          />
          {viTri && (
            <span
              className={s.oDanhDau}
              style={{ left: viTri.x * o, top: viTri.y * o, width: o, height: o }}
              aria-hidden
            />
          )}
        </button>
        <p className={s.ghiChu}>
          {viTri
            ? (chonSticker
              ? `Đây là bản ghép thật — ô (${viTri.x}, ${viTri.y}). Bấm chỗ khác để dời.`
              : `Vị trí: ô (${viTri.x}, ${viTri.y}) — chọn một nhãn để xem nó trông thế nào.`)
            : 'Bấm lên khung để chọn vị trí dán.'}
        </p>

        {sanSang && (
          <button type="button" className={s.lat} onClick={() => setLat((v) => !v)}>
            ↔ LẬT NGANG {lat ? '· ĐANG LẬT' : ''}
          </button>
        )}

        <div className={s.khoNhan} role="radiogroup" aria-label="Chọn nhãn dán">
          {kho.length === 0 && (
            <p className={s.ghiChu}>Kho nhãn trống — nhãn dán mua hoặc quay ở Shop.</p>
          )}
          {kho.map((k) => (
            <button
              key={k.sticker_id}
              type="button"
              role="radio"
              aria-checked={chonSticker === k.sticker_id}
              className={chonSticker === k.sticker_id ? s.nhanChon : s.nhan}
              onClick={() => setChonSticker(k.sticker_id)}
            >
              {/* Vẽ nhãn NGAY TRÊN tác phẩm của chính người chơi, ở giữa khung.
                  Hiện art rời thì vẫn phải tự tưởng tượng nó nằm lên nền của mình;
                  hiện thế này thì câu hỏi "hợp không" được trả lời luôn. */}
              <Avatar
                dm={ghep(k.sticker_id, Math.floor(O_LUOI / 2), Math.floor(O_LUOI / 2), false)}
                size={CO_NHAN}
                alt={tenMon(k.sticker_id)}
              />
              <span className={s.tenNhan}>{tenMon(k.sticker_id)} ×{k.so_luong}</span>
            </button>
          ))}
        </div>

        {dayNhan && <p className={s.loi}>Tác phẩm đã kín nhãn.</p>}
        {dan.isError && <p className={s.loi}>✕ Chưa dán được, thử lại nhé.</p>}

        <NeonButton
          onClick={() => setHoiXacNhan(true)}
          disabled={chonSticker === null || viTri === null || dayNhan || dan.isPending}
        >
          DÁN NHÃN
        </NeonButton>

        {/* D36 — hộp xác nhận BẮT BUỘC, chữ nói thẳng tính vĩnh viễn. */}
        {hoiXacNhan && (
          <div className={s.xacNhan} role="alertdialog" aria-label="Xác nhận dán vĩnh viễn">
            <p>
              <b>DÁN LÀ VĨNH VIỄN.</b> Nhãn {chonSticker ? tenMon(chonSticker) : ''} sẽ
              nằm cố định trên nền #{tacPham.seri} — không gỡ được, không hoàn lại.
              Tấm này thành một tác phẩm độc lập của bạn.
            </p>
            {/* TRƯỚC → SAU ngay trong hộp xác nhận. Đây là giây cuối cùng còn
                đổi ý được, nên nó phải là giây người ta NHÌN RÕ NHẤT — không
                phải giây chỉ đọc chữ. */}
            <div className={s.doiChieu}>
              <figure>
                <Avatar dm={tacPham.chuoi} size={CO_DOI} alt="Trước khi dán" />
                <figcaption>TRƯỚC</figcaption>
              </figure>
              <span className={s.muiTen} aria-hidden>→</span>
              <figure>
                <Avatar dm={chuoiThu} size={CO_DOI} alt="Sau khi dán" />
                <figcaption>SAU</figcaption>
              </figure>
            </div>
            <div className={s.xacNhanNut}>
              <NeonButton onClick={() => { setHoiXacNhan(false); guiDan(); }}>
                DÁN — TÔI HIỂU LÀ VĨNH VIỄN
              </NeonButton>
              <button type="button" className={s.huy} onClick={() => setHoiXacNhan(false)}>
                Nghĩ lại
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
