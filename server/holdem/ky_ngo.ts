/**
 * KỲ NGỘ — CHẤM ĐIỂM NHIỆM VỤ (D85/D86 §1, doc 06 §1.4).
 *
 * Hàm THUẦN, không đụng DB, không đụng React: nhận số liệu từng vòng đã có sẵn
 * ở chỗ chốt vòng (`viThe`, `loiSuatTheoMa`, `brier`) và trả tiến độ. Thuần nên
 * test được bằng vector chép tay, đúng nếp A5.2 của phần tiền.
 *
 * ⚠⚠ BỐN NHIỆM VỤ KHÁC NHAU Ở *KIỂU ĐÚNG ĐẮN*, KHÔNG Ở *HÀNH ĐỘNG* — xem lằn
 * ranh A1/D69 trong `NHIEM_VU_KY_NGO`. File này là nơi lằn ranh đó thành code:
 * không hàm nào ở đây đọc "phơi nhiễm bao nhiêu" để chấm điểm; chúng chỉ hỏi
 * "vị thế NẰM ĐÚNG PHÍA không" và "độ chuẩn ra sao".
 */
import {
  KY_NGO, NHIEM_VU_KY_NGO, boNhiemVuMoi, laVongKyNgo,
  type DacQuyenKyNgoId, type NhiemVuId,
} from '../../config/holdem.js';

/** Số liệu MỘT vòng, gom ở chỗ chốt vòng. */
export interface VongKyNgo {
  /** Giá trị vị thế từng mã SAU khi giải lệnh. Dương = mua, âm = bán khống. */
  viThe: Readonly<Record<string, number>>;
  /** Lợi suất vòng của TỪNG mã trên bàn (bp). */
  loiSuatBp: Readonly<Record<string, number>>;
  /** Brier vòng — `null` khi toàn tiền mặt (D67: đứng ngoài KHÔNG phải dự báo). */
  brier: number | null;
  /** Ô của vòng này có ĐỔI PHA so với ô trước không (server suy từ map). */
  doiPha: boolean;
}

/**
 * VÒNG NÀY CÓ "ĐÚNG HƯỚNG" KHÔNG — định nghĩa tất định của D86.
 *
 * · Một VỊ THẾ đúng hướng ⟺ dấu vị thế khớp dấu lợi suất mã (mua đúng khi
 *   r > 0 · bán khống đúng khi r < 0). r = 0 ⇒ bỏ mã đó ra, không tính hai phía.
 * · VÒNG đúng hướng ⟺ phần vốn đã triển khai nằm đúng phía **> 50%**.
 *
 * ⚠ TRỌNG SỐ VỐN, KHÔNG ĐẾM ĐẦU MÃ. "Đọc đúng" phải nghĩa là phần lớn TIỀN nằm
 * đúng phía; đếm đầu mã thì trúng một mã lẻ giữ 2% vốn cũng thành "đọc đúng",
 * và thước đo hoá ra thưởng việc rải mỏng — tức đo ngược (cùng lỗi mà `brierVong`
 * đã tránh khi bắt so mã thắng trên TOÀN BÀN).
 *
 * `null` = vòng KHÔNG TÍNH (toàn tiền mặt, hoặc mọi mã đang giữ đều r = 0):
 * đứng ngoài không phải dự báo sai, nó là không dự báo (tiền lệ Brier D67).
 */
export function dungHuong(v: VongKyNgo): boolean | null {
  return dungHuongChiTiet(v)?.dung ?? null;
}

/**
 * Bản ĐỊNH LƯỢNG của `dungHuong` — nền của ỐNG KÍNH LA BÀN (D88 §11.2).
 *
 * `ty_le_bp` = phần vốn triển khai nằm đúng phía (bp). Con số này TRƯỚC D88
 * được tính rồi VỨT (hàm chỉ trả boolean) — ống kính chỉ nhặt lại nó, không
 * tính gì mới. Một nguồn cho cả chấm nhiệm vụ lẫn dòng hiển thị (D61).
 */
