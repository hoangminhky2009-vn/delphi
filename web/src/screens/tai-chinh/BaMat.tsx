/**
 * PFM — NẮP "NÓI · LÀM · TRONG TRẬN" của GƯƠNG (D426). Founder 26/09: *"kết hợp dữ liệu app thu được nữa xong so sánh
 * hành vi"*. Đây là mục tiêu G1 đã chốt — gương BA MẶT (trong game · tự khai · sổ thật) — và G3: chỗ các nhân chứng cãi
 * nhau là NỘI DUNG, không phải lỗi. Nắp đặt từng cặp CẠNH NHAU; nó không chấm khớp hay lệch.
 *
 * ⚠⚠ KHÔNG MỘT TRỤC CHUNG, KHÔNG MỘT ĐIỂM KHỚP. Quy lời khai bốn nấc, con số của sổ và bậc của trận về cùng một thang là
 *   tự đặt TRỌNG SỐ giữa các nguồn — đúng chỗ founder gọi tên là cấn khi nối (24/09: *"cân bằng trọng số dữ liệu theo thời
 *   gian và độ chắc giữa game và PFM"*), chưa chốt. Mỗi mặt nói bằng đơn vị của chính nó.
 * ⚠ Mỗi cặp chỉ ghép thứ ĐO CÙNG MỘT VIỆC: câu phỏng vấn "tiền vừa về…" ↔ cú nạp trong đúng cửa sổ tiền về app tự chấm ·
 *   GIỮ SỔ của trận (*"khoá một khoản có kỳ hạn rồi giữ tới hạn"*) ↔ hũ có kỳ hạn · LỌC TIN ↔ lời đoán có độ chắc · CHIA
 *   GIỎ ↔ danh mục vị thế. "Đi chơi cùng bạn", "ngày tệ": sổ không biết ⇒ nói thẳng "sổ không đo được".
 * ⚠ P2: mọi số tính trên máy từ kho trên máy; mặt trận đọc đúng `GET /me/nang-luc` mà nắp TRONG TRẬN cũ đã đọc, dưới đúng
 *   cửa `noi_game` (D324). Không một byte mới rời máy.
 * ⚠ A10: tả + đếm — không "vậy nên", không câu nào nói ai "nói một đằng làm một nẻo".
 */
import { Link } from 'react-router-dom';
import type { NangLucId } from '@config/nang_luc';
import { PFM } from '@config/pfm';
import type { NangLucCuaToiDTO } from '@server/holdem/nang_luc_ids';
import {
  KHUNG_CUA_NHIP, SO_NGAY_BA_MAT, NGAY_CUOI_THANG, giuCamKet, phanDaChia, soGanDay, soKhung, tienVeCoNap,
  type GiuCamKet, type KhungNgay, type SoKhung,
} from '@/pfm/bieu_do';
import { chiBu } from '@/pfm/guong';
import type { HoSo } from '@/pfm/ho_so';
import type { Hu } from '@/pfm/hu';
import { tongGopVaoHu, type Khoan } from '@/pfm/so';
import { danhMuc, type TongLoiDoan } from '@/pfm/vi_the';
import { DauKyNangTinh, HangKyNangNguoi, laIdKyNang } from '@/components/HangKyNang';
import { CHU_BENTO as CB, CHU_BIEU_DO as B, CHU_MAN_GUONG as C } from '@/lib/pfm_chu';
import { ROUTE_ARENA, ROUTE_CAI_DAT } from '@/lib/vocab';
import g from './Guong.module.css';
import s from './BaMat.module.css';

/* ═══ SỐ CỦA MẶT SỔ — tính một lần, đọc ở cả lá nắp lẫn ruột nắp ═══════════════════════════════════ */

export interface SoBaMat {
  tienVe: { n: number; coNap: number };
  /** Sau một ngày tiêu lớn: bao nhiêu lần, bao nhiêu lần hôm sau vẫn trên mức thường (`chiBu`). `null` = chưa đủ. */
  sauTieu: { n: number; vuot: number } | null;
  /** Phần tiêu tháng này đã chia vào hũ (`phanDaChia`). */
  daChia: number | null;
  /** Phần dòng tiền tháng đã cam kết vào vị thế (`danhMuc.daCamKet`). */
  camKet: number | null;
  quaTay: Record<KhungNgay, SoKhung | null>;
  giu: GiuCamKet;
  /** Vị thế đang cam kết + phần cỡ của từng cái (lớn trước) — cùng cờ `camKet` của lõi danh mục. */
  gio: { ten: string; phan: number }[];
}

