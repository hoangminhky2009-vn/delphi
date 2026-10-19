/**
 * Hồ sơ — Player → Bộ sưu tập → Tài khoản.
 *
 * 25/07: MỞ hiển thị Oracle Level + Bậc dự báo. Bậc hiện theo BẬC chứ không
 * theo điểm Brier thô — không phải vì luật, mà vì "Brier 0,58" không nói gì với
 * người chơi, còn "Bạc" thì nói ngay.
 * Đủ bộ tài khoản GĐ2: đăng xuất · đổi mật khẩu (server đá mọi phiên) ·
 * xóa tài khoản (= ẨN DANH HÓA — events/ledger ở lại dạng ẩn danh, đúng điều khoản).
 * Thống kê + kết quả của tôi từ §2.5 (/me/stats, /me/results — 404 thì tự ẩn).
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/api/client';
import type { OkResponse } from '@/api/types';
import {
  queryKeys, useForecastBoards, useMe, useMyResults, useMyStats, useProgress, useRank,
} from '@/api/queries';
import { useTinhCach } from '@/api/tinh_cach';
import { giongCua, theCua, type GiongChon } from '@/lib/tinh_cach';
import {
  AGE_BAND_LABELS, OCCUPATION_LABELS, POOL_LABELS, REGION_LABELS,
} from '@/lib/labels';
import { AUTH, type AgeBand, type OccupationBand, type Region } from '@config/auth';
import { formatDeltaT } from '@/lib/money';
import { ECONOMY } from '@config/economy';
import { formatT } from '@/lib/money';
import { formatDay } from '@/lib/time';
import { useRevealed } from '@/lib/seen';
import { NAME_ARENA, NAME_LEVEL, ROUTE_CAI_DAT, ROUTE_HUB, ROUTE_PROFILE_THE, ROUTE_SHOP } from '@/lib/vocab';
import { useAvatarCatalog, useAvatarMe, useMacAvatar } from '@/api/avatar';
import { XuongDan } from '@/components/XuongDan';
import { ScreenFrame } from '@/components/ScreenFrame';
import { Avatar, AvatarChon, Field, NeonButton, PixelIcon, Pill } from '@/components/ui';
import { HuyHieuHang, StickerHang } from '@/components/ui/HuyHieuHang';
import { docDienMao, nhanDanTheoId, type MaGoc } from '@config/avatar';
import { BAC_THANG, nhanHuyHieu, type BacId } from '@config/rank';
import s from './auth/auth.module.css';
import p from './Profile.module.css';
import { datTokenDiscord } from '@/lib/discord_phien';
import { TamDuLieuCuaToi } from '@/components/DuLieuCuaToi';
import { TamBaoLoi } from '@/components/BaoLoi';
import { CHU_BAO_LOI } from '@/content/baoLoi';

function ChangePassword({ onDone }: { onDone: (msg: string) => void }) {
  const [current, setCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [localErr, setLocalErr] = useState('');

  const change = useMutation<OkResponse, Error, void>({
    mutationFn: () =>
      api('/account/password', {
        method: 'POST',
        body: { current_password: current, new_password: pw1 },
      }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (change.isPending) return;
    if (pw1 !== pw2) {
      setLocalErr('Hai ô mật khẩu mới chưa khớp nhau.');
      return;
    }
    setLocalErr('');
    change.mutate(undefined, {
      // Server đã thu hồi MỌI phiên (kể cả phiên này) — đưa về đăng nhập
      onSuccess: (res) => onDone(res.message ?? 'Đã đổi mật khẩu. Đăng nhập lại nhé.'),
    });
  }

  const err = change.error instanceof ApiError ? change.error.message : change.error ? 'Không gọi được máy chủ. Thử lại nhé.' : '';

  return (
    <form className={s.form} onSubmit={onSubmit}>
      <Field
        id="cp-current"
        label="Mật khẩu hiện tại"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <Field
        id="cp-new1"
        label="Mật khẩu mới"
        type="password"
        autoComplete="new-password"
        hint={`Từ ${AUTH.PASSWORD_MIN_LENGTH} ký tự. Đổi xong mọi thiết bị phải đăng nhập lại.`}
        value={pw1}
        onChange={(e) => setPw1(e.target.value)}
        required
      />
      <Field
        id="cp-new2"
        label="Nhập lại mật khẩu mới"
        type="password"
        autoComplete="new-password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        error={localErr || undefined}
        required
      />
      {err && (
        <p className={s.serverError} role="alert">
          ✕ {err}
        </p>
      )}
      <NeonButton type="submit" block disabled={change.isPending}>
        {change.isPending ? 'ĐANG ĐỔI…' : '▶ ĐỔI MẬT KHẨU'}
      </NeonButton>
    </form>
  );
}

/*
 * CÔNG TẮC DỮ LIỆU — đã dời vào lớp trượt "Dữ liệu của tôi" (`components/DuLieuCuaToi.tsx`, SPEC chan-truoc-beta): công tắc giờ đứng
 * cạnh ĐÚNG văn bản có số bản mà nó ghi vết, cạnh thứ nó điều khiển (dữ liệu đã ghi) và cạnh nút tải về. Lời hứa §5.4 "đổi ý lúc nào
 * cũng được" vẫn ở Hồ sơ, một chạm.
 */

