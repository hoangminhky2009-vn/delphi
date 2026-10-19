/**
 * MÀN ĐIỀU PHỐI BUỔI ĐO — `/buoi-do` (D333).
 *
 * ─── VÌ SAO CÓ ───────────────────────────────────────────────────────────────
 * D332 chốt người trả tiền đầu tiên là TỔ CHỨC chạy chương trình giáo dục tài chính, và thứ họ nhận là
 * một BUỔI ĐO: cả nhóm cùng một đề → mỗi người một thẻ → tổ chức một bức tranh nhóm. D329 dựng đủ các cửa
 * server nhưng để người điều phối gõ `fetch` trong console, với điều kiện kích hoạt *"người điều phối đầu
 * tiên không phải founder"*. Buổi đo 20 người trước 30/09 do người khác tổ chức ⇒ điều kiện đã tới.
 * Màn này vì thế làm hai việc một lúc: là công cụ của người điều phối, và là thứ duy nhất trong app cho
 * thấy TỔ CHỨC nhận được gì.
 *
 * ─── LUẬT ────────────────────────────────────────────────────────────────────
 * · MÀN CHỈ HIỆN (C4). Ai được xem, bàn nào của ai, bức tranh khi nào mở, sàn mẫu, làm tròn — server canh
 *   hết (`tests/ban_buoi_do.test.ts`, `tests/ban_buoi_do_ds.test.ts`). Client không chép lại một luật nào,
 *   kể cả regex nhãn: gõ sai thì đọc câu server trả.
 * · KHÔNG MỘT DÒNG THEO NGƯỜI. Danh sách chỉ có hai số đếm; bức tranh chỉ có tỷ lệ.
 * · BA BẬC LÀ BẰNG CHỨNG, KHÔNG PHẢI ĐIỂM (D323): màu theo vai của ba dấu kỹ năng — vàng là đã có, nửa vàng
 *   là chưa vững, rãnh trống là chưa gặp. Không đỏ, không xanh: không có gì thắng thua ở đây.
 * · CHỮ Ở `lib/buoi_do_chu.ts` (D26), tên năng lực ở `lib/nang_luc.ts` — một nguồn với mặt THẺ.
 * ⚠ A11.25: màn này dựng thẳng trên code, không qua demo HTML — theo chỉ thị founder cùng phiên (*"không cần
 *   dựng demo, chỉnh luôn trên bản local"*) và hạn nộp 30/09; ghi ở D333, soi trên trình duyệt trước commit.
 */
import { useState } from 'react';
import { ApiError } from '@/api/client';
import {
  linkBan, useDongBuoiDo, useDsBuoiDo, useNhomBuoiDo, useTaoBuoiDo,
  type BanBuoiDoDTO,
} from '@/api/holdem';
import { AuthGate } from '@/components/AuthGate';
import { ScreenFrame } from '@/components/ScreenFrame';
import { Field, NeonButton } from '@/components/ui';
import { CHU_DIEU_PHOI as C } from '@/lib/buoi_do_chu';
import { CHU_NANG_LUC, TEN_NANG_LUC } from '@/lib/nang_luc';
import s from './BuoiDo.module.css';

export function BuoiDo() {
  return (
    <AuthGate>
      <BuoiDoRuot />
    </AuthGate>
  );
}