/**
 * ⚠ Mọi phép đo đi qua hàm đã có — không phép thứ hai (A11.5): `tienVeCoNap` · `chiBu` (trên đúng cửa sổ `SO_NGAY_BA_MAT`
 *   ngày) · `phanDaChia` · `danhMuc` · `soKhung` · `giuCamKet`.
 */
export function dungBaMat(tatCa: readonly Khoan[], hu: readonly Hu[], ngayNay: string, thang: string): SoBaMat {
  const bu = chiBu(soGanDay(tatCa, ngayNay, SO_NGAY_BA_MAT));
  const dm = danhMuc(hu, tatCa, ngayNay, (h) => tongGopVaoHu(tatCa, h.id, h.mocGop));
  const coCo = dm.dong.filter((d) => d.camKet);
  const tongCo = coCo.reduce((a, d) => a + d.co!.moiThang, 0);
  return {
    tienVe: tienVeCoNap(tatCa, ngayNay),
    sauTieu: bu.gt === null ? null : { n: bu.n, vuot: Math.round(bu.gt * bu.n) },
    daChia: phanDaChia(tatCa, thang),
    camKet: dm.daCamKet,
    quaTay: {
      sau_tien_ve: soKhung(tatCa, ngayNay, 'sau_tien_ve'),
      cuoi_thang: soKhung(tatCa, ngayNay, 'cuoi_thang'),
      cuoi_tuan: soKhung(tatCa, ngayNay, 'cuoi_tuan'),
    },
    giu: giuCamKet(hu, tatCa, ngayNay),
    gio: tongCo === 0 ? [] : coCo.map((d) => ({ ten: d.hu.ten.toUpperCase(), phan: d.co!.moiThang / tongCo })),
  };
}

/* ═══ CÁC CẶP "ĐOÁN ↔ THẬT" — mặt SỔ của bảng, KHÔNG nhãn nguồn (PFM tầng không gian, founder 11/10) ════════════════════ */

export type MaCapDoi = 'tien_ve' | 'sau_tieu' | 'dau_thang' | 'qua_tay';

/** Điều sổ đo được, dạng số — chữ dựng ở nơi vẽ. `null` ở `CapDoi.thuc` = chưa đủ mẫu (P7: KHÔNG phải 0). */
export type ThucTe =
  | { k: 'dem'; co: number; n: number }
  | { k: 'phan'; ty: number }
  | { k: 'nhip'; ds: { khung: KhungNgay; tyLe: number | null }[] };

export interface CapDoi {
  ma: MaCapDoi;
  /** Điều người dùng nghĩ về mình (nhãn đáp án đã chọn ở phỏng vấn); `null` = chưa trả lời câu ấy. */
  nghi: readonly string[] | null;
  thuc: ThucTe | null;
}

/**
 * ⭐ BỐN CẶP "BẠN NGHĨ → THỰC TẾ" — CÙNG dữ liệu với bốn cặp `NÓI ↔ SỔ` của `MatBaMat` (không phép đo mới, A11.5), chỉ BỎ TÊN NGUỒN.
 * Mỗi cặp ghép thứ ĐO CÙNG MỘT VIỆC; cặp thiếu một phía ⇒ "chưa đủ để nói" (D62). KHÔNG chấm khớp/lệch: bảng gốc đã nói rõ (*"không một trục
 * chung, không một điểm khớp"* — trọng số giữa các nguồn chưa chốt) và SPEC giữ nguyên công thức; chỗ này chỉ ĐẶT CẠNH NHAU.
 */