export function dungHuongChiTiet(
  v: VongKyNgo,
): { dung: boolean; ty_le_bp: number } | null {
  let dung = 0;
  let tong = 0;
  for (const [ma, gt] of Object.entries(v.viThe)) {
    if (gt === 0) continue;
    const r = v.loiSuatBp[ma] ?? 0;
    if (r === 0) continue;                    // không phán xử được, bỏ ra
    const von = Math.abs(gt);
    tong += von;
    if ((gt > 0 && r > 0) || (gt < 0 && r < 0)) dung += von;
  }
  if (tong === 0) return null;
  return {
    dung: dung * 2 > tong,                    // > 50% vốn triển khai
    ty_le_bp: Math.floor((dung * 10000) / tong),
  };
}

/**
 * KẺ VƯỢT SÓNG — ĐỊNH NGHĨA LẠI (D88 §11.1(2), đường (a)): phần chợ bạn CHỌN
 * thắng phần chợ bạn LOẠI.
 *
 * ⚠⚠ VÌ SAO BỎ ĐỊNH NGHĨA CŨ "thắng trung bình mọi mã": danh mục dàn đều =
 * đúng bằng chỉ số ⇒ VĨNH VIỄN không đạt — gradient thưởng chỉ về một phía
 * (càng ít dàn đều càng dễ), tức lá chạm thẳng trục "đa dạng hoá" mà lằn ranh
 * §1.2 cấm. Đo được: `thangChiSo(dàn đều 6 mã) === false` ở MỌI vòng.
 *
 * ĐỊNH NGHĨA MỚI — ba luật, mỗi luật chặn một đường bẩn:
 * · So TẬP MÃ ĐANG GIỮ với TẬP MÃ ĐÃ LOẠI, cả hai lấy TRUNG BÌNH ĐỀU (không
 *   trọng số vốn) ⇒ CỠ vị thế không đổi được kết quả — trục tập trung/phơi
 *   nhiễm không bị chạm (có test khoá: nhân đôi một vị thế, kết quả y nguyên).
 * · Vế GIỮ tính theo CHIỀU vị thế (khống nhận dấu ngược): short đúng mã đang
 *   rơi là một cú CHỌN đúng, không phải một cú may.
 * · Giữ CẢ BÀN (không loại mã nào) ⇒ `null` — chọn tất cả là KHÔNG chọn, cùng
 *   tiền lệ D67 "đứng ngoài không phải dự báo sai, nó là không dự báo".
 *   Dàn đều nay KHÔNG bị phạt: vòng đó đơn giản không tính, và người dàn 5/6
 *   mã loại đúng mã tệ vẫn ĐẠT — "đọc đúng" không còn đòi "bớt đa dạng".
 *
 * Đối xứng theo số mã (giữ 1 so 5, hay giữ 5 so 1) nên không đẩy về phía ít
 * hay nhiều mã — đó là toàn bộ điểm khác với bản cũ.
 */
export function soVoiCho(
  v: VongKyNgo,
): { thang: boolean; chenh_bp: number } | null {
  let giuTong = 0; let giuSo = 0;
  let loaiTong = 0; let loaiSo = 0;
  for (const [ma, r] of Object.entries(v.loiSuatBp)) {
    const gt = v.viThe[ma] ?? 0;
    if (gt === 0) { loaiTong += r; loaiSo += 1; continue; }
    giuTong += gt > 0 ? r : -r;               // chiều vị thế, KHÔNG cỡ vị thế
    giuSo += 1;
  }
  if (giuSo === 0 || loaiSo === 0) return null; // toàn tiền mặt / ôm cả bàn
  const chenh = giuTong / giuSo - loaiTong / loaiSo;
  return { thang: chenh > 0, chenh_bp: Math.round(chenh) };
}

export interface TienDoKyNgo {
  /** Đã đủ điều kiện XONG chưa (đánh giá trên các vòng đã chơi). */
  xong: boolean;
  /** Tử số / mẫu số để UI vẽ "3/5" — luôn có, kể cả khi chưa xong. */
  dat: number;
  can: number;
  /** Vế chống lách: số vòng CÓ vị thế / ngưỡng tối thiểu. */
  vongCoViThe: number;
  canCoViThe: number;
}

/**
 * Chấm một nhiệm vụ trên các vòng KỂ TỪ vòng kỳ ngộ.
 *
 * `soVongConLai` = số vòng của chặng (runway) tính từ vòng kỳ ngộ tới hết trận;
 * ngưỡng tỷ lệ tính trên nó, không tính trên số vòng ĐÃ chơi — nếu không thì
 * người chơi "xong" ngay ở vòng đầu với 1/1 rồi thôi cố.
 */
