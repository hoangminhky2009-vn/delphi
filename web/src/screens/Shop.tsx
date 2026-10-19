/**
 * TAB SHOP — HAI QUẦY, HAI LOẠI XU, KHÔNG ĐƯỜNG NÀO NỐI CHÚNG.
 *
 *   QUẦY NIÊM YẾT (Q):  ảnh đại diện · khung viền — giá biết trước khi bấm.
 *   HỘP PHONG CÁCH (T): nhãn dán — ngẫu nhiên, tỷ lệ công khai, đốt 100% token.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BỐN THỨ MÀN NÀY PHẢI HIỆN VÔ ĐIỀU KIỆN, KHÔNG ĐƯỢC THU GỌN (D25/R1)
 *
 * Luật R1: field nào server ghi là "đã cho người chơi thấy" thì phải render tại
 * đúng thời điểm quyết định — không accordion, không tooltip, không dưới màn cuộn.
 * Ở cửa này có bốn thứ như vậy:
 *
 *   1. TỶ LỆ RƠI từng bậc. Đã công bố thì phải nằm cạnh nút mở, không phải trong
 *      một trang "chi tiết" mà 95% người không mở.
 *   2. MỐC BẢO HIỂM đang ở đâu (x/20 lượt). Nó là lý do người ta bấm lượt tiếp.
 *   3. SỐ BẢN CÒN LẠI của món hữu hạn. Không hiện thì việc bậc epic cạn hàng biến
 *      "tỷ lệ 5%" thành nửa sự thật, dù server không hề gian.
 *   4. SỐ DƯ SAU KHI MỞ. `du_t` là trường đắt nhất của event `gacha_mo` (ai đang
 *      đổi vốn dự báo lấy ngoại hình); ghi mà không cho người chơi thấy chính con
 *      số đó là đo một quyết định họ ra trong bóng tối.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TƯỜNG LỬA (A3.5) — LUẬT CỦA FILE NÀY, KHÔNG ĐỔI TỪ BẢN TRƯỚC:
 *
 *   Màn Shop TUYỆT ĐỐI không import gì từ `@/api/holdem` hay `@/api/arena`.
 *
 * Vốn/Quỹ vòng trong trận là điểm ảo, reset mỗi trận, KHÔNG rời trận. Shop tiêu
 * token T và điểm quest Q — hai thứ có sổ cái thật. Một dòng import nối chúng là
 * mầm của đúng đường mà tường lửa cấm vĩnh viễn (`tests/holdem_firewall.test.ts`).
 *
 * ⚠ C4: mọi con số ở đây là số SERVER trả về. Màn không tự tính số dư sau khi mua,
 * không tự tính điều kiện mở hộp, không tự đoán món sẽ rơi.
 */
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { choApi, type BanTheCuaToi, type BanTheTrenQuay } from '../api/cho';
import { veAvatarSVG, veDanSVG } from '@config/avatar_art';
import { vietDienMao } from '@config/avatar';
import { shopApi, type KetQuaHop, type MonBanQ, type MonTrongHop } from '@/api/shop';
import { queryKeys } from '@/api/queries';
import { formatT } from '@/lib/money';
import { AuthGate } from '@/components/AuthGate';
import { PixelIcon, TerminalCard } from '@/components/ui';
import { HopVo } from '@/components/shop/HopVo';
import px from '@/styles/pixel.module.css';
import s from './Shop.module.css';
import { htmlTinh } from '@/lib/html_tinh';