export function capDoiChieu(so: SoBaMat, hoSo: HoSo): CapDoi[] {
  const nhip = hoSo.nhip ?? [];
  const khung: KhungNgay[] = nhip.length > 0
    ? nhip.map((c) => KHUNG_CUA_NHIP[c]).filter((k): k is KhungNgay => k !== undefined && k !== null)
    : ['sau_tien_ve', 'cuoi_thang'];
  const quaTay = khung.map((k) => ({ khung: k, tyLe: so.quaTay[k]?.tyLe ?? null }));
  return [
    {
      ma: 'tien_ve',
      nghi: hoSo.lucTienVe !== undefined ? [hoSo.lucTienVe] : null,
      thuc: so.tienVe.n === 0 ? null : { k: 'dem', co: so.tienVe.coNap, n: so.tienVe.n },
    },
    {
      ma: 'sau_tieu',
      nghi: hoSo.sauKhiTieu !== undefined ? [hoSo.sauKhiTieu] : null,
      thuc: so.sauTieu === null ? null : { k: 'dem', co: so.sauTieu.vuot, n: so.sauTieu.n },
    },
    {
      ma: 'dau_thang',
      nghi: hoSo.dauThang !== undefined ? [hoSo.dauThang] : null,
      thuc: so.daChia === null ? null : { k: 'phan', ty: so.daChia },
    },
    {
      ma: 'qua_tay',
      nghi: nhip.length > 0 ? nhip : null,
      thuc: quaTay.some((x) => x.tyLe !== null) ? { k: 'nhip', ds: quaTay } : null,
    },
  ];
}

/** Cặp có ĐỦ hai phía (người dùng đã trả lời VÀ sổ đã đủ mẫu) — mẫu số của "N cặp đủ". */
export const capDu = (c: CapDoi): boolean => c.nghi !== null && c.thuc !== null;

/* D453 — `KHUNG_CUA_NHIP` dời xuống `pfm/bieu_do.ts` (tấm HƯỚNG cũng ghép lời kể với khung ngày) — xuất lại giữ tên. */
export { KHUNG_CUA_NHIP } from '@/pfm/bieu_do';

const soLan = (x: number): string => `${B.lanPre}${x.toFixed(1).replace('.', ',')}`;
const phanTram = (x: number): string => `${Math.round(x * 100)}%`;

/**
 * Chữ trên lá nắp: số cặp có ĐỦ hai mặt (NÓI + SỔ, hoặc TRẬN + SỔ). `coTran` = cửa `noi_game` mở VÀ đã có đề hợp lệ.
 * ⚠ Đếm cặp, không chấm cặp — lá nắp nói "có gì để đặt cạnh nhau", không nói "khớp bao nhiêu".
 */
export function soCapDu(so: SoBaMat, hoSo: HoSo, coTran: boolean, tongDoan: TongLoiDoan): number {
  const nhip = hoSo.nhip ?? [];
  return [
    hoSo.lucTienVe !== undefined && so.tienVe.n > 0,
    hoSo.sauKhiTieu !== undefined && so.sauTieu !== null,
    hoSo.dauThang !== undefined && so.daChia !== null,
    nhip.some((c) => { const k = KHUNG_CUA_NHIP[c]; return k !== undefined && k !== null && so.quaTay[k] !== null; }),
    coTran && so.giu.giu + so.giu.bo + so.giu.dangChay > 0,
    coTran && tongDoan.theoChac.some((x) => x.n > 0),
    coTran && so.gio.length > 0,
  ].filter(Boolean).length;
}

/* ═══ HÀNG ═════════════════════════════════════════════════════════════════════════════════════ */

function Cap({ ten, testid, children }: { ten: string; testid: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={s.cap} data-testid={testid}>
      <div className={s.capTen}>{ten}</div>
      {children}
    </div>
  );
}

function Mat({ tag, lop, children }: { tag: string; lop: string | undefined; children: React.ReactNode }): React.ReactElement {
  return (
    <div className={s.mat}>
      <span className={`${s.tag} ${lop ?? ''}`}>{tag}</span>
      <span className={s.matNoi}>{children}</span>
    </div>
  );
}

function Noi({ loi, nhan }: { loi: string | readonly string[] | undefined; nhan: string }): React.ReactElement {
  const ds = loi === undefined ? [] : typeof loi === 'string' ? [loi] : loi;
  return (
    <Mat tag={nhan} lop={s.tagNoi}>
      {ds.length === 0
        ? <span className={s.mo}>{B.chuaTraLoi}</span>
        : ds.map((x) => <span key={x} className={s.loi}>{`“${x}”`}</span>)}
    </Mat>
  );
}