export function chamNhiemVu(
  id: NhiemVuId, vongs: readonly VongKyNgo[], soVongConLai: number,
): TienDoKyNgo {
  const coViThe = vongs.filter(
    (v) => Object.values(v.viThe).some((x) => x !== 0)).length;
  const canCoViThe = Math.ceil(
    (soVongConLai * KY_NGO.TOI_THIEU_VONG_CO_VI_THE_BP) / 10000);
  const duMat = coViThe >= canCoViThe;

  const nen = (dat: number, can: number): TienDoKyNgo => ({
    xong: duMat && dat >= can, dat, can, vongCoViThe: coViThe, canCoViThe,
  });

  switch (id) {
    case 'la_ban': {
      // Mẫu số là số vòng CÓ PHÁN XỬ (dungHuong ≠ null), nhưng ngưỡng neo vào
      // runway để không "xong sớm" bằng cách chỉ vào lệnh một vòng.
      const xet = vongs.map(dungHuong).filter((x): x is boolean => x !== null);
      const can = Math.ceil((soVongConLai * KY_NGO.LA_BAN_TY_LE_BP) / 10000);
      return nen(xet.filter(Boolean).length, can);
    }
    case 've_song': {
      const xet = vongs.map((x) => soVoiCho(x)?.thang)
        .filter((x): x is boolean => x !== undefined);
      const can = Math.ceil((soVongConLai * KY_NGO.VE_SONG_TY_LE_BP) / 10000);
      return nen(xet.filter(Boolean).length, can);
    }
    case 'bat_nhip': {
      const dat = vongs.filter((v) => v.doiPha && dungHuong(v) === true).length;
      return nen(dat, KY_NGO.BAT_NHIP_SO_VONG);
    }
    case 'tay_can': {
      /*
       * TAY CÂN đo NGƯỢC CHIỀU: Brier THẤP là tốt. Nên `dat`/`can` ở đây là số
       * VÒNG ĐẠT CHUẨN, không phải điểm Brier — để UI vẽ "3/5" cùng một khuôn
       * với ba nhiệm vụ kia thay vì phải hiểu một thang đảo.
       * Vòng Brier null (toàn tiền mặt) KHÔNG tính — D67.
       */
      const co = vongs.filter((v) => v.brier !== null);
      const nguong = KY_NGO.TAY_CAN_BRIER_BP / 10000;
      const dat = co.filter((v) => (v.brier as number) <= nguong).length;
      const can = Math.ceil((soVongConLai * KY_NGO.LA_BAN_TY_LE_BP) / 10000);
      return nen(dat, can);
    }
    default:
      return nen(0, 1);
  }
}

// ---------------------------------------------------------------------------
// ỐNG KÍNH CON ĐƯỜNG (D88 §11.2) — mỗi vòng, con đường soi lại CHÍNH BẠN
// ---------------------------------------------------------------------------

/**
 * MỘT DÒNG kết quả vòng do con đường quyết định — hiệu lực từ giây CHỐT lựa
 * chọn, không cần đạt gì. Đây là chỗ "lựa chọn khác biệt" thành sự thật: hai
 * người cùng bàn, cùng ô, sau mỗi vòng đọc hai con số khác nhau.
 *
 * ⚠⚠ KHÔNG MỘT BIT THÔNG TIN MỚI NÀO ĐƯỢC CẤP — cả bốn dòng đều HỒI CỐ về
 * vòng VỪA CHỐT, dựng từ số engine đã tính rồi vứt (`dungHuongChiTiet`,
 * `soVoiCho`, `brier`, `doiPha`). Nên nó sạch cả ba lằn ranh:
 * · D67 — không thêm nước đi, chỉ đổi THÔNG TIN của ba nước cũ;
 * · §1.3 — mọi lá chiến thuật đều nói về TƯƠNG LAI, không lá nào soi lại quá
 *   khứ của chính bạn ⇒ không đặc quyền nào thành thừa;
 * · A3.1 — nói về CHÍNH MÌNH, không lộ gì của người khác.
 *
 * ⚠ Riêng `bat_nhip`: dòng "ô vừa lật CÓ đổi pha" nghe như rò cấu trúc ẩn,
 * nhưng nó KHÔNG rò thêm gì so với bản đã ship — chip tiến độ của người chọn
 * KẺ BẮT NHỊP vốn đã nhảy `dat` đúng ở vòng đổi-pha-mà-đúng-hướng, tức cùng
 * tập người đó đã đọc được cùng thông tin đó qua chip. Ống kính chỉ nói RÕ
 * thứ chip đang nói ÚP MỞ.
 *
 * `null` trong các nhánh số = vòng không phán xử được (toàn tiền mặt / ôm cả
 * bàn). Client PHẢI vẽ `—`, TUYỆT ĐỐI không vẽ số âm hay 0 — chốt chặn rìa
 * §1.2 của D88: một con số đỏ trên màn ở vòng đứng ngoài là một lời hối thúc
 * vào lệnh, tức kê tư thế phơi nhiễm.
 */
