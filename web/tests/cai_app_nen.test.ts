/**
 * NHẬN DIỆN NƠI APP CHẠY (`web/src/lib/cai_app.ts`, D603 · SPEC `cai-app-pfm-trong-ban-cai` mục 5).
 *
 * Bài này canh hai điều có giá:
 *   · Trình duyệt NHÚNG (Zalo/Messenger/Facebook/TikTok) mang luôn chữ `Safari`/`Chrome` của lõi bên dưới — đọc sai thứ tự
 *     là bảo người trong Zalo "bấm Chia sẻ → Thêm vào MH chính", một lối không tồn tại.
 *   · "ĐÃ CÀI" phải đọc `display-mode`, KHÔNG đoán từ UA: cùng một UA Safari vừa là tab vừa là bản cài.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cheDoHienThi, daCai, nhanDien, type MoiTruong } from '../src/lib/cai_app';

const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  ipadMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.71 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  zaloAndroid: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 Zalo android/12100626 ZaloTheme/light ZaloLanguage/vn',
  zaloIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/24.05.01 ZaloTheme/light ZaloLanguage/vn',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/600000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/vi_VN;FBOP/5]',
  messengerIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/460.0.0.36.106;FBBV/580000000;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5]',
  instagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36 Instagram 337.0.0.35.102 Android',
  tiktok: 'Mozilla/5.0 (Linux; Android 13; SM-A536E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36 musical_ly_2023405030 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/34.5.3 ByteLocale/vi',
  androidWebview: 'Mozilla/5.0 (Linux; Android 13; Redmi Note 12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.230 Mobile Safari/537.36',
  firefoxDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  chromeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  edgeDesktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.2592.68',
};

describe('I. Bảng UA → nền · trình duyệt · cách cài', () => {
  const ca: [string, string, MoiTruong, { diemCham?: number; trongKhung?: boolean }?][] = [
    ['Safari iPhone', UA.iosSafari, { nen: 'ios', trinhDuyet: 'safari', cachCai: 'huong_dan_ios' }],
    ['Chrome iPhone (CriOS) — iOS 16.4+ cũng Thêm vào MH chính', UA.iosChrome, { nen: 'ios', trinhDuyet: 'chrome', cachCai: 'huong_dan_ios' }],
    ['iPad khai UA Mac — lộ ra nhờ điểm chạm', UA.ipadMac, { nen: 'ios', trinhDuyet: 'safari', cachCai: 'huong_dan_ios' }, { diemCham: 5 }],
    ['Safari máy Mac thật (0 điểm chạm)', UA.ipadMac, { nen: 'desktop', trinhDuyet: 'safari', cachCai: 'mo_trinh_duyet' }, { diemCham: 0 }],
    ['Chrome Android', UA.androidChrome, { nen: 'android', trinhDuyet: 'chrome', cachCai: 'mot_cham' }],
    ['Samsung Internet', UA.samsung, { nen: 'android', trinhDuyet: 'samsung', cachCai: 'mot_cham' }],
    ['Zalo Android', UA.zaloAndroid, { nen: 'nhung', trinhDuyet: 'zalo', cachCai: 'mo_trinh_duyet' }],
    ['Zalo iPhone', UA.zaloIos, { nen: 'nhung', trinhDuyet: 'zalo', cachCai: 'mo_trinh_duyet' }],
    ['Facebook iPhone', UA.facebookIos, { nen: 'nhung', trinhDuyet: 'facebook', cachCai: 'mo_trinh_duyet' }],
    ['Messenger iPhone — không bị đọc thành Facebook', UA.messengerIos, { nen: 'nhung', trinhDuyet: 'messenger', cachCai: 'mo_trinh_duyet' }],
    ['Instagram', UA.instagram, { nen: 'nhung', trinhDuyet: 'instagram', cachCai: 'mo_trinh_duyet' }],
    ['TikTok', UA.tiktok, { nen: 'nhung', trinhDuyet: 'tiktok', cachCai: 'mo_trinh_duyet' }],
    ['WebView trần của app lạ', UA.androidWebview, { nen: 'nhung', trinhDuyet: 'webview', cachCai: 'mo_trinh_duyet' }],
    ['Firefox máy tính — không cài được', UA.firefoxDesktop, { nen: 'desktop', trinhDuyet: 'firefox', cachCai: 'mo_trinh_duyet' }],
    ['Chrome máy tính', UA.chromeDesktop, { nen: 'desktop', trinhDuyet: 'chrome', cachCai: 'mot_cham' }],
    ['Edge máy tính', UA.edgeDesktop, { nen: 'desktop', trinhDuyet: 'edge', cachCai: 'mot_cham' }],
    ['Discord Activity (iframe) — thắng cả UA', UA.chromeDesktop, { nen: 'nhung', trinhDuyet: 'discord', cachCai: 'mo_ngoai_discord' }, { trongKhung: true }],
  ];
  it.each(ca)('%s', (_ten, ua, mong, co) => {
    expect(nhanDien(ua, co)).toEqual(mong);
  });

  it('⭐ không trình duyệt nhúng nào được hướng dẫn "Thêm vào MH chính" — lối ấy không tồn tại trong Zalo/FB', () => {
    for (const ua of [UA.zaloIos, UA.facebookIos, UA.messengerIos]) {
      expect(nhanDien(ua).cachCai, ua.slice(-60)).toBe('mo_trinh_duyet');
    }
  });
});

describe('II. "ĐÃ CÀI" đọc display-mode, không đoán từ UA', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function giaMatchMedia(standalone: boolean): void {
    vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({
      matches: standalone && q === '(display-mode: standalone)',
      media: q, onchange: null, addListener: () => undefined, removeListener: () => undefined,
      addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false,
    }) as MediaQueryList);
  }

  it('mở từ icon màn hình chính (standalone) ⇒ đã cài', () => {
    giaMatchMedia(true);
    expect(daCai()).toBe(true);
    expect(cheDoHienThi()).toBe('standalone');
  });

  it('tab trình duyệt thường ⇒ chưa cài', () => {
    giaMatchMedia(false);
    expect(daCai()).toBe(false);
    expect(cheDoHienThi()).toBe('browser');
  });

  it('iOS cũ chỉ trả lời qua navigator.standalone', () => {
    giaMatchMedia(false);
    vi.stubGlobal('navigator', { ...navigator, standalone: true });
    expect(daCai()).toBe(true);
  });

  it('matchMedia ném ⇒ "chưa cài" (tệ nhất là thấy lời mời thêm một lần), không làm sập app', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(() => { throw new Error('x'); });
    expect(daCai()).toBe(false);
  });
});