/** Số ô tối đa một hàng 375px còn chứa được — quá số này thì đếm bằng thanh tỷ lệ. */
const O_TOI_DA = 12;

/**
 * Ô đếm bằng VẬT (nếp nắp LỜI ĐOÁN): mỗi lượt một ô — đặc = có.
 * ⚠ Quá `O_TOI_DA` lượt ⇒ THANH tỷ lệ, không cắt bớt ô: bản đầu cắt ở 12 ô mà vẫn tô `co` ô đặc — "10/20" vẽ thành 10
 *   ô đặc trên 12, mắt đọc ra 83% cho một tỷ lệ 50% (soi ảnh 26/09). Vật phải nói đúng con số đứng cạnh nó.
 */
function ODem({ n, co }: { n: number; co: number }): React.ReactElement {
  if (n > O_TOI_DA) {
    return (
      <span className={`${s.thanh} ${s.thanhDem}`} aria-hidden="true" data-testid="dem-thanh">
        <i style={{ width: `${(co / n) * 100}%` }} />
      </span>
    );
  }
  return (
    <span className={`${g.oDem} ${s.oDem}`} aria-hidden="true">
      {Array.from({ length: n }, (_, k) => <i key={k} className={k < co ? g.oToi : undefined} />)}
    </span>
  );
}

/* ═══ NẮP ══════════════════════════════════════════════════════════════════════════════════════ */