function BuoiDoRuot() {
  const ds = useDsBuoiDo();

  if (ds.isPending) {
    return <ScreenFrame title={C.tieuDe} live><p className={s.phu} aria-busy="true">…</p></ScreenFrame>;
  }
  if (ds.error instanceof ApiError && ds.error.code === 'khong_phai_dieu_phoi') {
    return (
      <ScreenFrame title={C.tieuDe} live>
        <p className={s.dan} data-testid="khong-quyen-dieu-phoi">{C.khongQuyen}</p>
      </ScreenFrame>
    );
  }
  if (ds.isError || !ds.data) {
    return (
      <ScreenFrame title={C.tieuDe} live>
        <p className={s.dan} role="alert">{C.loiTai}</p>
        <NeonButton variant="ghost" onClick={() => void ds.refetch()}>↻</NeonButton>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title={C.tieuDe} live>
      <p className={s.dan}>{C.dan}</p>
      <TaoBuoiDo de={ds.data.de} />
      <section className={s.ds} aria-label={C.dsTieuDe}>
        <h2 className={s.nhanKhoi}>{C.dsTieuDe}</h2>
        {ds.data.ban.length === 0
          ? <p className={s.phu}>{C.dsRong}</p>
          : ds.data.ban.map((b) => <DongBan key={b.ma} b={b} />)}
      </section>
    </ScreenFrame>
  );
}

/** Tấm NỔI — thứ bấm được của màn (luật HUD: hành động là tầng nổi, bối cảnh là giếng lõm). */
function TaoBuoiDo({ de }: { de: { id: string; so_o: number }[] }) {
  const tao = useTaoBuoiDo();
  const [deId, setDeId] = useState<string>(de[0]?.id ?? '');
  const [nhan, setNhan] = useState('');
  const nhanGui = nhan.trim().toLowerCase();
  const loi = tao.error instanceof ApiError ? tao.error.message : tao.error ? C.loiTai : undefined;

  return (
    <section className={s.tao} aria-label={C.taoTieuDe}>
      <h2 className={s.nhanKhoi}>{C.taoTieuDe}</h2>
      <div className={s.nhanO} id="bd-de-nhan">{C.nhanDe}</div>
      <div className={s.chonDe} role="radiogroup" aria-labelledby="bd-de-nhan">
        {de.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={deId === d.id}
            className={`${s.de} ${deId === d.id ? s.deChon : ''}`}
            onClick={() => setDeId(d.id)}
          >
            {C.tenDe[d.id] ?? d.id.toUpperCase()} · {d.so_o}{C.oSau}
          </button>
        ))}
      </div>
      <p className={s.phu}>{C.deGiai}</p>
      <Field
        id="bd-nhan"
        label={C.nhanNhom}
        placeholder={C.nhanNhomGoiY}
        value={nhan}
        onChange={(e) => { setNhan(e.target.value); if (tao.isError) tao.reset(); }}
        hint={C.nhanNhomGiai}
        error={loi}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <NeonButton
        block
        disabled={!nhanGui || !deId || tao.isPending}
        onClick={() => tao.mutate({ de_id: deId, nhan: nhanGui }, { onSuccess: () => setNhan('') })}
      >
        {tao.isPending ? C.dangTao : C.nutTao}
      </NeonButton>
    </section>
  );
}

function DongBan({ b }: { b: BanBuoiDoDTO }) {
  const dong = useDongBuoiDo();
  /** Đóng là một chiều (bàn không mở lại được) ⇒ hai lần bấm, không hộp thoại. */
  const [chacDong, setChacDong] = useState(false);
  const [moNhom, setMoNhom] = useState(false);
  const [daChep, setDaChep] = useState(false);

  async function chiaSe(): Promise<void> {
    const url = linkBan(b.ma);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'DELPHI · Buổi đo', text: C.chiaSeChu, url });
        return;
      }
    } catch { /* người dùng huỷ ⇒ rơi xuống chép */ }
    try {
      await navigator.clipboard.writeText(`${C.chiaSeChu} ${url}`);
      setDaChep(true);
    } catch { /* không chép được — mã bàn vẫn in to ngay trên */ }
  }

  return (
    <article className={s.ban} data-ma={b.ma} data-da-dong={b.da_dong}>
      <div className={s.banDau}>
        <span className={s.banNhan}>{b.nhan ?? b.ma}</span>
        <span className={`${s.trangThai} ${b.da_dong ? '' : s.trangThaiMo}`}>{b.da_dong ? C.daDong : C.dangMo}</span>
      </div>
      <div className={s.banMa}>
        <span className={s.nhanO}>{C.ma}</span>
        <b className={s.ma}>{b.ma.toUpperCase()}</b>
      </div>
      <div className={s.dem} data-testid="dem-buoi-do">
        <b>{b.so_nguoi}</b>{C.daVaoHau}<span className={s.cham}> · </span><b>{b.so_xong}</b>{C.daXongHau}
      </div>
      {!b.da_dong && (
        <>
          <div className={s.hangNut}>
            <NeonButton variant="ghost" onClick={() => void chiaSe()}>{daChep ? C.daChep : C.nutChiaSe}</NeonButton>
            <NeonButton
              variant="ghost"
              disabled={dong.isPending}
              onClick={() => { if (!chacDong) { setChacDong(true); return; } dong.mutate(b.ma); }}
            >
              {chacDong ? C.nutDongChac : C.nutDong}
            </NeonButton>
          </div>
          {chacDong && <p className={s.phu}>{C.dongGiai}</p>}
        </>
      )}
      {b.da_dong && (
        <NeonButton variant="ghost" aria-expanded={moNhom} onClick={() => setMoNhom((x) => !x)}>
          {C.nutNhom} {moNhom ? '▴' : '▾'}
        </NeonButton>
      )}
      {b.da_dong && moNhom && <BucTranhNhom ma={b.ma} />}
    </article>
  );
}

