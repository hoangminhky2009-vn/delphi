/**
 * TRANG MỘT MỤC BÁCH KHOA (D334).
 *
 * Thứ tự khối (founder 14/09, ba lượt góp ý): một câu TO → lớp CỦA BẠN → dữ liệu trên bàn (lá vai · bảng đòn thẻ tin ·
 * phản ứng theo pha) → NGOÀI ĐỜI → VÌ SAO (chuỗi từng bước + "nhưng không phải lúc nào cũng vậy") → CHUYỆN ĐÃ XẢY RA →
 * TỪ ĐỜI VÀO BÀN (mỗi luật đi kèm lý do ngoài đời) → SỐ → LIÊN QUAN → GIÁO TRÌNH.
 *
 * ⚠ Luật màu (HUD 13/09): lam chỉ ở thứ chạm được (từ khoá, chip liên quan); xanh/đỏ chỉ ở tăng/giảm và mức
 * khoẻ/yếu; vàng không dùng (trang này không có tiền của ai). Khối ngăn bằng chiều sâu, không viền.
 * ⚠ A10: mô tả, không kê đơn — chữ ở `lib/bach_khoa`, bài quét ở `web/tests/bach_khoa.test.tsx`.
 */
import { Fragment, type ReactNode } from 'react';
import type { SoTayDTO } from '@/api/tinh_cach';
import type { CatalogBachKhoaDTO, DoGiaDTO } from '@/api/bach_khoa';
import type { MucDinhTinhDTO } from '@/api/holdem';
import { PixelIcon, type PixelIconName } from '@/components/ui/PixelIcon';
import { PixelLuoi } from '@/components/ui/PixelIcon';
import {
  LUOI_BACH_KHOA, MUC_BACH_KHOA, MUC_THEO_ID, NHOM_BACH_KHOA, giaiSo, tachDoan,
  type CapBK, type ChuoiBK, type MucBK, type NguonSo,
} from '@/lib/bach_khoa';
import { pctCuaBp } from '@/lib/khoanh_khac';
import { MUC_DINH_TINH } from '@/lib/muc_dinh_tinh';
import { TC_ICON, TC_TEN } from '@/lib/tinh_chat';
import s from './BachKhoa.module.css';

export function IconBK({ ten, size }: { ten: string; size: number }) {
  const luoi = LUOI_BACH_KHOA[ten];
  return luoi ? <PixelLuoi luoi={luoi} ten={ten} size={size} /> : <PixelIcon name={ten as PixelIconName} size={size} />;
}

/** Chữ có từ khoá bấm được + đoạn đậm — vẽ bằng React, không `innerHTML`. */
export function Chu({ s: chuoi, onMo }: { s: string; onMo: (id: string) => void }) {
  return (
    <>
      {tachDoan(chuoi).map((d, i) => {
        const trong = d.k === 'tu' && MUC_THEO_ID.has(d.id)
          ? <button key={i} type="button" className={s.tu} onClick={() => onMo(d.id)}>{d.s}</button>
          : <Fragment key={i}>{d.s}</Fragment>;
        return d.dam ? <b key={i}>{trong}</b> : trong;
      })}
    </>
  );
}

const CHU_DO_GIA: Record<DoGiaDTO, string> = {
  hiem: 'Thẻ này hiếm khi là tin giả.',
  it: 'Ít khi là tin giả.',
  vua: 'Bị làm giả ở mức chung của bàn.',
  hoi_hay: 'Bị làm giả thường hơn mức chung một chút.',
  hay: 'Bị làm giả thường hơn hẳn các thẻ khác.',
  theo_lai_suat: 'Độ giả đi theo lãi suất: tiền rẻ ít giả nhất, tiền đắt giả nhiều nhất.',
};

const LOAI_CAP: Record<'luat' | 'gon', string> = { luat: 'LUẬT CHƠI', gon: 'BÀN GỌN HƠN ĐỜI' };

function mucCua(dsCap: readonly (readonly [string, MucDinhTinhDTO])[] | undefined, id: string): MucDinhTinhDTO {
  return dsCap?.find((c) => c[0] === id)?.[1] ?? 'trung_tinh';
}

function ChipMuc({ nhan, muc }: { nhan: string; muc: MucDinhTinhDTO }) {
  const m = MUC_DINH_TINH[muc];
  return (
    <span className={s.chipMuc} data-muc={muc}>
      <span className={s.chipNhan}>{nhan}</span>
      <b className={s[m.lop]}>{m.dau} {m.chu}</b>
    </span>
  );
}