/**
 * B4 (SPEC va-bao-mat-chuan-hoa-api-dot-1) — tài khoản KHÔNG mật khẩu (khách, Discord: `/auth/me` không có email) xác
 * nhận bằng ô gõ `XOA` thay ô mật khẩu; server tự phân theo `password_hash`, màn chỉ bày đúng ô. Trước bản vá họ bị đòi
 * mật khẩu họ không có ⇒ không bao giờ tự xoá được.
 */
export function DeleteAccount({ onDone, khongMatKhau = false }: { onDone: (msg: string) => void; khongMatKhau?: boolean }) {
  const [password, setPassword] = useState('');
  const [xacNhan, setXacNhan] = useState('');
  const del = useMutation<OkResponse, Error, void>({
    mutationFn: () => api('/account/delete', {
      method: 'POST', body: khongMatKhau ? { xac_nhan: xacNhan } : { password },
    }),
  });
  const duGo = khongMatKhau ? xacNhan === 'XOA' : password.length > 0;
  const err = del.error instanceof ApiError ? del.error.message : del.error ? 'Không gọi được máy chủ. Thử lại nhé.' : '';

  return (
    <form
      className={s.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (!del.isPending)
          del.mutate(undefined, {
            onSuccess: (res) =>
              onDone(res.message ?? 'Tài khoản đã xóa. Dữ liệu nghiên cứu được giữ ở dạng ẩn danh.'),
          });
      }}
    >
      <p className={p.dangerText}>
        Xóa tài khoản = xóa email/mật khẩu/phiên, xoá hẳn dấu vết cách dùng app và báo lỗi, ẩn danh hóa hồ sơ —{' '}
        <b>không hoàn tác được</b>. Nước đi trong trận ở lại dưới một mã ẩn danh (đúng điều khoản khi đăng ký).
      </p>
      {khongMatKhau ? (
        <Field
          id="del-xac-nhan"
          label="Gõ XOA để xác nhận"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={xacNhan}
          onChange={(e) => setXacNhan(e.target.value)}
          required
        />
      ) : (
        <Field
          id="del-password"
          label="Nhập mật khẩu để xác nhận"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      )}
      {err && (
        <p className={s.serverError} role="alert">
          ✕ {err}
        </p>
      )}
      <NeonButton type="submit" block disabled={del.isPending || !duGo}>
        {del.isPending ? 'ĐANG XÓA…' : '⚠ XÓA VĨNH VIỄN TÀI KHOẢN'}
      </NeonButton>
    </form>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();
  const hasUser = Boolean(me.data?.user);
  const stats = useMyStats(hasUser);
  const results = useMyResults(hasUser);
  const tt = useProgress(hasUser);
  const rank = useRank(hasUser);
  const tinhCach = useTinhCach(hasUser);
  const boards = useForecastBoards(hasUser);
  const revealed = useRevealed();
  const [panel, setPanel] = useState<'none' | 'password' | 'delete'>('none');
  /** SPEC chan-truoc-beta — hai lớp trượt: Dữ liệu của tôi · Báo lỗi. */
  const [moDuLieu, setMoDuLieu] = useState(false);
  const [moBaoLoi, setMoBaoLoi] = useState(false);
  const [notice, setNotice] = useState('');

  /**
   * Đổi lá gốc. Server giữ nguyên khung + phụ kiện đang mặc và trả về chuỗi MỚI;
   * ta ghi thẳng chuỗi đó vào cache `me` thay vì tự dựng lại (C4: client hiển thị,
   * không tự tính). Tự dựng lại là đường để phụ kiện đang mặc bốc hơi im lặng.
   */
  const doiGoc = useMutation({
    mutationFn: (goc: MaGoc) =>
      api<{ ok: true; dien_mao: string }>('/avatar/goc', { method: 'POST', body: { goc } }),
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.me, (cu: unknown) => {
        const m = cu as { user?: Record<string, unknown> } | null | undefined;
        return m?.user ? { ...m, user: { ...m.user, dien_mao: res.dien_mao } } : m;
      });
    },
  });

  // Bộ sưu tập + xưởng dán (work-order 04) — đọc đồ THẬT từ /avatar/me.
  const avatarMe = useAvatarMe();
  const catAvatar = useAvatarCatalog();
  const macAvatar = useMacAvatar();
  const [xuongDanCho, setXuongDanCho] = useState<string | null>(null);
  /** Founder 02/08 — bấm avatar mở bảng đổi, thay mục "Ảnh đại diện" riêng. */
  const [moDoiAv, setMoDoiAv] = useState(false);
  /** Founder 04/08 — đổi tên hiển thị; chính cái tên là nút, như avatar. */
  const [moDoiTen, setMoDoiTen] = useState(false);
  const [tenMoi, setTenMoi] = useState('');

  const doiTen = useMutation<{ handle: string }, Error, string>({
    mutationFn: (handle) => api('/me/handle', { method: 'POST', body: { handle } }),
    onSuccess: async () => {
      /*
       * Đợi `/auth/me` về RỒI mới đóng ô: đóng ngay thì tên cũ còn nằm đó thêm
       * một nhịp mạng và trông y như đổi hỏng. Khác `Bac1NhanKhau` (đóng ngay) vì
       * ở đó không có gì phải hiện lại — ở đây thứ vừa đổi CHÍNH LÀ thứ đang hiện.
       */
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      setMoDoiTen(false);
    },
  });

  const logout = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: async () => {
      /*
       * ⚠ XOÁ LUÔN TOKEN DISCORD ĐANG GIỮ Ở MÁY (vá 11/08).
       *
       * Máy chủ nay thu hồi được phiên Bearer, nhưng nếu client vẫn giữ chuỗi
       * token trong `localStorage` + biến module thì mọi request sau đó vẫn
       * mang một Bearer đã chết ⇒ 401 liên tục và người dùng không hiểu vì sao
       * "đăng xuất rồi mà app vẫn hỏng". Thu hồi ở máy chủ và quên ở máy khách
       * là hai nửa của cùng một hành động; làm một nửa thì nút vẫn nói dối,
       * chỉ nói dối theo kiểu khác.
       */
      datTokenDiscord(null);
      await qc.invalidateQueries({ queryKey: queryKeys.me });
      navigate('/onboard');
    },
  });

  /** Đổi mật khẩu / xóa xong: phiên đã chết phía server → làm mới cache + về đăng nhập. */
  async function sessionEnded(msg: string) {
    setNotice(msg);
    await qc.invalidateQueries({ queryKey: queryKeys.me });
  }

  if (me.isPending) {
    return (
      <ScreenFrame title="Hồ sơ" live>
        <div className="skeleton" style={{ height: 180 }} aria-busy="true" />
      </ScreenFrame>
    );
  }

  const user = me.data?.user;
  if (!user) {
    return (
      <ScreenFrame title="Hồ sơ" live>
        {notice ? (
          <div className={`${s.resultBox} ${s.resultBoxWin}`}>
            <span>{notice}</span>
          </div>
        ) : (
          <div className={s.resultBox}>
            <span>
              Bạn chưa đăng nhập. Tạo tài khoản nhận ngay{' '}
              {formatT(ECONOMY.STARTING_BANKROLL)} vốn khởi điểm.
            </span>
          </div>
        )}
        <NeonButton block onClick={() => navigate('/onboard')}>
          ▶ ĐĂNG NHẬP / ĐĂNG KÝ
        </NeonButton>
      </ScreenFrame>
    );
  }

  /** Độ chính xác — số THẬT, không làm tròn kiểu quảng cáo. */
  const doChinhXac = stats.data && stats.data.resolved_count > 0
    ? Math.round((stats.data.correct_count * 100) / stats.data.resolved_count)
    : null;

  return (
    <ScreenFrame title="Hồ sơ" live>
      {/*
        ── PORTFOLIO ─────────────────────────────────────────────────────
        Khung này LÀ khung Oracle Core chuyển từ Hub sang (founder 25/07: "tái sử
        dụng phần khung của oracle core vào portfolio người chơi thay vì chỉ đơn
        điệu toàn text như bây giờ"). Hub thành cửa, Hồ sơ thành nơi có số.
      */}
      <div className={p.portfolio}>
        {/*
          ── ẢNH ĐẠI DIỆN, KHÔNG PHẢI LINH VẬT ─────────────────────────────
          Founder 27/07: hồ sơ đang hiện LINH VẬT chứ không phải ảnh đại diện.
          Linh vật là mặt của SẢN PHẨM (nó giống hệt nhau ở mọi hồ sơ), còn khối
          này là khối DANH TÍNH — thứ duy nhất trên màn nói "đây là tôi".

          96px = 32×3, bội số nguyên. Và avatar đứng ở khối danh tính (avatar ·
          handle · Level), KHÔNG trộn vào khối bậc: đứng cạnh badge bậc thì người
          chơi đọc cả cụm thành MỘT, tức một món mua được đang mượn dáng vẻ của
          một món chỉ merit mới có.
        */}
        {/*
          Founder 02/08 — "sao không để bấm vào avatar ở profile thì sẽ hiện ra
          những ảnh đại diện đang có để thay?": avatar chính LÀ nút mở bảng
          đổi; mục "ẢNH ĐẠI DIỆN" riêng (chật trội) đã gỡ.
        */}
        <button
          type="button"
          className={p.pfTileNut}
          onClick={() => setMoDoiAv((x) => !x)}
          aria-expanded={moDoiAv}
          aria-label="Đổi ảnh đại diện"
        >
          <span className={p.pfTile}>
            <Avatar dm={user.dien_mao} size={96} alt={`Ảnh đại diện của @${user.handle}`} />
          </span>
          <span className={p.pfDoiNhan}>{moDoiAv ? 'ĐÓNG ▴' : 'ĐỔI ▾'}</span>
        </button>
        <div className={p.pfMain}>
          {/*
            ── ĐỔI TÊN (founder 04/08: "phải cho player đổi tên chứ") ─────────
            Gấp vì cửa KHÁCH cấp tên máy — `khach_p83m0c21` đọc được cho máy chủ,
            không đọc được cho người ngồi cùng bàn (D25: đối thủ NHÌN THẤY mình
            mới là thứ làm trò có sức nặng).

            Chính cái tên LÀ nút, đúng lối đã dùng cho avatar ngay bên cạnh
            (founder 02/08) — thêm một mục "ĐỔI TÊN" riêng là nhồi thêm một hàng
            vào một khối vốn đã chật.
          */}
          {!moDoiTen ? (
            <button
              type="button"
              className={p.pfHandleNut}
              onClick={() => { setTenMoi(user.handle); setMoDoiTen(true); doiTen.reset(); }}
            >
              <span className={p.pfHandle}>@{user.handle}</span>
              <span className={p.pfDoiNhan}>ĐỔI ▾</span>
            </button>
          ) : (
            <form
              className={p.pfTenForm}
              onSubmit={(e) => { e.preventDefault(); doiTen.mutate(tenMoi.trim().toLowerCase()); }}
            >
              <label className={p.pfTenO}>
                <span className={p.pfTenAt}>@</span>
                <input
                  className={p.pfTenNhap}
                  value={tenMoi}
                  autoFocus
                  maxLength={20}
                  aria-label="Tên hiển thị mới"
                  // Lọc NGAY tại ô: `HANDLE_PATTERN` chỉ nhận a–z 0–9 gạch dưới,
                  // nên gõ ký tự khác rồi mới báo lỗi là bắt người ta gõ hai lần.
                  onChange={(e) => setTenMoi(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20),
                  )}
                />
              </label>
              <div className={p.pfTenNut}>
                <button
                  type="button"
                  className={p.pfTenHuy}
                  onClick={() => { setMoDoiTen(false); doiTen.reset(); }}
                >
                  HUỶ
                </button>
                <button
                  type="submit"
                  className={p.pfTenLuu}
                  disabled={doiTen.isPending || !AUTH.HANDLE_PATTERN.test(tenMoi.trim().toLowerCase())}
                >
                  {doiTen.isPending ? 'ĐANG LƯU…' : 'LƯU'}
                </button>
              </div>
              <span className={p.pfTenGoiY}>3–20 ký tự · a–z, 0–9, gạch dưới</span>
              {doiTen.error instanceof ApiError && (
                <span className={p.pfTenLoi} role="alert">✕ {doiTen.error.message}</span>
              )}
            </form>
          )}
          {tt.data ? (
            <>
              <span className={p.pfLevel}>
                {NAME_LEVEL.toUpperCase()} {tt.data.level}
              </span>
              <span className={p.pfMeta}>
                {tt.data.xp_cap_sau === null
                  ? `${tt.data.xp} XP · đã tối đa`
                  : `${tt.data.xp}/${tt.data.xp_cap_sau} XP · còn ${
                    tt.data.xp_cap_sau - tt.data.xp} để lên cấp`}
              </span>
              <div className={p.pfBar}>
                <span className={p.pfBarFill} style={{ width: `${tt.data.phan_tram}%` }} />
              </div>
            </>
          ) : (
            <span className={p.pfMeta}>tham gia {formatDay(user.created_at)}</span>
          )}
        </div>
      </div>

      {/* Bảng đổi ảnh đại diện — mở từ chính avatar (founder 02/08). */}
      {moDoiAv && (
        <div className={p.nhom}>
          <AvatarChon
            giaTri={docDienMao(user.dien_mao).goc}
            onChon={(ma) => { if (!doiGoc.isPending) doiGoc.mutate(ma); }}
          />
          {doiGoc.isError && (
            <p className={s.serverError} role="alert">✕ Chưa đổi được, thử lại nhé.</p>
          )}
        </div>
      )}

      {/*
        ── STAT CARD ─────────────────────────────────────────────────────
        Doc §X: "Thay list bằng stat card". Bốn ô số, không phải bốn dòng chữ —
        mắt bắt được con số trong một lượt nhìn thay vì phải đọc.
        Ô nào chưa có dữ liệu thì hiện "—", KHÔNG hiện 0: 0% chính xác và CHƯA
        CHỐT KÈO NÀO là hai chuyện khác nhau.
      */}
      <div className={p.statLuoi}>
        <div className={p.stat}>
          <span className={p.statNhan}>Độ chính xác</span>
          <span className={p.statSo}>{doChinhXac === null ? '—' : `${doChinhXac}%`}</span>
          <span className={p.statPhu}>
            {stats.data ? `${stats.data.correct_count}/${stats.data.resolved_count} kèo` : 'chưa có'}
          </span>
        </div>
        <div className={p.stat}>
          <span className={p.statNhan}>Token</span>
          <span className={p.statSo}>{user.bankroll.toLocaleString('vi-VN')}</span>
          <span className={p.statPhu}>T khả dụng</span>
        </div>
        <div className={p.stat}>
          <span className={p.statNhan}>Đã tham gia</span>
          <span className={p.statSo}>{stats.data?.markets_joined ?? '—'}</span>
          <span className={p.statPhu}>câu hỏi</span>
        </div>
        <div className={p.stat}>
          <span className={p.statNhan}>Trận {NAME_ARENA}</span>
          <span className={p.statSo}>{tt.data?.dem.tran_xong ?? '—'}</span>
          <span className={p.statPhu}>
            {tt.data ? `${tt.data.dem.tran_nhat} lần nhất` : 'chưa có'}
          </span>
        </div>
      </div>


      {/*
        ── BẬC DỰ BÁO ────────────────────────────────────────────────────
        Level và Bậc đo HAI thứ khác nhau, cố ý tách rời: Level = độ dày kinh
        nghiệm, Bậc = độ chính xác (Brier per-pool). Gộp làm một thì người mới
        đoán sai vài lần sẽ thấy mình "không lên cấp" dù vẫn chơi đều.
      */}
      {tt.data && (
        <div className={p.nhom}>
          <div className={p.blockLabel}>BẬC DỰ BÁO</div>
          {tt.data.bac_du_bao.map((b) => (
            <div key={b.pool} className={p.hang}>
              <span className={p.hangNhan}>{POOL_LABELS[b.pool]}</span>
              <span className={p.hangGiaTri}>
                {b.bac}
                {b.con_thieu > 0
                  ? ` · còn ${b.con_thieu} kèo nữa mới xếp`
                  : ` · ${b.so_keo_da_tinh} kèo đã tính`}
              </span>
            </div>
          ))}
          <p className={p.ghiChu}>
            Bậc tính từ độ chính xác của chính bạn, riêng từng pool — pool khó khác
            nhau nên gộp một con số chung sẽ vô nghĩa.
          </p>
        </div>
      )}

      {/*
        ── THẺ TÍNH CÁCH ĐO TỪ TRẬN (04 §3, founder 08/08) — CARD MỜI; trang đầy đủ
        (radar + đường độ chuẩn + dòng token) ở `/ho-so/the`. Ở đây chỉ tấm thẻ gọn:
        đủ để khoe, đủ để bấm vào xem trọn.

        ⚠⚠ NHÃN ĐỔI 21/09. Trước đây khối này đề "TÀI CHÍNH CÁ NHÂN" và bấm vào thì
        sang `/tai-chinh` — tức tấm thẻ ĐO TỪ ĐẤU TRƯỜNG được giới thiệu như thẻ của
        PFM, rồi dẫn thẳng vào khu PFM. Hai tấm thẻ khác NGUỒN BẰNG CHỨNG bị đọc thành
        một: thẻ này đo từ hành vi trong trận (mạnh), còn chân dung PFM dựng từ lời khai
        ở phỏng vấn (yếu — P6). Gộp chỗ là mời người đọc tin lời khai ngang hành vi đã đo.
        Chỉ thị founder: *"Thẻ tính cách từ alpha draft thì vẫn giữ nguyên nhưng để trên
        profile còn thẻ PFM thì riêng nhé"*.
      */}
      {tinhCach.data && (() => {
        const the = theCua(tinhCach.data.tinh_cach,
          giongCua(user.age_band, user.giong_ho_so as GiongChon | undefined));
        return (
          <div className={p.nhom}>
            <div className={p.blockLabel}>THẺ TÍNH CÁCH — ĐO TỪ TRẬN</div>
            <div className={p.tcHang}>
              <span className={p.tcEmoji} aria-hidden>{the.emoji}</span>
              <div className={p.tcChu}>
                <span className={p.tcTen}>{the.ten}</span>
                <span className={p.tcDocVi}>{the.doc_vi}</span>
              </div>
            </div>
            <p className={p.ghiChu}>
              Đọc từ dòng token của chính bạn trong các trận đã chơi — không phải
              từ câu bạn tự khai.
            </p>
            <Link className={p.tcXemThem} to={ROUTE_PROFILE_THE}>
              XEM HỒ SƠ ĐẦY ĐỦ — RADAR · DÒNG TOKEN ›
            </Link>
            <Link className={p.tcXemThem} to={ROUTE_CAI_DAT}>
              ⚙ CÀI ĐẶT — giọng của tấm thẻ ›
            </Link>
          </div>
        );
      })()}

      {/*
        ── BẬC ĐẤU TRƯỜNG (Hệ A) ─────────────────────────────────────────
        HAI HỆ, MỘT TRANG, và phải đọc ra là HAI THỨ. Khối trên là Hệ B (dự báo,
        thang Brier); khối này là Hệ A (Đấu trường, thang sinh vật biển). Trước
        đợt này cả hai đều dùng chữ Đồng/Bạc/Vàng nên trên cùng một màn hình có
        hai "Bạc" nghĩa khác nhau — thang sinh vật biển chữa lỗi đó bằng cách
        không dùng lại một chữ nào.

        D25/R4 — HIỆN BẬC, KHÔNG HIỆN ĐIỂM CỦA NGƯỜI KHÁC. Điểm của CHÍNH CHỦ thì
        được: nó là thứ duy nhất giải thích "vì sao +37" ở màn Chốt phiên, và
        không có nó thì bậc thành một nhãn không ai biết cách leo.
      */}
      {/*
        KHỐI HẠNG MỘT CẤU TRÚC CHO CẢ BA TRẠNG THÁI (đang tải · lỗi · có dữ liệu) — SPEC huy-hieu-hang-sticker 5b.2.
        Thang 7 bậc và hàng sticker là NỘI DUNG TĨNH (config), nên chúng có mặt ngay từ đầu và chỉ MỜ đi khi chưa có
        dữ liệu; hàng đầu có chiều cao tối thiểu cố định. Nhờ vậy dữ liệu về chỉ ĐỔI NỘI DUNG tại chỗ — không khối
        nào mọc ra làm trôi các phần dưới (đo toạ độ trước/sau ở báo cáo). `rank.data === null` (máy chủ trả 404 ⇒
        chưa có tính năng) thì ẨN cả khối như trước. Không số 0, không bậc giả thay cho "chưa có" (D62).
      */}
      {hasUser && rank.data !== null && (
        <div className={p.nhom} aria-busy={rank.isPending}>
          <div className={p.blockLabel}>BẬC ĐẤU TRƯỜNG</div>
          <div className={p.rankHang} data-cho-hang={rank.data ? undefined : 'true'}>
            {/* Huy hiệu kim loại (SPEC huy-hieu-hang-sticker) — khung 80px CỐ ĐỊNH kể cả khi chưa xếp bậc / chưa có dữ liệu. */}
            <div className={p.rankHuyHieu}>
              {rank.data && (rank.data.bac === 'chua_xep'
                ? <PixelIcon name={rank.data.bac_icon_lon as never} size={64} />
                : <HuyHieuHang bac={rank.data.bac as BacId} size={80} nhan={nhanHuyHieu(rank.data.bac as BacId)} />)}
            </div>
            {rank.data ? (
              <div className={p.rankChu}>
                <span className={p.rankTen}>
                  {nhanHuyHieu(rank.data.bac as BacId)}
                  {rank.data.nac !== null && ` ${'I'.repeat(rank.data.nac)}`}
                </span>
                <span className={p.rankPhu}>
                  {rank.data.con_thieu_tran > 0
                    ? `còn ${rank.data.con_thieu_tran} trận Giải xếp hạng nữa mới xếp bậc`
                    : `${rank.data.diem} điểm · ${rank.data.so_tran} trận`}
                </span>
                {/* D32 — PHÂN VỊ cho mọi người. "top 12%" ai cũng có số để đọc,
                    còn top-100 thì nói với 99% người chơi rằng họ không có ở đây. */}
                {rank.data.phan_vi !== null && (
                  <span className={p.rankPhanVi}>TOP {rank.data.phan_vi}% mùa này</span>
                )}
                {rank.data.con_thieu_diem !== null && rank.data.con_thieu_diem > 0 && (
                  <span className={p.rankPhu}>
                    còn {rank.data.con_thieu_diem} điểm nữa lên bậc kế
                  </span>
                )}
              </div>
            ) : rank.isError ? (
              <div className={p.rankChu} role="alert">
                <span className={p.rankPhu}>Chưa tải được hạng của bạn.</span>
                <button
                  type="button"
                  className={p.rankThuLai}
                  disabled={rank.isFetching}
                  onClick={() => { void rank.refetch(); }}
                >
                  THỬ LẠI
                </button>
              </div>
            ) : (
              <div className={p.rankChu} aria-hidden>
                <span className={p.rankKhungDong} />
                <span className={p.rankKhungDongNgan} />
              </div>
            )}
          </div>
          {/*
            THANG BẬC TOÀN CẢNH (founder 02/08 — "các mức rank từ tôm tép đến
            cá mập cá voi"): thang 7 bậc nằm trong config từ đầu mà màn chỉ
            hiện bậc ĐANG ĐỨNG — người chơi không biết thang dài bao nhiêu và
            mình đứng đâu trên đó. Cả thang, đỉnh ở trên, bậc mình sáng lên.
          */}
          <div className={p.rankThang} data-chua-co-du-lieu={rank.data ? undefined : 'true'}>
            {BAC_THANG.map((bc) => {
              const bacToi = rank.data ? (BAC_THANG.find((x) => x.id === rank.data!.bac)?.bac ?? 0) : null;
              return (
                <div
                  key={bc.id}
                  className={`${p.rankNac} ${rank.data && rank.data.bac === bc.id ? p.rankNacDay : ''}`}
                >
                  <HuyHieuHang bac={bc.id} size={24} chuaDat={bacToi !== null && bc.bac > bacToi} />
                  <span className={p.rankNacTen}>{bc.kim_loai}</span>
                  <span className={p.rankNacCa}>{bc.ten}</span>
                  <span className={p.rankNacMoc}>
                    {bc.apex_top !== null
                      ? `TOP ${bc.apex_top} server`
                      : Number.isFinite(bc.moc_duoi ?? Number.NEGATIVE_INFINITY)
                        ? `từ ${bc.moc_duoi} điểm`
                        : 'khởi điểm'}
                  </span>
                </div>
              );
            })}
          </div>
          {/*
            QUÀ VINH DANH (SPEC huy-hieu-hang-sticker): sticker nhận khi LÊN bậc, mỗi mùa một bộ. Ô nào đã nhận
            TRONG MÙA NÀY (huy_hieu_cap) thì hiện màu, còn lại là bóng xám — dựa vào SỔ chứ không suy từ bậc hiện
            tại, vì không phát bù: ai đã ở bậc cao từ trước vẫn phải leo lại mới có. SẮT không có sticker.
            Chưa có dữ liệu thì CẢ HÀNG mờ (không phải "chưa nhận" — chưa biết).
          */}
          <div className={p.blockLabel}>QUÀ VINH DANH — lên bậc nào, nhận sticker bậc đó</div>
          <div className={p.rankStickerLuoi} data-chua-co-du-lieu={rank.data ? undefined : 'true'}>
            {[...BAC_THANG].reverse().map((bc) => {
              const co = bc.sticker !== null && (rank.data?.sticker_da_nhan ?? []).includes(bc.id);
              const ten = bc.sticker ? nhanDanTheoId(bc.sticker)?.ten.split(' · ')[0] : null;
              return (
                <div
                  key={bc.id}
                  className={p.rankSticker}
                  data-sticker-bac={bc.id}
                  data-da-nhan={co ? 'true' : 'false'}
                >
                  {bc.sticker
                    ? <StickerHang id={bc.sticker} size={40} chua={!co} nhan={co ? (ten ?? undefined) : undefined} />
                    : <span className={p.rankStickerRong} aria-hidden>—</span>}
                  <span className={co ? p.rankStickerTen : p.rankStickerTenChua}>{co ? ten : bc.kim_loai}</span>
                </div>
              );
            })}
          </div>
          <p className={p.ghiChu}>
            Mỗi mùa một bộ: mùa sau leo lại để nhận bộ mới, bộ mùa trước giữ nguyên. Sticker vinh danh dán được
            lên avatar — chỉ có từ việc lên bậc, không mua được và không quay được.
          </p>
          <p className={p.ghiChu}>
            Điểm chuyển từ người xếp dưới sang người xếp trên, tổng mỗi bàn luôn bằng
            0 — không có điểm nào được in ra. Bàn đông nhiều điểm hơn vì có nhiều lần
            so nhau hơn. Đấu tự do (có máy) không tính điểm. Bảng xếp hạng toàn
            server mở sau khi rà soát tên hiển thị (D25/R2).
          </p>
        </div>
      )}

      {/*
        ── HAI BẢNG DỰ BÁO (D32) ─────────────────────────────────────────
        Hai bảng có động cơ NGƯỢC nhau, có chủ ý: bảng % thưởng ĐÚNG, bảng token
        thưởng DÁM và BỀN. Né kèo khó để giữ % thì tụt bảng token; bắn bừa cho
        nhiều thì tụt bảng %. Nên chúng phải đứng CẠNH nhau, không tách trang.
      */}
      {boards.data && (
        <div className={p.nhom}>
          <div className={p.blockLabel}>BẢNG DỰ BÁO</div>
          <div className={p.hang}>
            <span className={p.hangNhan}>Độ chính xác (30 kèo vĩ mô)</span>
            <span className={p.hangGiaTri}>
              {boards.data.do_chinh_xac.cua_toi
                ? `TOP ${boards.data.do_chinh_xac.cua_toi.phan_vi}%`
                : 'chưa đủ kèo vĩ mô đã chốt'}
            </span>
          </div>
          <div className={p.hang}>
            <span className={p.hangNhan}>Token ăn được (mùa {boards.data.mua})</span>
            <span className={p.hangGiaTri}>
              {boards.data.so_luong.cua_toi
                ? `TOP ${boards.data.so_luong.cua_toi.phan_vi}%`
                : 'chưa có kèo nào ăn được trong mùa'}
            </span>
          </div>
          {boards.data.do_chinh_xac.dong.slice(0, 3).map((d) => (
            <div key={`dcx-${d.user_id}`} className={p.hang}>
              <span className={p.hangNhan}>#{d.hang} @{d.handle}</span>
              <span className={p.hangGiaTri}>{d.pct}% · {d.k}/{d.n} kèo</span>
            </div>
          ))}
          <p className={p.ghiChu}>
            Một kèo tính là đúng khi cửa bạn đặt NHIỀU NHẤT là cửa thắng — rải đều mọi
            cửa thì không tính là dự báo. Bảng token tính theo mùa, mùa mới ai cũng bắt
            đầu lại gần bằng nhau.
          </p>
        </div>
      )}

      {results.data && results.data.length > 0 && (
        <div className={p.resultsBlock}>
          <div className={p.blockLabel}>KẾT QUẢ CỦA TÔI</div>
          {results.data.map((r) => (
            <Link key={r.market_id} to={`/keo/${r.market_id}/ket-qua`} className={p.resultRow}>
              <span className={p.resultQuestion}>{r.question_text}</span>
              {/* Chưa xem lễ công bố → KHÔNG lộ ±T (xem lib/seen.ts) */}
              <span
                className={
                  !revealed.has(r.market_id)
                    ? p.netFlat
                    : r.net > 0
                      ? p.netUp
                      : r.net < 0
                        ? p.netDown
                        : p.netFlat
                }
              >
                {!revealed.has(r.market_id)
                  ? 'CHỜ CÔNG BỐ →'
                  : r.net === 0
                    ? 'HOÀN VỐN'
                    : formatDeltaT(r.net)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/*
        ── BỘ SƯU TẬP ────────────────────────────────────────────────────
        Rỗng thật, và nói rỗng. 4 bảng cosmetic chưa có code, `/api/v1/shop/*`
        còn 403 → không có gì để liệt kê. Dựng vài ô xám giả làm "sắp có" là hứa
        hàng chưa tồn tại.
      */}
      {/* Mục "ẢNH ĐẠI DIỆN" riêng đã GỠ (founder 02/08: "chật trội") — bảng
          chọn nay mở từ chính avatar ở khối danh tính đầu màn. Ba lá vẫn miễn
          phí, đổi không giới hạn (lý do giữ ở docstring `AvatarChon`). */}

      {/*
        ── BỘ SƯU TẬP THẬT + XƯỞNG DÁN (work-order 04) ──────────────────────
        Thay placeholder cứng 01/08: khối cũ nói "chưa có gì" VÔ ĐIỀU KIỆN —
        trong khi /avatar/me đã trả bộ sưu tập từ lâu (điểm mù #14: server
        sống, UI câm). Nay đọc đồ THẬT: mặc, và mở xưởng dán.
      */}
      <div className={p.nhom}>
        <div className={p.blockLabel}>BỘ SƯU TẬP</div>
        {avatarMe.data === undefined || catAvatar.data === undefined ? (
          <p className={p.ghiChu}>Đang tải bộ sưu tập…</p>
        ) : avatarMe.data.bo_suu_tap.length === 0 ? (
          <p className={p.ghiChu}>
            Chưa có tấm nền nào — nhận ở khởi đầu hoặc mua ở{' '}
            <Link to={ROUTE_SHOP}>Shop</Link>.
          </p>
        ) : (
          <>
            {avatarMe.data.bo_suu_tap.filter((t) => !t.an).map((t) => (
              <div key={t.avatar_id} className={p.hang}>
                <Avatar dm={t.chuoi} size={64} alt={`Nền #${t.seri}`} />
                <span className={p.hangNhan}>
                  Nền #{t.seri} · {t.so_dan}/{catAvatar.data.dan_toi_da} nhãn
                  {avatarMe.data.dang_mac === t.avatar_id && ' · ĐANG MẶC'}
                </span>
                {avatarMe.data.dang_mac !== t.avatar_id && (
                  <button
                    type="button"
                    className={s.nutNho}
                    disabled={macAvatar.isPending}
                    onClick={() => macAvatar.mutate({ avatar_id: t.avatar_id })}
                  >
                    MẶC
                  </button>
                )}
                <button
                  type="button"
                  className={s.nutNho}
                  onClick={() => setXuongDanCho(t.avatar_id)}
                >
                  DÁN NHÃN
                </button>
              </div>
            ))}
            <p className={p.ghiChu}>
              Kho nhãn: {avatarMe.data.kho.length === 0
                ? 'trống — mua hoặc quay ở Shop'
                : avatarMe.data.kho.map((k) => `×${k.so_luong}`).join(' · ')}
              . Dán là VĨNH VIỄN (có hộp xác nhận).
            </p>
          </>
        )}
      </div>
      {xuongDanCho !== null && avatarMe.data && catAvatar.data && (() => {
        const tp = avatarMe.data.bo_suu_tap.find((t) => t.avatar_id === xuongDanCho);
        return tp ? (
          <XuongDan
            tacPham={tp}
            kho={avatarMe.data.kho}
            catalog={catAvatar.data}
            onDong={() => setXuongDanCho(null)}
          />
        ) : null;
      })()}

      {/*
        ── TÀI KHOẢN ─────────────────────────────────────────────────────
        Doc §IX xếp Account XUỐNG CUỐI: đây là thứ người chơi hiếm khi cần, không
        phải thứ họ mở Hồ sơ để xem. Nhóm demographic gộp vào đây vì nó là dữ liệu
        khai báo, không phải thành tích.
      */}
      <div className={p.nhom}>
        <div className={p.blockLabel}>TÀI KHOẢN</div>
        <div className={p.hang}>
          <span className={p.hangNhan}>Email</span>
          <span className={p.hangGiaTri}>{me.data?.email}</span>
        </div>
        <div className={p.hang}>
          <span className={p.hangNhan}>Nhóm</span>
          <span className={p.hangGiaTri}>
            <Pill>{AGE_BAND_LABELS[user.age_band as AgeBand] ?? user.age_band}</Pill>{' '}
            <Pill>{REGION_LABELS[user.region as Region] ?? user.region}</Pill>{' '}
            <Pill>
              {OCCUPATION_LABELS[user.occupation_band as OccupationBand] ?? user.occupation_band}
            </Pill>
          </span>
        </div>
        <div className={p.hang}>
          <span className={p.hangNhan}>Mùa</span>
          <span className={p.hangGiaTri}>{user.season_id}</span>
        </div>
        <div className={p.hang}>
          <span className={p.hangNhan}>Tham gia</span>
          <span className={p.hangGiaTri}>{formatDay(user.created_at)}</span>
        </div>
      </div>

      <div className={p.actions}>
        <NeonButton
          variant="ghost"
          onClick={() => setPanel(panel === 'password' ? 'none' : 'password')}
          aria-expanded={panel === 'password'}
        >
          {/* 🔑 → cùng lưới `lock` với mọi ổ khoá khác trong app: một chìa và
              một ổ khoá là hai hình khác nhau cho cùng một ý, mà lưới pixel chỉ
              có một cái — nên gộp về ổ khoá thay vì vẽ lưới thứ hai. */}
          <PixelIcon name="lock" size={16} className={p.nutIcon} />
          {' '}ĐỔI MẬT KHẨU
        </NeonButton>
        <NeonButton variant="ghost" onClick={() => setMoDuLieu(true)} aria-haspopup="dialog" data-nut="du-lieu-cua-toi">
          ⚙ DỮ LIỆU CỦA TÔI
        </NeonButton>
        <NeonButton variant="ghost" onClick={() => setMoBaoLoi(true)} aria-haspopup="dialog" data-nut="bao-loi">
          {CHU_BAO_LOI.nut}
        </NeonButton>
        <NeonButton variant="ghost" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? 'ĐANG THOÁT…' : '⏻ ĐĂNG XUẤT'}
        </NeonButton>
        <NeonButton
          variant="ghost"
          className={p.dangerBtn}
          onClick={() => setPanel(panel === 'delete' ? 'none' : 'delete')}
          aria-expanded={panel === 'delete'}
        >
          ⚠ XÓA TÀI KHOẢN
        </NeonButton>
      </div>

      <TamDuLieuCuaToi mo={moDuLieu} onDong={() => setMoDuLieu(false)} />
      <TamBaoLoi mo={moBaoLoi} onDong={() => setMoBaoLoi(false)} />
      {panel === 'password' && <ChangePassword onDone={sessionEnded} />}
      {panel === 'delete' && <DeleteAccount onDone={sessionEnded} khongMatKhau={!me.data?.email} />}

      {/* Nhãn cũ ghi "← Về bảng giá" nhưng '/' là Hub — sai nghĩa sẵn từ trước. */}
      <p className={s.hintLine}>
        <Link to={ROUTE_HUB}>← Về Hub</Link>
        {' · '}
        <Link to="/dieu-khoan">Điều khoản &amp; dữ liệu</Link>
      </p>
    </ScreenFrame>
  );
}
