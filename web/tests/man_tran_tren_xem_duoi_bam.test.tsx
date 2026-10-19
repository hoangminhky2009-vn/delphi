/**
 * D443 — MÀN TRẬN: TRÊN ĐỂ XEM, DƯỚI ĐỂ BẤM · MỘT FONT · "TẬT" THÀNH TRAIT (founder 28/09).
 *
 * Founder: *"Cho mấy nút cần thao tác xuống dưới chỗ thao tác đi. Bỏ cái phần hiển thị lõi ở màn hình chính. Những gì
 * user ko thao tác được (Ngoại trừ avatar đối thủ) Thì hiện ở trên, những gì cần thao tác như bảng điện tử thì hiện ở
 * dưới. Thu nhỏ phần lãi suất và sổ lại tý. À mà đổi tên 'Tật' thành trait nhé."* — rồi: *"phải đồng bộ font chữ đi chứ
 * bro. nhìn thiếu chuyên nghiệp quá."*
 *
 *  §I   tên: không còn chữ "TẬT" / "tật" nào người chơi đọc được trong `web/src` (chú thích không tính).
 *  §II  dây nối màn trận: chip lãi suất · SỔ · BẢNG ĐIỆN TỬ không còn trong khối bản đồ mà đi qua `TayBai`
 *       (`congCu` · `ngan` · `bang`), mở ngăn này là cất ngăn kia; mã đang cầm ở khung NAV; hàng LÕI gỡ.
 *  §III `TayBai`: ngăn kéo → hàng công cụ → hàng nút; BẢNG đứng giữa SHOP và CHỐT; ALL-IN thay hàng nút, hàng công cụ còn.
 *  §IV  một font: khối HUD không vẽ chữ bằng `ChuPixel`; lưới ấy chỉ còn ở lớp phủ / màn kết cỡ lớn.
 *  §V   thang: mọi cỡ / giãn / nét chữ trong CSS của HUD màn trận đi theo token của `tokens.css`.
 * (Lớp phủ bảng điện tử ra `<body>` qua portal: canh ở `bangdientu.test.tsx` §D443.)
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HangMaCam, TayBai } from '../src/components/holdem/TayBai';

// Chuẩn hoá CRLF: tệp trên Windows mang CRLF, tìm theo xuống dòng mà không chuẩn hoá thì xanh giả / đỏ oan.
const doc = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
const bocChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const MAN = bocChuThich(doc('src/screens/holdem/AlphaDraftMatch.tsx'));

function tepDuoi(thu: string, duoi: RegExp): string[] {
  const ra: string[] = [];
  for (const ten of readdirSync(join(process.cwd(), thu))) {
    const p = `${thu}/${ten}`;
    if (statSync(join(process.cwd(), p)).isDirectory()) ra.push(...tepDuoi(p, duoi));
    else if (duoi.test(ten)) ra.push(p);
  }
  return ra;
}

describe('D443 §I — "TẬT" đổi thành TRAIT ở mọi chữ người chơi đọc', () => {
  it('⭐ không tệp nào trong web/src còn chữ TẬT / tật ngoài chú thích', () => {
    const con = tepDuoi('src', /\.(ts|tsx)$/)
      .filter((p) => /tật/i.test(bocChuThich(doc(p))));
    expect(con, `còn chữ "tật" người chơi đọc được ở: ${con.join(', ')}`).toEqual([]);
  });

  it('chợ trait: hàng thứ hai tên TRAIT; lá điểm âm nói "NHẬN TRAIT NÀY"', () => {
    expect(doc('src/components/holdem/ChoTrait.tsx')).toContain('<span className={s.nhanHang}>TRAIT</span>');
    expect(doc('src/components/holdem/TheTrait.tsx')).toContain("'NHẬN TRAIT NÀY'");
  });
});

describe('D443 §II — dây nối màn trận: trên để xem, dưới để bấm', () => {
  it('⭐ khối bản đồ không còn chip lãi suất, nút SỔ, nút BẢNG ĐIỆN TỬ', () => {
    const dau = MAN.indexOf('<div className={s.bd}>');
    const cuoi = MAN.indexOf('<MarketMap', dau);
    expect(dau).toBeGreaterThan(0);
    const khoi = MAN.slice(dau, cuoi);
    expect(khoi).not.toContain('data-tap="lai-suat"');
    expect(khoi).not.toContain('data-tap="so-lien-he"');
    expect(khoi).not.toContain('<BangDienTu');
    expect(khoi, 'bảng lãi suất không còn mở giữa bản đồ').not.toContain('s.lxPanel');
  });

  it('⭐ ba thứ ấy đi qua TayBai: congCu (chip) · ngan (bảng lãi suất / sổ) · bang (BẢNG ĐIỆN TỬ bản gọn)', () => {
    const tay = MAN.slice(MAN.indexOf('<TayBai'), MAN.indexOf('</div>', MAN.indexOf('dangGui={nop.isPending}')));
    expect(tay).toMatch(/congCu=\{\([\s\S]*?data-tap="lai-suat"[\s\S]*?data-tap="so-lien-he"/);
    expect(tay).toMatch(/ngan=\{moLX && stBan\.lai_suat \? \([\s\S]*?s\.lxPanel[\s\S]*?\) : moSo \? \([\s\S]*?<SoLienHe/);
    // D456 — thêm điều kiện thứ ba: luật v57 không bán Bảng điện tử (`khong_bang_dien_tu` từ DTO ghế) ⇒ không vẽ khối bảng.
    expect(tay).toMatch(/bang=\{!b\.da_chay && b\.tu_the !== 'all_in' && !b\.khong_bang_dien_tu \? \(\s*<BangDienTu[\s\S]*?\bgon\b[\s\S]*?\/>/);
    expect(tay, 'ALL-IN: dòng báo thay HÀNG NÚT, không thay cả thanh').toMatch(/thayHangNut=\{daAllIn \? \(/);
  });

  it('mở ngăn này là cất ngăn kia (một ngăn kéo mỗi lúc)', () => {
    expect(MAN).toMatch(/onClick=\{\(\) => \{ setMoSo\(false\); setMoLX\(\(v\) => !v\); \}\}/);
    expect(MAN).toMatch(/onClick=\{\(\) => \{\s*setMoLX\(false\);\s*setMoSo\(/);
  });

  it('⭐ mã đang cầm (chỉ để xem) đứng trong khung NAV, không ở thanh đáy', () => {
    const foot = MAN.indexOf('className={s.foot}');
    const day = MAN.indexOf('className={s.thanhDay}');
    const cam = MAN.indexOf('<HangMaCam maCam={maCamTay} />');
    expect(cam, 'thiếu hàng mã đang cầm').toBeGreaterThan(0);
    expect(cam > foot && cam < day, 'hàng mã đang cầm phải nằm trong khung NAV (trước thanh đáy)').toBe(true);
  });

  it('⭐ hàng LÕI gỡ khỏi màn chính', () => {
    expect(MAN).not.toMatch(/loiCam|onChamLoi/);
    const con = tepDuoi('src', /\.tsx$/).filter((p) => doc(p).includes('CHƯA CÓ LÕI'));
    expect(con).toEqual([]);
  });
});

describe('D443 §III — TayBai: ngăn kéo → hàng công cụ → hàng nút', () => {
  const ve = (them: Partial<Parameters<typeof TayBai>[0]> = {}) => render(
    <TayBai
      congCu={<button type="button" data-t="chip">🏦 4.00%</button>}
      ngan={<div data-t="ngan">BẢNG LÃI SUẤT</div>}
      bang={<button type="button" data-t="bang">BẢNG</button>}
      nhipPhai={<span data-t="so">+2,0%</span>}
      shopMo={false} onShop={() => {}} soTheChon={0} onChotVong={() => {}} onBo={() => {}}
      {...them}
    />,
  );
  const truoc = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

  it('⭐ ngăn kéo nằm TRÊN hàng công cụ; con số vòng ở hàng công cụ; BẢNG giữa SHOP và CHỐT', () => {
    const { container } = ve();
    const ngan = container.querySelector('[data-t="ngan"]')!;
    const chip = container.querySelector('[data-t="chip"]')!;
    const so = container.querySelector('[data-t="so"]')!;
    const shop = screen.getByRole('button', { name: 'Mở shop chi tiết' });
    const bang = container.querySelector('[data-t="bang"]')!;
    const chot = screen.getByRole('button', { name: /CHỐT VÒNG/ });
    expect(truoc(ngan, chip)).toBe(true);
    expect(chip.parentElement).toBe(so.closest('[role="status"]')!.parentElement);
    expect(truoc(shop, bang) && truoc(bang, chot)).toBe(true);
  });

  it('vắng ngăn kéo ⇒ không có khung ngăn rỗng', () => {
    const { container } = ve({ ngan: undefined });
    expect(container.querySelector('[class*="ngan"]')).toBeNull();
  });

  it('ALL-IN: dòng báo thay HÀNG NÚT — hàng công cụ vẫn đứng (xem lãi suất / sổ / VÌ SAO vẫn được)', () => {
    const { container } = ve({ thayHangNut: <div data-t="bao">ĐÃ DỒN HẾT</div> });
    expect(container.querySelector('[data-t="bao"]')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /CHỐT VÒNG/ })).toBeNull();
    expect(container.querySelector('[data-t="chip"]')).not.toBeNull();
    expect(container.querySelector('[data-t="so"]')).not.toBeNull();
  });

  it('HangMaCam: vùng live; trống ⇒ "CHƯA CẦM MÃ NÀO"; có mã ⇒ nhãn ĐANG CẦM + tên từng mã', () => {
    const { rerender, container } = render(<HangMaCam maCam={[]} />);
    expect(screen.getByRole('status').textContent).toBe('CHƯA CẦM MÃ NÀO');
    rerender(<HangMaCam maCam={[
      { ma: 'vang', ten: 'Vàng', giaTri: 5000, chipDay: 2, chipManh: 0 },
      { ma: 'khong:crypto', ten: 'KHỐNG Crypto', giaTri: 2500, chipDay: 1, chipManh: 0, khong: true },
    ]} />);
    const hang = screen.getByRole('status');
    expect(hang.textContent).toBe('ĐANG CẦMVàngKHỐNG Crypto');
    expect(hang.getAttribute('data-tap')).toBe('dang-cam');
    expect(container.querySelectorAll('[aria-hidden] i').length, 'cọc chip 2 + 1').toBe(3);
  });
});

describe('D443 §IV — một font: HUD màn trận không vẽ chữ bằng ChuPixel', () => {
  it('⭐ chỉ lớp phủ / màn kết (chữ cỡ lớn, đứng một mình) còn dùng lưới ChuPixel', () => {
    const dung = tepDuoi('src', /\.tsx$/)
      .filter((p) => !p.endsWith('/ChuPixel.tsx'))
      .filter((p) => /import \{[^}]*\bChuPixel\b[^}]*\} from/.test(doc(p)))
      .map((p) => p.split('/').pop())
      .sort();
    expect(dung).toEqual(['ChuHang.tsx', 'LoiGay.tsx', 'MomentOverlay.tsx', 'PhongCachKet.tsx']);
  });
});

describe('D443 §V — thang chữ: cỡ · giãn · nét của HUD màn trận đi theo token', () => {
  const TEP = [
    'src/screens/holdem/AlphaDraftMatch.module.css',
    'src/components/holdem/TayBai.module.css',
    'src/components/holdem/DoiThuStrip.module.css',
    'src/components/holdem/MarketMap.module.css',
    'src/components/holdem/DaiThiTruong.module.css',
    'src/components/holdem/ChuongHoi.module.css',
    'src/components/holdem/GiaiVong.module.css',
    'src/components/holdem/KhayTrait.module.css',
    'src/components/holdem/SoNhipVong.module.css',
    'src/components/holdem/ThanhPhongCach.module.css',
    'src/components/holdem/DongHoVong.module.css',
  ];
  // Miễn khoá theo (tệp, bộ chọn) — không theo tên trơn (bài học 15/09).
  const MIEN: Record<string, string> = {
    'MarketMap.module.css|.upArt': 'HÌNH dấu ? trên lá úp (art), không phải chữ để đọc',
  };
  const CO = /^(var\(--fs-(micro|label|meta|body|human|title|stat|hero)\)|inherit)$/;
  const GIAN = /^(0|normal|var\(--ls-(nut|nhan)\))$/;
  const NET = /^(400|600|800|inherit|var\(--font-dam\))$/;

  const khoi = (p: string) => {
    const s = doc(p).replace(/\/\*[\s\S]*?\*\//g, '');
    return [...s.matchAll(/([^{}]*)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.split(/\s+/).join(' ').trim(), than: m[2]! }));
  };

  it('⭐ font-size / letter-spacing / font-weight chỉ nhận giá trị trên thang', () => {
    const sai: string[] = [];
    for (const p of TEP) {
      const ten = p.split('/').pop()!;
      for (const { sel, than } of khoi(p)) {
        for (const [, thuoc, gt] of than.matchAll(/(font-size|letter-spacing|font-weight):\s*([^;]+);/g)) {
          const v = gt!.trim();
          const dung = thuoc === 'font-size' ? CO.test(v) || MIEN[`${ten}|${sel}`] !== undefined
            : thuoc === 'letter-spacing' ? GIAN.test(v) : NET.test(v);
          if (!dung) sai.push(`${ten} ${sel} { ${thuoc}: ${v} }`);
        }
      }
    }
    expect(sai, `lệch thang:\n${sai.join('\n')}`).toEqual([]);
  });

  it('danh sách miễn không thành rác: mỗi mục miễn còn đúng bộ chọn ấy trong đúng tệp ấy', () => {
    for (const k of Object.keys(MIEN)) {
      const [ten, sel] = k.split('|');
      const p = TEP.find((x) => x.endsWith(`/${ten}`))!;
      expect(khoi(p).some((b) => b.sel === sel), `miễn ${k} nhưng bộ chọn không còn`).toBe(true);
    }
  });

  it('tokens.css khai đủ hai nấc giãn chữ mới', () => {
    const t = doc('src/styles/tokens.css');
    expect(t).toMatch(/--ls-nut:\s*0\.08em;/);
    expect(t).toMatch(/--ls-nhan:\s*0\.12em;/);
  });
});

describe('D443 §VI — không cỡ / nét / giãn chữ gõ tay inline trong khối HUD màn trận', () => {
  it('⭐ không `fontSize` / `letterSpacing` / `fontWeight` trong style inline của màn trận và các khối HUD', () => {
    const TSX = [
      'src/screens/holdem/AlphaDraftMatch.tsx',
      'src/components/holdem/TayBai.tsx',
      'src/components/holdem/DoiThuStrip.tsx',
      'src/components/holdem/MarketMap.tsx',
      'src/components/holdem/DaiThiTruong.tsx',
      'src/components/holdem/ChuongHoi.tsx',
      'src/components/holdem/GiaiVong.tsx',
      'src/components/holdem/SoNhipVong.tsx',
      'src/components/holdem/ThanhPhongCach.tsx',
      'src/components/holdem/DongHoVong.tsx',
    ];
    const sai = TSX.filter((p) => /\b(fontSize|letterSpacing|fontWeight)\s*:/.test(bocChuThich(doc(p))));
    expect(sai).toEqual([]);
  });

  it('mũi ▾ ▴ ▸ của thanh đáy vẽ bằng viền (`s.mui`), không phải ký tự Handjet không có', () => {
    expect(MAN).toMatch(/SỔ<i className=\{`\$\{s\.mui\} \$\{moSo \? s\.muiLen : ''\}`\} aria-hidden \/>/);
    expect(MAN).toMatch(/\{moLyDo \? 'ẨN' : 'VÌ SAO'\}<i className=\{`\$\{s\.mui\} \$\{moLyDo \? '' : s\.muiPhai\}`\}/);
    const thanhDay = MAN.slice(MAN.indexOf('<TayBai'), MAN.indexOf('dangGui={nop.isPending}'));
    expect(thanhDay).not.toMatch(/[▾▴▸]/);
  });
});
