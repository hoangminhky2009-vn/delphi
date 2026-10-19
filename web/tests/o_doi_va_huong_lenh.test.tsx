/**
 * D302 — ba chỗ màn trận phải NÓI THẬT sau khi founder chơi prod 07/09:
 *
 * 1. DẢI ĐỐI THỦ: từ v10a máy cược tắt nên nhãn GIỮ VỊ THẾ dán lên cả bàn suốt trận
 *    ("chẳng thấy đối thủ làm gì"). Có `huong_lenh` thì dải nói VÀO / RA / ĐẢO / ĐỨNG;
 *    trận cũ không có trường thì nhãn cược + HIT như trước; cắt lỗ vẫn thắng.
 * 2. BẢNG VÌ SAO: ô vừa chơi bị đám đông đổi thì phải kể ô đáng lẽ là gì và vì sao
 *    (luật 03 §3 "lộ ex-post BẮT BUỘC" — trước đây engine đổi 22,5% số vòng mà màn
 *    im lặng, người chơi đọc là "chuỗi ô ngẫu nhiên").
 * 3. SHOP LÕI: lấy đủ 1 lá thì lá còn lại xám và chạm vào không có gì xảy ra — trên
 *    điện thoại không có con trỏ "not-allowed", nên người mới đọc là "lõi bị lỗi khi
 *    chọn". Đầu mục phải nói đã lấy gì và đổi bằng cách nào.
 *
 * Đo bằng chữ + `data-*`, không bám class (CSS Modules băm tên).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeQueryClient, queryKeys } from '@/api/queries';
import type { DoiThuDTO, KetQuaGheDTO, KetQuaVongDTO } from '@/api/holdem';
import { DoiThuStrip } from '@/components/holdem/DoiThuStrip';
import { ChainReveal } from '@/components/holdem/ChainReveal';
import { ShopManHinh } from '@/components/holdem/ShopManHinh';
import { ME_ONBOARDED } from './helpers';

function ketQua(patch: Partial<KetQuaGheDTO> & { ghe_id: string }): KetQuaGheDTO {
  return {
    pnl_bp: 0, da_cat_lo: false, cam_ket: 500, von_truoc: 10000, von_sau: 10000,
    hanh_dong: 'giu_vi_the', da_hit: false, ...patch,
  };
}

function dungDai(vongTruoc: Map<string, KetQuaGheDTO>) {
  const qc = makeQueryClient();
  qc.setQueryData(queryKeys.me, ME_ONBOARDED);
  const doiThu: DoiThuDTO[] = [
    {
      ghe_id: 'bot_1', loai: 'bot', ten: 'Máy · Thợ săn đáy', bac_rank: 'Đồng',
      von: 9000, con_song: true, so_the: 2, fx: 'binh_thuong',
    },
    {
      ghe_id: 'bot_2', loai: 'bot', ten: 'Máy · Cá mập', bac_rank: 'Đồng',
      von: 30000, con_song: true, so_the: 3, fx: 'binh_thuong',
    },
  ];
  return render(
    <QueryClientProvider client={qc}>
      <DoiThuStrip
        doiThu={doiThu}
        vongTruoc={vongTruoc}
        ban={{ von: 10000, so_the: 2, bac_rank: 'Đồng', con_song: true, fx: 'binh_thuong' }}
      />
    </QueryClientProvider>,
  );
}

describe('DoiThuStrip — hướng lệnh (D302)', () => {
  it('trận NAV: VÀO / ĐỨNG / ĐẢO thay GIỮ VỊ THẾ; HIT ẩn khi đã có hướng', () => {
    dungDai(new Map([
      ['bot_1', ketQua({ ghe_id: 'bot_1', huong_lenh: 'vao', da_hit: true })],
      ['bot_2', ketQua({ ghe_id: 'bot_2', huong_lenh: 'dung' })],
      ['ban', ketQua({ ghe_id: 'ban', huong_lenh: 'dao', da_hit: true })],
    ]));
    expect(screen.getByText('VÀO')).toBeInTheDocument();
    expect(screen.getByText('ĐỨNG')).toBeInTheDocument();
    expect(screen.getByText('ĐẢO')).toBeInTheDocument();
    expect(screen.queryByText('GIỮ VỊ THẾ')).toBeNull();
    expect(screen.queryByText('HIT')).toBeNull();
    expect(document.querySelectorAll('[data-huong-lenh]')).toHaveLength(3);
    expect(document.querySelector('[data-huong-lenh="vao"]')?.textContent).toBe('VÀO');
  });

  it('trận cũ (không có huong_lenh): nhãn cược + HIT như trước — client không tự suy', () => {
    dungDai(new Map([
      ['bot_1', ketQua({ ghe_id: 'bot_1', hanh_dong: 'tang_cam_ket', da_hit: true })],
    ]));
    expect(screen.getByText('TĂNG CAM KẾT')).toBeInTheDocument();
    expect(screen.getByText('HIT')).toBeInTheDocument();
    expect(document.querySelectorAll('[data-huong-lenh]')).toHaveLength(0);
  });

  it('cắt lỗ thắng hướng lệnh: vẫn CẮT LỖ, không RA', () => {
    dungDai(new Map([
      ['bot_1', ketQua({ ghe_id: 'bot_1', da_cat_lo: true, hanh_dong: 'cat_lo', huong_lenh: 'ra' })],
    ]));
    expect(screen.getByText('CẮT LỖ')).toBeInTheDocument();
    expect(screen.queryByText('RA')).toBeNull();
  });
});

const GIAI_DOAN = [
  { id: 'di_ngang', label: 'Đi ngang', icon: '➖' },
  { id: 'giam', label: 'Giảm', icon: '📉' },
  { id: 'tang', label: 'Tăng', icon: '📈' },
];
const SU_KIEN = [{ id: 'hack_san', label: 'Hack sàn', icon: '💀' }];

function veVong(patch: Partial<KetQuaVongDTO>) {
  const kq: KetQuaVongDTO = {
    vong: 3,
    o: { kind: 'giai_doan', giai_doan: 'giam' },
    tin_gia_lo: null,
    quy_vong: 4000,
    ghe_thang: 'ban',
    chay_vong_nay: [],
    cua_ban: { ...ketQua({ ghe_id: 'ban' }), chain: [] },
    cua_doi_thu: [],
    phi_cua_ban: null,
    ty_le_cat_lo_bp: 0,
    ...patch,
  };
  return render(
    <ChainReveal
      kq={kq} deltaVon={0} taiSan={[]} chienThuat={[]} giaiDoan={GIAI_DOAN} suKien={SU_KIEN}
    />,
  );
}

describe('ChainReveal — đám đông đổi ô, lộ ex-post (D302)', () => {
  it('phản thân: băng ĐÁM ĐÔNG ĐỔI Ô kể ô đáng lẽ là gì, vì sao, và chợ lật gì', () => {
    veVong({ o_doi: { boi: 'phan_than', tu: 'di_ngang', den: 'giam', vi: 'don' } });
    expect(screen.getByText('ĐÁM ĐÔNG ĐỔI Ô')).toBeInTheDocument();
    expect(screen.getByText(/đáng lẽ là "Đi ngang"/)).toBeInTheDocument();
    expect(screen.getByText(/dồn vào rủi ro hai vòng liền/)).toBeInTheDocument();
    expect(screen.getByText(/nên chợ lật "Giảm"/)).toBeInTheDocument();
    expect(document.querySelector('[data-o-doi="phan_than"]')).not.toBeNull();
  });

  it('bẻ chuỗi bằng vốn: lời nói chuỗi bị bẻ; không có o_doi thì không có băng', () => {
    const a = veVong({ o_doi: { boi: 'be_chuoi', tu: 'giam', den: 'tang', vi: 'len' } });
    expect(screen.getByText(/chuỗi bị bẻ LÊN/)).toBeInTheDocument();
    expect(screen.getByText(/nên chợ lật "Tăng"/)).toBeInTheDocument();
    a.unmount();
    veVong({});
    expect(screen.queryByText('ĐÁM ĐÔNG ĐỔI Ô')).toBeNull();
  });
});

function stubReducedMotion() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
}

function dungShopLoi(chonCT: string | null) {
  stubReducedMotion();
  return render(
    <ShopManHinh
      vong={2}
      loaiVongNay="chien_thuat"
      vongMoTiepTheo={{ tai_san: null, chien_thuat: null }}
      taiSan={[]}
      chienThuat={[
        { id: 'don_bay', ten: 'ĐÒN BẨY', mau: ['#000', '#fff'] as const },
        { id: 'luot_song', ten: 'LƯỚT SÓNG', mau: ['#000', '#fff'] as const },
      ]}
      chonTS={[]}
      chonCT={chonCT}
      onChonTS={() => {}}
      onChonCT={() => {}}
      danhMuc={[]}
      sucChuaTaiSan={3}
      sucChuaChienThuat={3}
      art={{}}
      ganVao={null}
      onGan={() => {}}
      phamViThe={() => 'danh_muc'}
      chiPhiRoll={1}
      luotConLai={1}
      onRoll={() => {}}
      onDong={() => {}}
      tuDien={{ muc: [] } as never}
      giaiDoanNhan={[]}
      suKienNhan={[]}
      moTaChienThuat={() => undefined}
    />,
  );
}

describe('ShopManHinh — lá lõi thứ hai không bị nuốt im lặng (D302)', () => {
  it('chưa lấy: "riêng bạn · lấy 1 · giữ vĩnh viễn"; đã lấy: nói lấy gì và đổi bằng cách nào', () => {
    const a = dungShopLoi(null);
    expect(screen.getByText('riêng bạn · lấy 1 · giữ vĩnh viễn')).toBeInTheDocument();
    expect(document.querySelector('[data-da-lay]')).toBeNull();
    a.unmount();

    dungShopLoi('don_bay');
    expect(screen.getByText('đã lấy ĐÒN BẨY · chạm lại lá đó để đổi')).toBeInTheDocument();
    expect(document.querySelector('[data-da-lay="don_bay"]')).not.toBeNull();
    expect(screen.queryByText('riêng bạn · lấy 1 · giữ vĩnh viễn')).toBeNull();
  });
});
