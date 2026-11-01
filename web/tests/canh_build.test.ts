/**
 * BÀI CANH CỦA BÀI CANH BUILD (`web/scripts/canh_build.mjs`, D603 đợt 2): bài thật chạy trên `web/dist` ở CI sau `vite build`; ở đây
 * dựng một dist GIẢ đủ bốn điều rồi tiêm từng lỗi — bài canh phải đỏ đúng lỗi ấy, không lỗi nào khác.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error — tệp .mjs không có khai báo kiểu; chỉ dùng hai hàm thuần của nó.
import { kiemBuild, TRAN_PRECACHE } from '../scripts/canh_build.mjs';

const kiem = kiemBuild as (dist: string) => string[];
const tam: string[] = [];
afterEach(() => { for (const d of tam.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

function dungDist(sua: Partial<{ manifest: object; html: string; js: string; coSw: boolean; jsByte: number }> = {}): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'canh-build-'));
  tam.push(d);
  fs.mkdirSync(path.join(d, 'assets'));
  fs.writeFileSync(path.join(d, 'manifest.webmanifest'), JSON.stringify(sua.manifest ?? { display: 'standalone', start_url: '/' }));
  fs.writeFileSync(path.join(d, 'index.html'), sua.html ?? '<head><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" /></head>');
  fs.writeFileSync(path.join(d, 'assets', 'index-abc.js'), (sua.js ?? 'console.log(1)') + ' '.repeat(sua.jsByte ?? 0));
  if (sua.coSw !== false) {
    fs.writeFileSync(path.join(d, 'sw.js'), 'precacheAndRoute([{url:"assets/index-abc.js",revision:null},{url:"index.html",revision:"1"}])');
  }
  return d;
}

describe('canh_build.mjs', () => {
  it('dist đủ bốn điều ⇒ xanh', () => {
    expect(kiem(dungDist())).toEqual([]);
  });
  it('manifest không standalone ⇒ đỏ', () => {
    expect(kiem(dungDist({ manifest: { display: 'browser', start_url: '/' } })).join()).toMatch(/manifest\.display/);
  });
  it('start_url khác "/" ⇒ đỏ', () => {
    expect(kiem(dungDist({ manifest: { display: 'standalone', start_url: '/tai-chinh' } })).join()).toMatch(/start_url/);
  });
  it('thiếu meta status bar iOS ⇒ đỏ', () => {
    expect(kiem(dungDist({ html: '<head></head>' })).join()).toMatch(/apple-mobile-web-app-status-bar-style/);
  });
  it('⭐ E10 — gói prod còn chuỗi giả lập "ban_cai" ⇒ đỏ, chỉ đúng tệp ấy', () => {
    const l = kiem(dungDist({ js: 'if(new URLSearchParams(location.search).get("ban_cai")==="1"){}' }));
    expect(l).toHaveLength(1);
    expect(l[0]).toMatch(/ban_cai.*assets[\\/]index-abc\.js/);
  });
  it('precache vượt 3 MB ⇒ đỏ (câu "dưới 3 MB" ở cổng phải sửa)', () => {
    expect(kiem(dungDist({ jsByte: TRAN_PRECACHE + 1 })).join()).toMatch(/precache .* > 3 MB/);
  });
  it('thiếu sw.js ⇒ đỏ (không đo được thì không được coi là xanh)', () => {
    expect(kiem(dungDist({ coSw: false })).join()).toMatch(/thiếu sw\.js/);
  });
});