export type OngKinh =
  | { loai: 'la_ban'; ty_le_dung_bp: number | null }
  | { loai: 'tay_can'; brier: number | null }
  | { loai: 've_song'; chenh_bp: number | null }
  | { loai: 'bat_nhip'; doi_pha: boolean };

export function ongKinhVong(id: NhiemVuId, v: VongKyNgo): OngKinh {
  switch (id) {
    case 'la_ban':
      return { loai: 'la_ban', ty_le_dung_bp: dungHuongChiTiet(v)?.ty_le_bp ?? null };
    case 'tay_can':
      return { loai: 'tay_can', brier: v.brier };
    case 've_song':
      return { loai: 've_song', chenh_bp: soVoiCho(v)?.chenh_bp ?? null };
    default:
      return { loai: 'bat_nhip', doi_pha: v.doiPha };
  }
}

// ---------------------------------------------------------------------------
// Ô ĐỔI PHA — nền của KẺ BẮT NHỊP và của đặc quyền CHUÔNG ĐỔI PHA
// ---------------------------------------------------------------------------

/**
 * Ô nào là ô ĐỔI PHA của map (chỉ số 0 = ô 1).
 *
 * `pha[i]` = giai đoạn nền của máy NGAY TRƯỚC ô i (`TrangThaiO.giai_doan_nen`).
 * Nên "ô i làm thị trường đổi pha" ⟺ pha ngay SAU ô i khác pha ngay TRƯỚC nó,
 * tức `pha[i+1] !== pha[i]`.
 *
 * ⚠ Ô CUỐI luôn `false`, và đó là giới hạn của phép ĐO chứ không phải một luật:
 * `trang_thai` có đúng một dòng mỗi ô nên không có `pha[soO]` để so. Không bịa
 * ra một trạng thái sau ô cuối — bịa là KẺ BẮT NHỊP thỉnh thoảng cộng điểm cho
 * một cú đổi pha chưa từng xảy ra.
 * ⚠ Map cũ (trước máy trạng thái D43) không có `trang_thai` ⇒ toàn `false`:
 * không có pha thì không có cú đổi pha, và im lặng ở đây đúng hơn là đoán.
 */
export function doiPhaCuaMap(
  pha: readonly string[] | undefined, soO: number,
): boolean[] {
  return Array.from({ length: soO }, (_, i) => {
    const truoc = pha?.[i];
    const sau = pha?.[i + 1];
    return truoc !== undefined && sau !== undefined && sau !== truoc;
  });
}

// ---------------------------------------------------------------------------
// TIẾN TRÌNH — một lần kỳ ngộ, từ lời mời tới lúc chấm xong
// ---------------------------------------------------------------------------

export interface LanKyNgo {
  /** Vòng kỳ ngộ (1-indexed). */
  vong: number;
  /**
   * Bộ được mời — TẤT ĐỊNH, không lưu log (suy được khi replay).
   * Từ D88 sinh theo HỒI đang chơi (`boNhiemVuTheoHoi`); caller cấp qua
   * `moiHoi`, vắng thì rơi về phép xoay cũ.
   */
  moi: readonly NhiemVuId[];
  /**
   * D88 — chương hồi tại vòng kỳ ngộ (id, vd 'bong_bong'). `null` = chưa tới
   * vòng đó hoặc caller không cấp. Vào `hd_chon_ky_ngo` làm trục data
   * "chọn gì KHI đang ở chế độ thị trường nào".
   */
  hoi: string | null;
  /** Người chơi đã chọn gì. `null` = chưa tới, hoặc bỏ qua (không phạt). */
  chon: NhiemVuId | null;
  /** Tiến độ hiện tại. `null` khi chưa chọn — UI vẽ lời mời chứ không vẽ "0/5". */
  tien_do: TienDoKyNgo | null;
  /**
   * Vòng ĐẦU TIÊN mà nhiệm vụ đạt. `null` = chưa xong.
   *
   * ⚠ Đặc quyền hiệu lực từ vòng KẾ TIẾP, không phải từ chính vòng này: kết quả
   * của vòng V chỉ biết được SAU khi vòng V chốt, nên cấp đặc quyền ngay tại V
   * là cấp một thứ người chơi không thể dùng ở V (họ đã nộp xong rồi).
   */
  xong_o_vong: number | null;
}