/**
 * TÊN BẬC HIỂN THỊ — chữ ở client, id máy ở server (D26).
 *
 * ⚠ `epic` là id trong CHECK của DB và trong dữ liệu prod; người chơi CHƯA BAO
 * GIỜ thấy chữ đó. Nên đổi cảm giác của bậc cao nhất tốn đúng từ điển này —
 * 0 migration, 0 server. Đó cũng là lý do luật "server trả ID + SỐ" đáng giá:
 * một quyết định thương hiệu không được phép trở thành một cú migrate.
 *
 * "CỰC HIẾM" → **KIỆT TÁC** (founder giao tự quyết 06/09, D296). Lý do: "cực
 * hiếm" là một MỨC ĐỘ ("hiếm" + trạng từ), không phải một DANH TÍNH — bậc cao
 * nhất của một bộ sưu tầm cần một cái tên. Chọn đăng ký NGHỆ THUẬT vì thứ đắt
 * nhất của bậc này đúng là art (A11.14), nên cái tên nên nói đúng thứ đã trả giá.
 *
 * ⚠ ĐÂY CHỈ LÀ MỘT TRONG HAI TRỤC. Trục còn lại — **số bản** (`1/1`, `#7/50`) —
 * là thứ chữ "one-of-a-kind" thuộc về, và nó CHƯA có đường hiển thị: dữ liệu đã
 * có (`vat_pham_ban_the.seri` + `dot_phat_hanh.han_muc`) nhưng chưa route nào
 * trả ra, và hôm nay chưa mẫu nào giới hạn nên chưa có gì để hiện. Mốc M3.
 * Demo đã chốt hình dạng: `docs/ui-ux/demo/bac-hiem-va-doc-ban.html`.
 */
const TEN_BAC: Record<string, string> = {
  thuong: 'THƯỜNG', hiem: 'HIẾM', epic: 'KIỆT TÁC',
};

/** Ảnh món — dựng từ chính lưới pixel của repo, không phải file ảnh rời. */
function AnhMon({ mon }: { mon: { id: string; loai?: string; ma?: string | null } }) {
  const svg = mon.loai === 'khung'
    ? veAvatarSVG(vietDienMao({ goc: 'A', khung: mon.id }))
    : mon.loai === 'nen'
      ? veAvatarSVG(vietDienMao({ goc: mon.ma ?? 'A' }))
      : veDanSVG(mon.id);
  return (
    <span
      className={s.anh}
      aria-hidden="true"
      dangerouslySetInnerHTML={htmlTinh(svg)}
    />
  );
}

function DongQ({
  mon, dangMua, onMua, chuaDinhGia,
}: {
  mon: MonBanQ;
  dangMua: boolean;
  onMua: () => void;
  chuaDinhGia: boolean;
}) {
  /*
   * Ba trạng thái khác nhau và chúng KHÔNG được trông giống nhau: mua được · đã có
   * (khung: hết chuyện) · chưa mở bán (nền: bản sao chưa có giá — founder chưa chốt,
   * xem `GIA_BAN_SAO_THEM`). Gộp hai trạng thái sau thành một ổ khoá trơn là bắt
   * người chơi đoán, và họ sẽ đoán "sắp có".
   */
  const muaDuoc = mon.song && mon.gia !== null;
  return (
    <div className={`${s.o} ${muaDuoc ? '' : s.oMo}`} data-mon={mon.id}>
      <AnhMon mon={mon} />
      <span className={s.oChu}>
        <span className={s.oTen}>
          {mon.ten}
          {mon.phien_ban ? <em className={s.banPhat}>{mon.phien_ban}</em> : null}
        </span>
        <span className={s.oMoTa}>
          {mon.loai === 'nen'
            ? 'Ảnh đại diện. Mỗi tấm dán nhãn xong là một tác phẩm riêng.'
            : 'Viền quanh ảnh đại diện — tháo ra lắp vào tuỳ ý, không mất đi.'}
        </span>
      </span>
      <span className={s.oPhai}>
        {muaDuoc ? (
          <>
            <span className={s.gia} data-gia>{mon.gia} Q</span>
            <button
              type="button"
              className={`${px.nut} ${px.nutChinh} ${s.nut}`}
              onClick={onMua}
              disabled={dangMua}
            >
              {dangMua ? 'ĐANG GỬI' : 'ĐỔI'}
            </button>
          </>
        ) : (
          <span className={s.khoa}>
            <PixelIcon name="lock" size={16} />
            <span className={s.oCho}>
              {mon.da_so_huu && mon.mua_lai_duoc && chuaDinhGia
                ? 'Bản thứ hai chưa mở bán'
                : mon.da_so_huu ? 'Đã có trong bộ sưu tập' : 'Ngừng bán'}
            </span>
          </span>
        )}
      </span>
    </div>
  );
}