export function MatBaMat({ so, hoSo, noiGame, nl, tongDoan, thang, gonNguon = false }: {
  so: SoBaMat; hoSo: HoSo; noiGame: boolean; nl: NangLucCuaToiDTO | undefined; tongDoan: TongLoiDoan; thang: string;
  /**
   * PFM tầng không gian (founder 11/10): `true` ⇒ BỎ TÊN NGUỒN — nhãn mỗi phía là "BẠN NGHĨ" / "THỰC TẾ", tiêu đề nhóm là chữ trung tính.
   * Cùng dữ liệu, cùng cặp, KHÔNG phép đo thứ hai (A11.5); chỉ khác chữ trên nhãn. Mặc định `false` (giữ bản cũ cho mọi nơi còn gọi).
   */
  gonNguon?: boolean;
}): React.ReactElement {
  const nhanNoi = gonNguon ? CB.guBanNghi.toUpperCase() : B.tagNoi;
  const nhanSo = gonNguon ? CB.guThucTe.toUpperCase() : B.tagSo;
  const nhanTran = gonNguon ? CB.guThucTe.toUpperCase() : B.tagTran;
  const w = PFM.GUONG_CUA_SO_TIEN_VE;
  const nhip = hoSo.nhip ?? [];
  const tenKhung: Record<KhungNgay, string> = {
    sau_tien_ve: `${w}${B.khungSauVeHau}`,
    cuoi_thang: `${NGAY_CUOI_THANG}${B.khungCuoiThangHau}`,
    cuoi_tuan: B.khungCuoiTuan,
  };
  const giaTriKhung = (k: KhungNgay): string => {
    const x = so.quaTay[k];
    return x === null ? C.thieuMau : soLan(x.tyLe);
  };
  const daXet = tongDoan.theoChac.filter((x) => x.n > 0);
  return (
    <div data-testid="mat-ba-mat">
      {!gonNguon && <div className={s.nhom}>{B.nhomNoiSo}</div>}

      <Cap ten={B.capTienVe} testid="cap-tien-ve">
        <Noi nhan={nhanNoi} loi={hoSo.lucTienVe} />
        <Mat tag={nhanSo} lop={s.tagSo}>
          {so.tienVe.n === 0 ? <span className={s.mo}>{B.chuaTienVe}</span> : (
            <>
              <ODem n={so.tienVe.n} co={so.tienVe.coNap} />
              <span>{`${so.tienVe.coNap}/${so.tienVe.n}${B.tienVeLanHau}${w}${B.tienVeNgayHau}`}</span>
            </>
          )}
        </Mat>
      </Cap>

      <Cap ten={B.capSauTieu} testid="cap-sau-tieu">
        <Noi nhan={nhanNoi} loi={hoSo.sauKhiTieu} />
        <Mat tag={nhanSo} lop={s.tagSo}>
          {so.sauTieu === null ? <span className={s.mo}>{B.sauTieuChuaDu}</span> : (
            <>
              <ODem n={so.sauTieu.n} co={so.sauTieu.vuot} />
              <span>{`${B.sauTieuPre}${so.sauTieu.vuot}/${so.sauTieu.n}${B.lanHau}`}</span>
            </>
          )}
        </Mat>
      </Cap>

      <Cap ten={B.capDauThang} testid="cap-dau-thang">
        <Noi nhan={nhanNoi} loi={hoSo.dauThang} />
        <Mat tag={nhanSo} lop={s.tagSo}>
          {so.daChia === null ? <span className={s.mo}>{B.chuaTieuThang}</span> : (
            <span className={s.cot}>
              <span>{`${B.daChiaPre}${Number(thang.slice(5, 7))}${B.daChiaGiua}`}<b>{phanTram(so.daChia)}</b></span>
              <span className={s.thanh} aria-hidden="true"><i style={{ width: phanTram(so.daChia) }} /></span>
            </span>
          )}
          {so.camKet !== null && (
            <span className={s.dongPhu}>{`${B.camKetPre}${Math.round(so.camKet * 100)}${B.camKetHau}`}</span>
          )}
        </Mat>
      </Cap>

      <Cap ten={B.capQuaTay} testid="cap-qua-tay">
        <Noi nhan={nhanNoi} loi={nhip} />
        <Mat tag={nhanSo} lop={s.tagSo}>
          {/* Chưa trả lời câu này ⇒ vẫn bày hai khung sổ đo được, để mặt SỔ không trống vì một câu chưa hỏi. */}
          <span className={s.cot}>
            {nhip.length > 0 ? nhip.map((c) => {
              const k = KHUNG_CUA_NHIP[c];
              return (
                <span key={c}>
                  {k === undefined || k === null
                    ? <>{`“${c}” · `}<span className={s.mo}>{B.khongDo}</span></>
                    : <>{`${tenKhung[k]} `}<b>{giaTriKhung(k)}</b></>}
                </span>
              );
            }) : (['sau_tien_ve', 'cuoi_thang'] as const).map((k) => (
              <span key={k}>{`${tenKhung[k]} `}<b>{giaTriKhung(k)}</b></span>
            ))}
          </span>
        </Mat>
      </Cap>

      {!gonNguon && <div className={s.nhom}>{B.nhomTranDoi}</div>}
      <MatTrongTran
        noiGame={noiGame} nl={nl}
        hang={(n) => {
          /* ⚠ Năng lực vắng trong DTO ⇒ "—", không tự gán "chưa gặp": bậc là BẰNG CHỨNG của server, không đoán hộ (P7). */
          const dau = (id: NangLucId): React.ReactElement => {
            const x = n.nang_luc.find((y) => y.id === id && laIdKyNang(y.id));
            return x === undefined ? <span className={s.mo}>—</span> : <DauKyNangTinh id={id} bac={x.bac} />;
          };
          return (
            <>
              <Cap ten={B.capGiuSo} testid="cap-giu-so">
                <Mat tag={nhanTran} lop={s.tagTran}>{dau('cam_ket_tiet_kiem')}</Mat>
                <Mat tag={nhanSo} lop={s.tagSo}>
                  {so.giu.giu + so.giu.bo + so.giu.dangChay === 0 ? <span className={s.mo}>{B.giuChuaCo}</span> : (
                    <span className={s.cot}>
                      {so.giu.giu + so.giu.bo > 0 && (
                        <span>
                          <ODem n={so.giu.giu + so.giu.bo} co={so.giu.giu} />
                          {`${B.giuKhepPre}${so.giu.giu}${B.giuBoPre}${so.giu.bo}`}
                        </span>
                      )}
                      {so.giu.dangChay > 0 && (
                        <span>{`${B.giuChayPre}${so.giu.dangChay}${B.giuKhongChamPre}${so.giu.khongCham}`}</span>
                      )}
                      <span className={s.dongPhu}>
                        {`${B.giuRutPre}${so.giu.rut}${B.giuRutGiua}${SO_NGAY_BA_MAT}${B.giuRutHau}`}
                      </span>
                    </span>
                  )}
                </Mat>
              </Cap>
              <Cap ten={B.capLocTin} testid="cap-loc-tin">
                <Mat tag={nhanTran} lop={s.tagTran}>{dau('doc_tin')}</Mat>
                <Mat tag={nhanSo} lop={s.tagSo}>
                  {daXet.length === 0 ? <span className={s.mo}>{B.chuaXet}</span> : (
                    <span className={s.cot}>
                      {daXet.map((x) => (
                        <span key={x.chac}>
                          <ODem n={x.n} co={x.toi} />
                          {`${B.noiChacPre}${PFM.VI_THE_CHAC[x.chac]}%: ${x.toi}/${x.n}`}
                        </span>
                      ))}
                    </span>
                  )}
                </Mat>
              </Cap>
              <Cap ten={B.capChiaGio} testid="cap-chia-gio">
                <Mat tag={nhanTran} lop={s.tagTran}>{dau('phan_tan')}</Mat>
                <Mat tag={nhanSo} lop={s.tagSo}>
                  {so.gio.length === 0 ? <span className={s.mo}>{B.gioChuaCo}</span> : (
                    <span className={s.cot}>
                      <span>
                        {`${so.gio.length}${B.gioViTheHau}${B.gioLonNhatPre}${so.gio[0]!.ten} `}
                        <b>{phanTram(so.gio[0]!.phan)}</b>
                      </span>
                      <span className={s.thanh} aria-hidden="true">
                        {so.gio.map((x, i) => (
                          <i key={x.ten} className={s[`gio${(i % 3) + 1}`]} style={{ width: phanTram(x.phan) }} />
                        ))}
                      </span>
                    </span>
                  )}
                </Mat>
              </Cap>
            </>
          );
        }}
      />
      <p className={s.giai}>{gonNguon ? `${CB.guGiaiPre}${SO_NGAY_BA_MAT}${CB.guGiaiHau}` : `${B.baMatGiaiPre}${SO_NGAY_BA_MAT}${B.baMatGiaiHau}`}</p>
    </div>
  );
}