/**
 * Toàn bộ tiến trình kỳ ngộ của một trận — HÀM THUẦN.
 *
 * `soLieu` chỉ chứa các vòng ĐÃ CHỐT. Vòng đang chơi dở chưa có kết quả nên
 * chưa chấm được, và đó là đúng: tiến độ phải là thứ đã xảy ra.
 *
 * ⚠ `chon` được lọc theo `moi` ở đây LẦN NỮA dù tầng nhận đã lọc. Không phải
 * thừa: `action_log` là nguồn dựng lại trận và nó sống lâu hơn mọi phép lọc ở
 * tầng nhận — một lần đổi `boNhiemVuMoi` là log cũ mang một lựa chọn nay không
 * còn được mời. Thà coi như chưa chọn (không đặc quyền) còn hơn chấm một nhiệm
 * vụ chưa bao giờ được chào.
 */
export function tienTrinhKyNgo(
  seed: number, soO: number,
  chon: ReadonlyMap<number, NhiemVuId>,
  soLieu: ReadonlyMap<number, VongKyNgo>,
  /**
   * D88 — bộ mời + hồi THEO TỪNG VÒNG kỳ ngộ, do caller (replay) suy từ trạng
   * thái trận tại ĐÚNG vòng đó. Vòng vắng mặt (chưa tới, hoặc caller cũ) rơi
   * về phép xoay `boNhiemVuMoi` — an toàn vì vòng chưa tới thì chưa ai chọn
   * được gì để phép lọc `chon ∈ moi` phán xử.
   */
  moiHoi?: ReadonlyMap<number, { moi: readonly NhiemVuId[]; hoi: string | null }>,
): LanKyNgo[] {
  const ra: LanKyNgo[] = [];
  for (let v = 1; v <= soO; v += 1) {
    if (!laVongKyNgo(v, soO)) continue;
    const mh = moiHoi?.get(v);
    const moi = mh?.moi ?? boNhiemVuMoi(seed, v);
    const hoi = mh?.hoi ?? null;
    const xin = chon.get(v);
    const c = xin && moi.includes(xin) ? xin : null;
    if (!c) {
      ra.push({ vong: v, moi, hoi, chon: null, tien_do: null, xong_o_vong: null });
      continue;
    }
    // Chặng tính TỪ chính vòng kỳ ngộ: lựa chọn được chốt TRƯỚC khi vòng đó
    // được nộp, nên vòng đó đã nằm trong "phần còn lại của trận".
    const runway = soO - v + 1;
    const day: VongKyNgo[] = [];
    let xongO: number | null = null;
    for (let k = v; k <= soO; k += 1) {
      const s = soLieu.get(k);
      if (!s) break;                  // tới vòng chưa chốt thì dừng
      day.push(s);
      if (xongO === null && chamNhiemVu(c, day, runway).xong) xongO = k;
    }
    ra.push({
      vong: v, moi, hoi, chon: c,
      tien_do: chamNhiemVu(c, day, runway),
      xong_o_vong: xongO,
    });
  }
  return ra;
}

/**
 * Đặc quyền nào đang hiệu lực, và TỪ VÒNG NÀO.
 *
 * Trả `Map<đặc quyền, vòng bắt đầu>` thay vì một danh sách phẳng: PHIẾU MỞ BẢNG
 * phải đếm số lần mở KỂ TỪ mốc đó, và THẺ GIỜ chỉ cộng giây cho các vòng từ mốc
 * đó trở đi. Một danh sách "đang có / không có" là mất đúng con số cần để tính.
 */