/** Bức tranh nhóm — thứ DUY NHẤT tổ chức nhận (D329 §4.2). */
function BucTranhNhom({ ma }: { ma: string }) {
  const q = useNhomBuoiDo(ma, true);
  if (q.isPending) return <p className={s.phu} aria-busy="true">…</p>;
  if (q.isError || !q.data) return <p className={s.phu} role="alert">{C.loiTai}</p>;
  const d = q.data;

  return (
    <div className={s.nhom} data-testid="buc-tranh-nhom">
      <div className={s.nhanKhoi}>{C.nhomTieuDe}</div>
      <p className={s.phu}>{C.nhomNPre}<b className={s.soSang}>{d.n}</b>{C.nhomSanPre}{d.san}</p>
      {!d.du_mau || !d.nang_luc ? (
        <p className={s.phu} data-testid="nhom-chua-du">{C.nhomChuaDu}</p>
      ) : (
        <ul className={s.nangLuc}>
          {d.nang_luc.map((nl) => {
            const ten = TEN_NANG_LUC[nl.id];
            return (
              <li key={nl.id} className={s.nl} data-nang-luc={nl.id}>
                <div className={s.nlTen}>{ten.ten}</div>
                <div className={s.khung}>{CHU_NANG_LUC.khungPre}{ten.khung.oecd}</div>
                {/*
                  Tỷ lệ đã làm tròn tới 5% nên ba số có thể cộng ra 95 hay 105 — vạch dùng `flex-grow` theo số
                  để luôn lấp đúng một thanh, còn con số in bên dưới là số server trả, không sửa cho tròn 100.
                */}
                <div
                  className={s.thanh}
                  role="img"
                  aria-label={`${ten.ten}: ${C.bacLamDuoc} ${nl.pct.lam_duoc}%, ${C.bacChuaVung} ${nl.pct.gap_chua_vung}%, ${C.bacChuaGap} ${nl.pct.chua_gap}%`}
                >
                  <i className={s.vLamDuoc} style={{ flexGrow: nl.pct.lam_duoc }} />
                  <i className={s.vChuaVung} style={{ flexGrow: nl.pct.gap_chua_vung }} />
                  <i className={s.vChuaGap} style={{ flexGrow: nl.pct.chua_gap }} />
                </div>
                <div className={s.nlSo}>
                  <span className={s.soLamDuoc}><b>{nl.pct.lam_duoc}%</b> {C.bacLamDuoc}</span>
                  <span><b>{nl.pct.gap_chua_vung}%</b> {C.bacChuaVung}</span>
                  <span><b>{nl.pct.chua_gap}%</b> {C.bacChuaGap}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ul className={s.phuongPhap}>
        {C.phuongPhap.map((x) => <li key={x}>{x}</li>)}
      </ul>
    </div>
  );
}