function ngayNgan(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Mục có lớp "bạn đã gặp" không, và gặp mấy lần — `null` = mục không đo được lớp này. */
export function lanGap(m: MucBK, soTay: SoTayDTO | undefined): number | null {
  // Không có sổ (khách, hoặc chưa xong trận nào) ⇒ KHÔNG có lớp này — "chưa gặp" chỉ nói được khi đã có sổ để đếm.
  if (!soTay || soTay.so_tran <= 0) return null;
  if (m.khoanhKhac) return soTay.khai_niem.find((k) => k.id === m.khoanhKhac)?.so_tran ?? 0;
  // `lien_he` vắng ở API cũ ⇒ không đếm được thẻ tin, im chứ không ghi "chưa gặp" oan.
  if (m.suKien) return soTay.lien_he ? (soTay.lien_he.find((l) => l.id === m.suKien)?.so_lan ?? 0) : null;
  return null;
}

function Khoi({ dau, children, chuThich }: { dau: string; children: ReactNode; chuThich?: string }) {
  return (
    <section className={s.khoi}>
      <h3 className={s.khoiDau}>{dau}</h3>
      {children}
      {chuThich && <p className={s.chuThich}>{chuThich}</p>}
    </section>
  );
}

function Chuoi({ c, onMo }: { c: ChuoiBK; onMo: (id: string) => void }) {
  return (
    <div className={s.chuoi}>
      <div className={s.chuoiTen}>{c.ten}</div>
      <ol className={s.buoc}>
        {c.buoc.map((b, i) => (
          <li key={i}><span className={s.nut} aria-hidden>{i + 1}</span><span><Chu s={b} onMo={onMo} /></span></li>
        ))}
      </ol>
      <div className={`${s.ket} ${c.huong === 'len' ? s.ketLen : c.huong === 'xuong' ? s.ketXuong : ''}`}>
        {c.huong === 'len' ? '▲ ' : c.huong === 'xuong' ? '▼ ' : '⇒ '}<Chu s={c.ket} onMo={onMo} />
      </div>
    </div>
  );
}

export function TrangMuc({ m, cat, soTay, nguon, onMo, onVe }: {
  m: MucBK;
  cat: CatalogBachKhoaDTO | undefined;
  soTay: SoTayDTO | undefined;
  nguon: NguonSo;
  onMo: (id: string) => void;
  onVe: () => void;
}) {
  const nhom = NHOM_BACH_KHOA.find(([id]) => id === m.nhom)?.[1] ?? '';
  const tenMa = (id: string) => cat?.tai_san.find((t) => t.id === id)?.label ?? id;
  const tenSk = (id: string) => cat?.su_kien.find((x) => x.id === id)?.label ?? id;
  const tenGd = (id: string) => cat?.giai_doan.find((x) => x.id === id)?.label ?? id;
  const theTin = m.suKien ? cat?.bach_khoa?.the_tin[m.suKien] : undefined;
  const mucTheoSk = (skId: string, maId: string) => mucCua(cat?.tu_dien.tai_san[maId]?.su_kien, skId);
  const mucSkCuaMuc = (skId: string) => MUC_BACH_KHOA.find((x) => x.suKien === skId);

  const gap = lanGap(m, soTay);
  const kn = m.khoanhKhac ? soTay?.khai_niem.find((k) => k.id === m.khoanhKhac) : undefined;
  const lh = m.suKien ? soTay?.lien_he?.find((l) => l.id === m.suKien) : undefined;

  /** Vế BÀN của một cặp — `null` = thiếu dữ liệu, cả cặp ẩn. */
  const veBan = (c: CapBK): ReactNode | null => {
    if (c.muc) {
      if (!cat) return null;
      const r = c.muc;
      if (r.loai === 'sk_ma') return <span className={s.dayChip}>{r.ma.map((ma) => <ChipMuc key={ma} nhan={tenMa(ma)} muc={mucTheoSk(r.sk, ma)} />)}</span>;
      if (r.loai === 'ma_sk') return <span className={s.dayChip}>{r.sk.map((sk) => <ChipMuc key={sk} nhan={tenSk(sk)} muc={mucTheoSk(sk, r.ma)} />)}</span>;
      return <span className={s.dayChip}>{r.gd.map((gd) => <ChipMuc key={gd} nhan={tenGd(gd)} muc={mucCua(cat.tu_dien.tai_san[r.ma]?.giai_doan, gd)} />)}</span>;
    }
    if (c.luatThe) {
      if (!theTin) return null;
      if (c.luatThe === 'bao_truoc') return <>Thẻ thật báo trước ô kế nghiêng về <b>{tenGd(theTin.bao_truoc)}</b>.</>;
      if (c.luatThe === 'do_gia') return <>{CHU_DO_GIA[theTin.do_gia]}</>;
      if (c.luatThe === 'tinh_chat') {
        const icon = TC_ICON[theTin.tinh_chat];
        return <>{icon && <PixelIcon name={icon} size={16} className={s.iconDong} />} Huy hiệu <b>{TC_TEN[theTin.tinh_chat] ?? theTin.tinh_chat}</b>.</>;
      }
      if (theTin.keo_theo.length === 0) return null;
      return (
        <>Hay kéo theo:{' '}
          {theTin.keo_theo.map((sk, i) => {
            const dich = mucSkCuaMuc(sk);
            return (
              <Fragment key={sk}>
                {i > 0 && ' · '}
                {dich ? <button type="button" className={s.tu} onClick={() => onMo(dich.id)}>{tenSk(sk)}</button> : tenSk(sk)}
              </Fragment>
            );
          })}.
        </>
      );
    }
    if (c.ban === undefined) return null;
    const giai = giaiSo(c.ban, nguon);
    return giai === null ? null : <Chu s={giai} onMo={onMo} />;
  };

  const dsCap = m.doiBan.map((c) => ({ c, ban: veBan(c) })).filter((x) => x.ban !== null);
  const dsSo = (m.so ?? []).map(([a, b]) => [giaiSo(a, nguon), giaiSo(b, nguon)] as const)
    .filter((r): r is readonly [string, string] => r[0] !== null && r[1] !== null);
  const dsChuoi = m.chuoi === undefined ? [] : Array.isArray(m.chuoi) ? m.chuoi as readonly ChuoiBK[] : [m.chuoi as ChuoiBK];
  const vai = m.vai ? cat?.vai?.[m.vai] : undefined;

  return (
    <article className={s.trang} data-testid="muc-bach-khoa" data-muc={m.id}>
      <div className={s.thanh}>
        <button type="button" className={s.lui} onClick={onVe} aria-label="Về bách khoa">‹ BÁCH KHOA</button>
        <span className={s.thanhNhom}>{nhom}</span>
      </div>

      <header className={s.hero}>
        <span className={s.heroIcon}><IconBK ten={m.icon} size={48} /></span>
        <div>
          <h2 className={s.heroTen}>{m.ten}</h2>
          <div className={s.heroAnh}>{m.anh}</div>
          {gap !== null && gap > 0 && <div className={s.the} data-testid="da-gap">ĐÃ GẶP ×{gap}</div>}
        </div>
      </header>

      <p className={s.motCau}>{m.nhac}</p>

      {(kn || (lh && lh.so_lan + lh.so_lan_gia > 0)) && (
        <Khoi dau="CỦA BẠN">
          <div className={s.cuaBan}>
            {kn && (
              <>
                <span>{kn.so_tran} trận{ngayNgan(kn.lan_dau) ? ` · lần đầu ${ngayNgan(kn.lan_dau)}` : ''}</span>
                <span>nặng nhất <b className={kn.manh_nhat.delta_bp < 0 ? s.xau1 : s.tot1}>{pctCuaBp(kn.manh_nhat.delta_bp)}</b> (vòng {kn.manh_nhat.vong})</span>
              </>
            )}
            {lh && <span>sống qua thẻ thật ×{lh.so_lan}{lh.so_lan_gia > 0 ? ` · gặp dạng tin giả ×${lh.so_lan_gia}` : ''}</span>}
          </div>
        </Khoi>
      )}

      {vai && (
        <Khoi dau="LÁ VAI TRÊN BÀN">
          <div className={s.laVai}>
            <div className={s.laVaiTen}>{vai.ten}</div>
            <dl className={s.laVaiDong}>
              <dt>QUYỀN</dt><dd>{vai.dac_quyen}</dd>
              <dt>GIÁ</dt><dd>{vai.cai_gia}</dd>
              <dt>VỐN</dt><dd>{vai.he_so_von === 1 ? 'vốn cơ bản' : `gấp ${vai.he_so_von} lần vốn cơ bản`}</dd>
              <dt>LÕI GHIM</dt><dd>{vai.loi_ghim ? (cat?.chien_thuat.find((x) => x.id === vai.loi_ghim)?.label ?? vai.loi_ghim) : 'không — tự chọn'}</dd>
            </dl>
          </div>
        </Khoi>
      )}

      {m.suKien && cat && (
        <Khoi dau="LÚC THẺ NỔ" chuThich="Cùng thang với tờ (!) trong trận — mức, không phải phần trăm.">
          {theTin && (
            <div className={s.dongLuat}>
              {TC_ICON[theTin.tinh_chat] && <PixelIcon name={TC_ICON[theTin.tinh_chat]!} size={16} className={s.iconDong} />}
              <span>{TC_TEN[theTin.tinh_chat] ?? theTin.tinh_chat}</span>
              <span className={s.cham}>·</span>
              <span>báo trước {tenGd(theTin.bao_truoc)}</span>
            </div>
          )}
          <div className={s.bangDon} data-testid="bang-don">
            {cat.tai_san.map((t) => <ChipMuc key={t.id} nhan={t.label} muc={mucTheoSk(m.suKien!, t.id)} />)}
          </div>
        </Khoi>
      )}

      {m.ma && cat && cat.tu_dien.tai_san[m.ma] && (
        <Khoi dau="THEO TỪNG PHA" chuThich="Cùng thang với tờ (!) trong trận — mức, không phải phần trăm.">
          <div className={s.bangDon}>
            {cat.giai_doan.map((g) => <ChipMuc key={g.id} nhan={g.label} muc={mucCua(cat.tu_dien.tai_san[m.ma!]?.giai_doan, g.id)} />)}
          </div>
        </Khoi>
      )}

      <Khoi dau="NGOÀI ĐỜI">
        <p className={s.ngoai}><Chu s={m.ngoai} onMo={onMo} /></p>
        {m.viDu && <p className={s.viDu}><Chu s={m.viDu} onMo={onMo} /></p>}
      </Khoi>

      {(dsChuoi.length > 0 || m.nhung) && (
        <Khoi dau="VÌ SAO">
          <div className={dsChuoi.length > 1 ? s.haiCot : undefined}>
            {dsChuoi.map((c) => <Chuoi key={c.ten} c={c} onMo={onMo} />)}
          </div>
          {m.nhung && (
            <div className={s.nhung}>
              <div className={s.nhungDau}>NHƯNG KHÔNG PHẢI LÚC NÀO CŨNG VẬY</div>
              <p><Chu s={m.nhung} onMo={onMo} /></p>
            </div>
          )}
        </Khoi>
      )}

      {m.chuyen && m.chuyen.length > 0 && (
        <Khoi dau="CHUYỆN ĐÃ XẢY RA">
          {m.chuyen.map((c) => (
            <div key={c.nam + c.noi} className={s.chuyen}>
              <div className={s.chuyenDau}><b>{c.nam}</b><span>{c.noi}</span></div>
              <p><Chu s={c.cau} onMo={onMo} /></p>
              {c.so && c.so.length > 0 && (
                <div className={s.chuyenSo}>
                  {c.so.map(([nhan, gt, huong]) => (
                    <span key={nhan}>{nhan} <b className={huong === 'len' ? s.tot1 : huong === 'xuong' ? s.xau1 : undefined}>{huong === 'len' ? '▲ ' : huong === 'xuong' ? '▼ ' : ''}{gt}</b></span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Khoi>
      )}

      {dsCap.length > 0 && (
        <Khoi dau="TỪ ĐỜI VÀO BÀN">
          <ul className={s.dsCap}>
            {dsCap.map(({ c, ban }, i) => (
              <li key={i} className={s.cap} data-loai={c.loai ?? 'doi'}>
                {c.loai && <span className={s.theCap}>{LOAI_CAP[c.loai]}</span>}
                <div className={s.veDoi}><span className={s.nhanVe}>ĐỜI</span><span><Chu s={c.doi} onMo={onMo} /></span></div>
                <div className={s.veBan}><span className={s.nhanVe}>BÀN</span><span>{ban}</span></div>
              </li>
            ))}
          </ul>
        </Khoi>
      )}

      {dsSo.length > 0 && (
        <Khoi dau="SỐ" chuThich="Đọc thẳng từ bộ luật đang chạy.">
          <table className={s.bangSo}><tbody>
            {dsSo.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}
          </tbody></table>
        </Khoi>
      )}

      {m.lq.length > 0 && (
        <Khoi dau="LIÊN QUAN">
          <div className={s.lienQuan}>
            {m.lq.map((id) => MUC_THEO_ID.get(id)).filter((x): x is MucBK => x !== undefined).map((x) => (
              <button key={x.id} type="button" className={s.chipLq} onClick={() => onMo(x.id)}>
                <IconBK ten={x.icon} size={16} /> {x.ten}
              </button>
            ))}
          </div>
        </Khoi>
      )}

      <Khoi dau="GIÁO TRÌNH"><p className={s.giaoTrinh}>{m.khung}</p></Khoi>
    </article>
  );
}