export function dacQuyenKyNgo(
  lans: readonly LanKyNgo[],
): Map<DacQuyenKyNgoId, number> {
  const ra = new Map<DacQuyenKyNgoId, number>();
  for (const l of lans) {
    if (!l.chon || l.xong_o_vong === null) continue;
    const nv = NHIEM_VU_KY_NGO.find((x) => x.id === l.chon);
    if (!nv) continue;
    const tu = l.xong_o_vong + 1;
    const cu = ra.get(nv.dac_quyen);
    if (cu === undefined || tu < cu) ra.set(nv.dac_quyen, tu);
  }
  return ra;
}

/**
 * CON ĐƯỜNG MỘT GHẾ BOT CHỌN — tất định theo (seed, vòng, ghế).
 *
 * ⚠⚠ BOT CHỌN, NHƯNG BOT KHÔNG NHẬN ĐẶC QUYỀN — và điều đó KHÔNG phải một
 * bất đối xứng lén lút: không đặc quyền nào trong bốn cái có kênh phía bot.
 * Bot không mở Bảng điện tử (PHIẾU vô nghĩa), không có đồng hồ (THẺ GIỜ vô
 * nghĩa), và đọc thẳng trạng thái map nên BẢN ĐỒ CHU KỲ / CHUÔNG ĐỔI PHA
 * không thêm cho nó một bit nào. ⇒ Kỳ ngộ KHÔNG dịch một chip nào của bot,
 * nên gate G1–G4 (bàn toàn bot) không bị cụm này đụng tới.
 *
 * Vì sao vẫn cho bot chọn: icon con đường (doc 06 §1.5) tồn tại để cú chọn CÓ
 * KHÁN GIẢ. Bàn hôm nay toàn bot, nên không cho bot chọn thì icon không bao giờ
 * hiện trên một ghế nào khác ghế mình — đúng khuôn "cơ chế trang trí" mà repo
 * này đã dính 18 lần. Khai thẳng giới hạn: đây là con đường TUYÊN BỐ của bot,
 * không phải con đường nó theo đuổi.
 *
 * `rng` nhận vào chứ không import: file này THUẦN và test được không cần seed
 * thật (xem đầu file).
 */
export function chonKyNgoBot(
  moi: readonly NhiemVuId[], rutNgauNhien: (n: number) => number,
): NhiemVuId | null {
  if (moi.length === 0) return null;
  return moi[rutNgauNhien(moi.length)] ?? null;
}

/**
 * THẺ GIỜ — cộng bao nhiêu giây cho vòng `vong`. Một nguồn cho cả payload đồng
 * hồ lẫn cửa cưỡng chế hạn ở `/rounds`: hai chỗ lệch nhau nghĩa là màn hiện
 * "còn 8 giây" trong khi server đã chốt hộ (lớp lỗi tệ nhất của cụm đồng hồ).
 */
export function themGiayKyNgo(
  dq: ReadonlyMap<DacQuyenKyNgoId, number>, vong: number,
): number {
  const tu = dq.get('the_gio');
  return tu !== undefined && vong >= tu ? KY_NGO.THE_GIO_THEM_S : 0;
}

/**
 * PHIẾU MỞ BẢNG — vòng này có được miễn phí mở bảng không, và còn mấy phiếu.
 *
 * `soLanTheoVong` = số lần mở bảng CÓ THU PHÍ của từng vòng đã chốt (đọc từ
 * `action_log.mo_bang`). Phiếu tiêu theo thứ tự vòng, tối đa `PHIEU_MO_BANG_SO`.
 *
 * ⚠ HÀM NÀY LÀ NGUỒN DUY NHẤT. Cả `replay` (chỗ TRỪ tiền thật) lẫn endpoint
 * `/bang-dien-tu` (chỗ BÁO GIÁ) đều phải hỏi nó — hai bản cài đặt sẽ trôi, và
 * cú trôi ở đây biểu hiện là "màn báo miễn phí, Vốn vẫn bị trừ" (lớp lỗi D67).
 */
export function phieuConLai(
  tuVong: number | undefined,
  soLanTheoVong: ReadonlyMap<number, number>,
  denVong: number,
): number {
  if (tuVong === undefined) return 0;
  let dung = 0;
  for (let v = tuVong; v < denVong; v += 1) {
    if ((soLanTheoVong.get(v) ?? 0) > 0) dung += 1;
  }
  return Math.max(0, KY_NGO.PHIEU_MO_BANG_SO - dung);
}
