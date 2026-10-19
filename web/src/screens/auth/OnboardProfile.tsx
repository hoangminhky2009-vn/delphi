/**
 * Hồ sơ mới (onboarding) — POST /api/v1/onboarding, MỘT transaction phía server:
 * users + signup_grant 1.000 T + event. Demographic chỉ dạng khoảng (C7);
 * age_band phải khớp năm sinh đã khai lúc đăng ký (server đối chiếu).
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ECONOMY } from '@config/economy';
import { api, ApiError } from '@/api/client';
import { DEMOGRAPHIC, type OnboardingResponse } from '@/api/types';
import type { AgeBand, OccupationBand, Region } from '@config/auth';
import { queryKeys, useMe } from '@/api/queries';
import { AGE_BAND_LABELS, OCCUPATION_LABELS, REGION_LABELS } from '@/lib/labels';
import { docDiemQuayVe, maBanQuayVe } from '@/lib/diem_quay_ve';
import { formatT } from '@/lib/money';
import { ScreenFrame } from '@/components/ScreenFrame';
import { AvatarChon, Field, FilterRow, NeonButton, Pill, PixelIcon } from '@/components/ui';
import type { MaGoc } from '@config/avatar';
import s from './auth.module.css';
import { CONSENT_PHIEN_BAN } from '@config/pfm_consent';
import { VanBanNghienCuu } from '@/components/VanBanNghienCuu';

const AGE_OPTIONS = DEMOGRAPHIC.AGE_BANDS.map((v) => ({ value: v, label: AGE_BAND_LABELS[v] }));
const REGION_OPTIONS = DEMOGRAPHIC.REGIONS.map((v) => ({ value: v, label: REGION_LABELS[v] }));
const OCCUPATION_OPTIONS = DEMOGRAPHIC.OCCUPATION_BANDS.map((v) => ({
  value: v,
  label: OCCUPATION_LABELS[v],
}));

export function OnboardProfile() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useMe();

  const [handle, setHandle] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  /*
   * D396 — nhóm tuổi ĐÃ SUY từ năm sinh lúc đăng ký: chọn sẵn và chỉ bày đúng nhóm ấy. Bắt chọn lại thì
   * người sinh cuối 2008 (17 tuổi thật, "18–22" theo năm) bấm "16–17" và bị server từ chối — ngay màn đầu.
   */
  const nhomKhai = me.data?.nhom_tuoi_khai ?? null;
  useEffect(() => { if (nhomKhai) setAgeBand(nhomKhai); }, [nhomKhai]);
  const ageOptions = nhomKhai ? AGE_OPTIONS.filter((o) => o.value === nhomKhai) : AGE_OPTIONS;
  const [region, setRegion] = useState<Region | null>(null);
  const [occupation, setOccupation] = useState<OccupationBand | null>(null);
  const [consent, setConsent] = useState(false);
  /*
   * LÁ AVATAR — `null` = CHƯ A CHỌN, và không bao giờ được mặc định thành 'A'.
   *
   * Nếu màn này chọn giùm thì phân bố thu về là phân bố của CÁI MẶC ĐẮNH chứ
   * không phải của GU, và cả cột revealed-preference mất nghĩa — `events` là
   * append-only nên không backfill lại được.
   *
   * `avatarMs` = thời gian tới lúc chạm lá đầu tiên. Nó tách "chọn thật" khỏi "bấm
   * cho xong" — không có nó thì mọi lượt chọn trông giống hệt nhau trong dữ liệu.
   */
  const [goc, setGoc] = useState<MaGoc | null>(null);
  const [avatarMs, setAvatarMs] = useState<number | null>(null);

  /*
   * D392 — gửi kèm mã bàn đang nhớ (nếu có). Cửa D370 ở `/onboarding` (bỏ xác minh email cho người vào từ bàn
   * buổi đo ĐANG MỞ) kiểm `ban_ma` NGAY LÚC NÀY; trước bản này màn hồ sơ không gửi nó, nên cửa ấy không có
   * đường tới — người đăng ký từ bàn vẫn bị đòi xác minh email. Không có bàn ⇒ không gửi gì, luật cũ nguyên vẹn.
   */
  const onboard = useMutation<OnboardingResponse, Error, void>({
    mutationFn: () => {
      const banMa = maBanQuayVe();
      return api('/onboarding', {
        method: 'POST',
        body: {
          handle: handle.trim().toLowerCase(),
          age_band: ageBand,
          region,
          occupation_band: occupation,
          research_consent: consent,
          // 0079 — số bản văn đồng ý đang hiện trên màn này; server ghi vết đúng bản ấy.
          ...(consent ? { research_consent_phien_ban: CONSENT_PHIEN_BAN.nghien_cuu } : {}),
          avatar_goc: goc,
          avatar_ms: avatarMs,
          ...(banMa ? { ban_ma: banMa } : {}),
        },
      });
    },
    onSuccess: () => {
      /*
       * ⚠ GỠ 03/08 mốc telemetry "nhan-von": `auth_accounts.user_id` chuyển từ
       * NULL sang có giá trị ở ĐÚNG bước này, nên trạng thái bền đã nói y hệt —
       * mà nói chính xác hơn (không mất khi đóng tab) và nói được cho cả tài
       * khoản cũ. Hai nguồn cho một sự thật thì nguồn yếu hơn chỉ là chỗ để trôi.
       */
      return qc.invalidateQueries({ queryKey: queryKeys.me });
    },
  });

  // Khách → về đăng nhập; đã onboard từ trước → về sảnh. KHÔNG redirect khi
  // mutation đang chạy/vừa thành công — giữ màn chúc mừng +1.000 T cho user bấm.
  useEffect(() => {
    if (onboard.isPending || onboard.isSuccess) return;
    if (me.isPending) return;
    if (me.data === null) navigate('/onboard', { replace: true });
    else if (me.data?.user) navigate(docDiemQuayVe() ?? '/', { replace: true });
  }, [onboard.isPending, onboard.isSuccess, me.isPending, me.data, navigate]);

  // Phải chạm một lá mới đi tiếp — bắt buộc nằm ỞĐÂY chứ không ở API: API siết
  // thành 400 thì một bản web cũ nằm trong cache service worker sẽ làm người mới
  // KHÔNG ĐĂNG KÝ ĐƯỢC. Ở đây thì ta chỉ cho họ thấy còn thiếu gì.
  /*
   * ⚠ `consent` KHÔNG nằm trong điều kiện gửi (founder chốt 03/08, sau khi đã
   * thử hướng ngược lại): ép tích để được tạo tài khoản thì "đồng ý" không còn
   * là đồng ý. Cổng đứng ở XẾP HẠNG — chỗ có người khác — chứ không ở cửa vào.
   */
  const canSubmit = handle.trim().length >= 3 && ageBand && region && occupation && goc;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (canSubmit && !onboard.isPending) onboard.mutate();
  }

  const err = onboard.error instanceof ApiError ? onboard.error : null;

  if (onboard.isSuccess) {
    return (
      <ScreenFrame title="Hồ sơ hoàn tất" live>
        <div className={`${s.resultBox} ${s.resultBoxWin}`}>
          <Pill tone="win">VỐN KHỞI ĐIỂM</Pill>
          <span className={s.grant}>+{formatT(onboard.data.bankroll)}</span>
          <span>
            Chào <b>@{handle.trim().toLowerCase()}</b> — vốn khởi điểm đã vào ví. Vào Đấu trường
            đánh trận đầu tiên thôi!
          </span>
        </div>
        {/*
          ⚠ D86: phễu người mới đổ vào ĐẤU TRƯỜNG, không vào bảng giá nữa. Đây
          là cú đổi quan trọng nhất của cả đợt đóng băng: người mới phải rơi
          vào thứ ĐANG giữ chân người (1.560 event vs 22), không phải vào sản
          phẩm đã đóng băng ngay ở màn chào.
        */}
        {/*
          D333 — đến từ link BÀN BUỔI ĐO thì nút đưa về đúng bàn ấy. Cả lớp đang chờ cùng một đề;
          ném người vừa lập hồ sơ vào sảnh là bắt họ đi tìm lại link giữa buổi.
        */}
        {/*
          ⭐⭐ D374 (founder 21/09) — VỀ HUB, KHÔNG VÀO THẲNG ĐẤU TRƯỜNG.

          Nguyên văn: *"đăng nhập xong bị dẫn ngay vào màn hướng dẫn của alpha draft là SAI.
          Đăng nhập xong phải dẫn vào hub, màn hướng dẫn ban đầu của alpha draft kia là khi
          bấm chọn alpha draft ở hub"*.

          ⚠ ĐÂY LÀ LẬT D86 (15/08 — "phễu người mới đổ vào ĐẤU TRƯỜNG, không vào bảng giá"),
          và lật có chủ đích chứ không phải quên. Hai thứ đã đổi kể từ D86: (a) Hub nay có
          thẻ Đấu trường đứng đầu, nên "về Hub" không còn là ném người mới vào một màn chọn
          trống; (b) D336 dắt người lần đầu vào bàn tập NGAY KHI họ bấm Đấu trường — nên cú
          dắt vẫn còn nguyên, chỉ dời sang sau một cú bấm CỦA HỌ. Phễu không mất, nó chỉ thôi
          tự động.

          ⚠ Đường BÀN BUỔI ĐO giữ nguyên (D333): cả lớp đang chờ chung một đề, ném người vừa
          lập hồ sơ về Hub là bắt họ đi tìm lại link giữa buổi.
        */}
        <NeonButton block onClick={() => navigate(docDiemQuayVe() ?? '/')}>
          {docDiemQuayVe() ? '▶ VỀ BÀN BUỔI ĐO' : '▶ VÀO SẢNH CHÍNH'}
        </NeonButton>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame title="Hồ sơ của bạn" live>
      {/* Cách chơi 3 bước (spec GĐ5 màn 1) */}
      <div className={s.steps} aria-label="Cách chơi">
        <div className={s.step}>
          <PixelIcon name="chart" size={16} />
          <span className={s.stepNum}>1</span>
          <span>CHỌN CÂU HỎI</span>
        </div>
        <div className={s.step}>
          <PixelIcon name="candle" size={16} />
          <span className={s.stepNum}>2</span>
          <span>PHÂN BỔ TOKEN</span>
        </div>
        <div className={s.step}>
          <PixelIcon name="medal" size={16} />
          <span className={s.stepNum}>3</span>
          <span>ĐÚNG → ĂN CHIA POOL</span>
        </div>
      </div>
      <form className={s.form} onSubmit={onSubmit}>
        <Field
          id="ob-handle"
          label="Tên hiển thị (handle)"
          autoComplete="username"
          placeholder="vd du_bao_gia"
          hint="a–z 0–9 _ · 3–20 ký tự"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          error={err?.field === 'handle' || err?.code === 'handle_taken' ? err.message : undefined}
          required
        />
        {/*
          CHỌN MẶT — đặt NGAY SAU handle, trước phần khai báo nhân khẩu.
          Handle + mặt là hai thứ làm nên "tôi là ai ở đây"; nhóm tuổi/miền/nghề
          là khai báo hành chính. Xếp mặt xuống cuối là biến một lựa chọn thành
          một ô biểu mẫu, và người ta bấm cho xong — đúng thứ `ms_can_nhac` sinh
          ra để đo, nên đừng tự tay tạo ra nó.
        */}
        <div className={s.avatarNhom}>
          <span className={s.avatarNhan}>Ảnh đại diện</span>
          <AvatarChon
            giaTri={goc}
            onChon={(ma, ms) => {
              setGoc(ma);
              // Chỉ ghi lần chạm ĐẦU TIÊN: đổi qua đổi lại sau đó là lưỡng lự,
              // không phải cân nhắc, và trộn hai thứ đó là mất cả hai.
              setAvatarMs((cu) => cu ?? ms);
            }}
          />
        </div>
        <FilterRow label="Nhóm tuổi" options={ageOptions} value={ageBand} onChange={setAgeBand} />
        {nhomKhai && <p className={s.hintLine}>Theo năm sinh bạn đã khai lúc đăng ký.</p>}
        {err?.field === 'age_band' && (
          <p className={s.serverError} role="alert">
            ✕ {err.message}
          </p>
        )}
        <FilterRow label="Miền" options={REGION_OPTIONS} value={region} onChange={setRegion} />
        <FilterRow
          label="Bạn đang là"
          options={OCCUPATION_OPTIONS}
          value={occupation}
          onChange={setOccupation}
        />
        <label className={s.consent}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Tôi đồng ý <b>điều khoản</b> và văn bản dưới đây. Không bắt buộc — nhưng{' '}
            <b>xếp hạng</b> thì cần.{' '}
            <a href="/dieu-khoan" target="_blank" rel="noreferrer">
              Đọc điều khoản ↗
            </a>
          </span>
        </label>
        <VanBanNghienCuu />
        {err && !err.field && err.code !== 'handle_taken' && (
          <p className={s.serverError} role="alert">
            ✕ {err.message}
          </p>
        )}
        {onboard.error && !err && (
          <p className={s.serverError} role="alert">
            ✕ Không gọi được máy chủ. Kiểm tra mạng rồi thử lại nhé.
          </p>
        )}
        <NeonButton type="submit" block disabled={!canSubmit || onboard.isPending}>
          {onboard.isPending
            ? 'ĐANG LẬP HỒ SƠ…'
            : `▶ NHẬN ${formatT(ECONOMY.STARTING_BANKROLL)} VỐN KHỞI ĐIỂM`}
        </NeonButton>
      </form>
    </ScreenFrame>
  );
}