function DongHop({ mon }: { mon: MonTrongHop }) {
  return (
    <div className={`${s.oNho} ${mon.song ? '' : s.oMo}`} data-hop-mon={mon.id}>
      <AnhMon mon={mon} />
      <span className={s.oChu}>
        <span className={s.oTenNho}>{mon.ten}</span>
        <span className={s.oMoTa}>{mon.ghi_chu}</span>
      </span>
      <span className={s.oPhai}>
        <span className={`${s.bac} ${s[`bac_${mon.hiem}`] ?? ''}`}>{TEN_BAC[mon.hiem]}</span>
        {/* Số bản còn lại: hiện vô điều kiện với món hữu hạn (R1, luật 3 ở đầu file). */}
        {mon.con_lai === null ? null : (
          <span className={s.conLai} data-con-lai={mon.id}>
            còn {mon.con_lai} bản
          </span>
        )}
      </span>
    </div>
  );
}

function KhoCuaToi({ onXong, onLoi }: { onXong: () => Promise<void>; onLoi: (m: string | null) => void }) {
  const qc = useQueryClient();
  // retry: false — 403 "chợ chưa mở" là câu trả lời, không phải sự cố mạng.
  const kho = useQuery({ queryKey: ['cho-cua-toi'], queryFn: choApi.cuaToi, retry: false });
  const ban = useMutation({
    mutationFn: choApi.ban,
    onSuccess: async () => {
      onLoi(null);
      await Promise.all([qc.invalidateQueries({ queryKey: ['cho-cua-toi'] }), onXong()]);
    },
    onError: (e: Error) => onLoi(e.message),
  });
  const d = kho.data;
  if (d === undefined) return null;

  // Gom theo mẫu để vẽ, nhưng nút bán TỪNG bản — seri là danh tính (M1 sổ vật).
  const theoMau = new Map<string, BanTheCuaToi[]>();
  for (const m of d.mon) theoMau.set(m.mau_id, [...(theoMau.get(m.mau_id) ?? []), m]);

  return (
    <>
      <div className={s.nhomNhan}>KHO CỦA TÔI — BÁN CHO HỆ THỐNG</div>
      <TerminalCard>
        {theoMau.size === 0 ? (
          <p className={s.chanNho} data-kho-rong>Chưa có nhãn dán nào để bán.</p>
        ) : (
          <div className={s.luoi} data-kho-cua-toi>
            {[...theoMau.entries()].map(([mauId, ds]) => (
              <div key={mauId} className={s.oChu} data-mau={mauId}>
                <span className={s.oTen}>{ds[0]!.ten}</span>
                <span className={s.oMoTa}>
                  {ds[0]!.ly_do === 'khong_ban_lai' ? (
                    <>Hệ thống <b>không mua lại</b> món này — nó không có cửa mua bằng T.</>
                  ) : (
                    <>
                      Hệ thống trả <b>{formatT(ds[0]!.gia)}</b> mỗi bản
                      {ds[0]!.mo ? '' : ' — hiện KHÔNG mua (quỹ chợ không đủ)'}
                    </>
                  )}
                </span>
                {ds.map((m) => (
                  <button
                    key={m.ban_the_id}
                    type="button"
                    className={s.nut}
                    data-ban={m.ban_the_id}
                    disabled={!m.mo || ban.isPending}
                    onClick={() => ban.mutate(m.ban_the_id)}
                  >
                    {ban.isPending && ban.variables === m.ban_the_id ? 'ĐANG BÁN' : `BÁN #${m.seri} · ${formatT(m.gia)}`}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className={s.chanNho}>
          Bán là bán cho Hệ thống, tiền vào ví ngay theo giá niêm yết — không chờ ai mua.
          Giá tụt dần khi kho Hệ thống đã có nhiều bản cùng mẫu. Quỹ chợ hiện có <b>{formatT(d.quy_cho)}</b>.
        </p>
      </TerminalCard>
    </>
  );
}

/**
 * QUẦY HỆ THỐNG — mua lại một bản đang nằm trong kho (B7b, mốc M2).
 *
 * ⚠ Màn KHÔNG tính gì: giá, `mo`, và cả câu "vì sao không mua được" đều suy từ
 * số server trả (C4). `mo = false` gộp ba lý do khác nhau (giá 0 · ví thiếu ·
 * mua xong tụt dưới lưới trợ cấp) — màn phân biệt được HAI cái đầu bằng số nó
 * đã có trong tay, và để cái thứ ba cho server nói khi bấm. Đoán lý do thứ ba ở
 * đây là chép luật `SUBSIDY_THRESHOLD` sang client, đúng thứ D61 cấm.
 *
 * Chợ tắt ⇒ 403 ⇒ query lỗi ⇒ không vẽ gì. Không có nút chết trên prod.
 */
function QuayHeThong({ onXong, onLoi }: { onXong: () => Promise<void>; onLoi: (m: string | null) => void }) {
  const qc = useQueryClient();
  const quay = useQuery({ queryKey: ['cho-quay'], queryFn: choApi.quay, retry: false });
  const mua = useMutation({
    mutationFn: choApi.mua,
    onSuccess: async () => {
      onLoi(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['cho-quay'] }),
        qc.invalidateQueries({ queryKey: ['cho-cua-toi'] }),
        onXong(),
      ]);
    },
    onError: (e: Error) => onLoi(e.message),
  });
  const d = quay.data;
  if (d === undefined) return null;

  const theoMau = new Map<string, BanTheTrenQuay[]>();
  for (const m of d.mon) theoMau.set(m.mau_id, [...(theoMau.get(m.mau_id) ?? []), m]);

  return (
    <>
      <div className={s.nhomNhan}>QUẦY HỆ THỐNG — MUA LẠI</div>
      <TerminalCard>
        {theoMau.size === 0 ? (
          <p className={s.chanNho} data-quay-rong>
            Hệ thống chưa giữ bản nào. Quầy chỉ có hàng khi có người bán vào.
          </p>
        ) : (
          <div className={s.luoi} data-quay-he-thong>
            {[...theoMau.entries()].map(([mauId, ds]) => (
              <div key={mauId} className={s.oChu} data-quay-mau={mauId}>
                <span className={s.oTen}>{ds[0]!.ten}</span>
                <span className={s.oMoTa}>
                  Hệ thống bán <b>{formatT(ds[0]!.gia)}</b> mỗi bản · kho còn {ds[0]!.ton}
                  {ds[0]!.gia > d.bankroll ? ' — ví chưa đủ' : ''}
                </span>
                {ds.map((m) => (
                  <button
                    key={m.ban_the_id}
                    type="button"
                    className={s.nut}
                    data-mua={m.ban_the_id}
                    disabled={!m.mo || mua.isPending}
                    onClick={() => mua.mutate(m.ban_the_id)}
                  >
                    {mua.isPending && mua.variables === m.ban_the_id
                      ? 'ĐANG MUA' : `MUA #${m.seri} · ${formatT(m.gia)}`}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <p className={s.chanNho}>
          Giá bán ra cao hơn giá Hệ thống mua vào — chênh lệch nuôi quỹ chợ. Mỗi lượt mua
          trích 3% đốt và 2% về Kho bạc. Ví của bạn: <b>{formatT(d.bankroll)}</b>.
        </p>
      </TerminalCard>
    </>
  );
}

function ShopInner() {
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ['shop-catalog'], queryFn: shopApi.catalog });
  const [ketQua, setKetQua] = useState<KetQuaHop | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const lamMoi = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['shop-catalog'] }),
      qc.invalidateQueries({ queryKey: queryKeys.me }),
    ]);
  };

  const mua = useMutation({
    mutationFn: shopApi.mua,
    onSuccess: async () => { setLoi(null); await lamMoi(); },
    onError: (e: Error) => setLoi(e.message),
  });

  const hop = useMutation({
    mutationFn: shopApi.moHop,
    onSuccess: async (r) => { setLoi(null); setKetQua(r); await lamMoi(); },
    onError: (e: Error) => { setKetQua(null); setLoi(e.message); },
  });

  const d = cat.data;

  return (
    <>
      <TerminalCard>
        <div className={s.viRow}>
          <span className={s.viO}>
            <span className={s.viNhan}>TOKEN KHẢ DỤNG</span>
            <span className={s.viSo} data-so-du>
              {d === undefined ? '—' : formatT(d.bankroll)}
            </span>
          </span>
          <span className={s.viO}>
            <span className={s.viNhan}>ĐIỂM QUEST (Q)</span>
            <span className={s.viSo} data-so-du-q>
              {d === undefined ? '—' : `${d.quest_points} Q`}
            </span>
          </span>
        </div>
        <p className={s.chanNho}>
          Hai loại xu, <b>không có đường quy đổi</b> giữa chúng — ở cả hai chiều.
        </p>
      </TerminalCard>

      {loi === null ? null : <div className={s.loi} role="alert">{loi}</div>}

      {/* ─────────────── QUẦY NIÊM YẾT (Q) ─────────────── */}
      <div className={s.nhomNhan}>QUẦY NIÊM YẾT — TIÊU ĐIỂM QUEST</div>
      <div className={s.luoi}>
        {(d?.ban_q ?? []).map((m) => (
          <DongQ
            key={m.id}
            mon={m}
            dangMua={mua.isPending && mua.variables === m.id}
            chuaDinhGia={d?.gia_ban_sao_them === null}
            onMua={() => mua.mutate(m.id)}
          />
        ))}
      </div>

      {/* ─────────────── HỘP PHONG CÁCH (T) ─────────────── */}
      <div className={s.nhomNhan}>HỘP PHONG CÁCH — TIÊU TOKEN</div>
      <TerminalCard>
        <div className={s.hopDau}>
          <span className={s.oChu}>
            <span className={s.oTen}>MỘT LƯỢT MỞ HỘP</span>
            <span className={s.oMoTa}>
              Rơi ra một nhãn dán. Token trả cho lượt mở bị <b>đốt vĩnh viễn</b>,
              không vào quỹ của ai.
            </span>
          </span>
          <span className={s.oPhai}>
            <span className={s.gia} data-gia-hop>
              {d === undefined ? '—' : `${d.hop.gia_t} T`}
            </span>
            <button
              type="button"
              className={`${px.nut} ${px.nutChinh} ${s.nut}`}
              onClick={() => hop.mutate()}
              disabled={hop.isPending || d === undefined || !d.hop.mo_duoc}
            >
              {hop.isPending ? 'ĐANG MỞ' : 'MỞ HỘP'}
            </button>
          </span>
        </div>

        {/* Tỷ lệ + mốc bảo hiểm: hiện VÔ ĐIỀU KIỆN, cạnh nút (R1, luật 1–2). */}
        {d === undefined ? null : (
          <div className={s.rate} data-rate>
            {(['thuong', 'hiem', 'epic'] as const).map((b) => (
              <span key={b} className={s.rateO}>
                <span className={`${s.bac} ${s[`bac_${b}`] ?? ''}`}>{TEN_BAC[b]}</span>
                <span className={s.ratePct}>{d.hop.rate_bp[b] / 100}%</span>
              </span>
            ))}
            <span className={s.rateO}>
              <span className={s.rateNhan}>MỐC BẢO HIỂM</span>
              <span className={s.ratePct} data-pity>
                {d.hop.tu_epic}/{d.hop.pity}
              </span>
            </span>
          </div>
        )}

        {/*
          * BẢNG RƠI ĐẦY ĐỦ, không thu gọn. Đây là chỗ số bản còn lại của món hữu hạn
          * hiện ra (R1, luật 3): thiếu nó thì việc bậc cực hiếm cạn hàng biến tỷ lệ
          * đã công bố thành nửa sự thật, dù server không hề gian một lượt nào.
          */}
        {d === undefined ? null : (
          <div className={s.luoi} data-bang-roi>
            {d.hop.mon.map((m) => <DongHop key={m.id} mon={m} />)}
          </div>
        )}

        {d === undefined ? null : (
          <p className={s.chanNho}>
            Cần số dư từ <b>{formatT(d.hop.can_du_t)}</b> mới mở được: sau khi trừ,
            ví vẫn phải trên mức được nhận trợ cấp — vốn dự báo không phải thứ để
            đổi lấy ngoại hình.
          </p>
        )}
      </TerminalCard>

      {/*
        ─────────────── KHO CỦA TÔI — BÁN CHO HỆ THỐNG (B7a, mốc M1) ───────────────
        Mục này chỉ hiện khi server TRẢ ĐƯỢC danh sách. Chợ tắt ⇒ 403 ⇒ query lỗi
        ⇒ không vẽ gì — không để một cái nút chết trên prod. Giá và "mở/đóng" là
        số server trả; màn không tự suy (C4). Bán là một `ban_the_id`, không phải
        "một cái nhãn": người chơi thấy đúng bản (seri) mình đang bán.
      */}
      <KhoCuaToi onXong={lamMoi} onLoi={setLoi} />

      <QuayHeThong onXong={lamMoi} onLoi={setLoi} />

      {ketQua === null ? null : (
        <TerminalCard>
          <div className={s.ketQua} data-ket-qua>
            {/*
              Nghi lễ vỡ pixel. `key` gắn hạt để mỗi lượt quay dựng lại component
              từ đầu — không có nó thì lượt thứ hai giữ nguyên pha `xong` của lượt
              trước và người chơi không thấy hiệu ứng nào nữa.
              ⚠ `loai`/`ma` PHẢI truyền xuống: từ 04/08 hộp rơi cả lá NỀN, mà nền
              vẽ bằng lưới 32×32 còn nhãn dán vẽ bằng lưới ≤14×8 — thiếu hai
              trường này thì lá nền bị vẽ như nhãn dán và ra một ô méo.
            */}
            <HopVo key={ketQua.hat} hat={ketQua.hat} bac={ketQua.bac}>
              <AnhMon mon={ketQua.mon} />
            </HopVo>
            <span className={s.oChu}>
              <span className={s.oTen}>
                {ketQua.mon.ten}
                <em className={`${s.bac} ${s[`bac_${ketQua.bac}`] ?? ''}`}>
                  {TEN_BAC[ketQua.bac]}
                </em>
              </span>
              <span className={s.oMoTa}>
                {ketQua.trung
                  ? 'Bạn ĐÃ CÓ lá này rồi — mỗi người chỉ một bản, nên lượt này KHÔNG trừ T. '
                  : ''}
                {ketQua.tu_pity ? 'Lượt này nổ vì mốc bảo hiểm, không phải vì may. ' : ''}
                {ketQua.ha_bac
                  ? `Bậc ${TEN_BAC[ketQua.bac_goc]} đã hết bản phát hành nên lượt này trao bậc khác. `
                  : ''}
                {ketQua.trung
                  ? ''
                  : ketQua.mon.loai === 'nen'
                    ? 'Ảnh đại diện đã vào bộ sưu tập. Mỗi người đúng MỘT bản.'
                    : 'Nhãn đã vào kho. Dán vào ảnh đại diện là tiêu vĩnh viễn — không gỡ ra được.'}
              </span>
              {/* Số dư sau lượt: chính con số event ghi lại (R1, luật 4). */}
              <span className={s.oMoTa} data-du-sau>
                Còn lại: <b>{formatT(ketQua.bankroll)}</b> · hạt kiểm lại: {ketQua.hat}
              </span>
            </span>
          </div>
        </TerminalCard>
      )}

      <p className={s.chan}>
        Mọi món ở đây chỉ đổi ngoại hình — <b>không món nào tăng sức mạnh</b> trong
        Đấu trường hay Dự báo. Đồ đã sở hữu xem ở Hồ sơ → Bộ sưu tập.
      </p>
    </>
  );
}

export function Shop() {
  return (
    <div className={s.wrap}>
      <AuthGate>
        <ShopInner />
      </AuthGate>
    </div>
  );
}