/**
 * ⭐ MẶT TRONG TRẬN (D324 → D426) — dời từ `Guong.tsx` (xuất lại ở đó, giữ tên). Ba trạng thái, ba câu — không trạng thái
 * nào giả vờ là trạng thái khác:
 *   · cửa `noi_game` đóng ⇒ nói mặt này ghép gì và bật ở đâu (tả trạng thái máy, A10);
 *   · chưa đề nào hợp lệ ⇒ nói thẳng, không vẽ dấu rỗng;
 *   · có đề ⇒ `hang(nl)` — nắp NÓI · LÀM · TRONG TRẬN ghép từng dấu với con số SỔ của cùng năng lực; vắng `hang` thì
 *     BA DẤU KỸ NĂNG cùng hình mặt THẺ như trước.
 * Dòng cuối luôn nói ngưỡng CHƯA HIỆU CHUẨN (Test A chưa chạy — tệp 10 §4.3).
 */
export function MatTrongTran({ noiGame, nl, hang }: {
  noiGame: boolean; nl: NangLucCuaToiDTO | undefined; hang?: (nl: NangLucCuaToiDTO) => React.ReactNode;
}): React.ReactElement {
  const NUT2 = `${g.nut2} ${g.khac}`;
  if (!noiGame) {
    return (
      <>
        <p className={g.chuThich}>{C.tranCuaDong}</p>
        <Link to={ROUTE_CAI_DAT} className={NUT2}>{C.tranDiCaiDat}</Link>
      </>
    );
  }
  if (!nl) return <p className={g.chuThich} aria-busy="true">…</p>;
  if (nl.so_de === 0) {
    return (
      <>
        <p className={g.chuThich}>{C.tranChuaDe}</p>
        <Link to={ROUTE_ARENA} className={NUT2}>{C.tranDiChoi}</Link>
      </>
    );
  }
  return (
    <>
      {hang ? hang(nl) : <HangKyNangNguoi nl={nl} />}
      <p className={g.chuThich}>{C.tranChuaHieuChuan}</p>
    </>
  );
}
