/**
 * TESTER MODE — năm quyền cheat cho tài khoản thử nghiệm (0052).
 *
 * Founder 03/09/2026: *"cấp toàn quyền cho tài khoản admin để làm tester nhé.
 * Như kiểu cheat luôn ấy"*. Danh sách NĂM quyền do founder duyệt — file này
 * dựng ĐÚNG bốn trong năm (cấp token · mở khoá cosmetics · đặt lại tiến trình
 * · [ép tham số lúc tạo trận nằm ở `server/holdem_api.ts`, cùng route
 * `POST /holdem/matches` — không dựng một đường song song, xem A11.5]).
 *
 * ⚠⚠ GÁC BẰNG CẢ HAI: mọi route ở đây đi qua `requireAdmin` (2FA + hạn quyền)
 * VÀ `requireTester` (role=admin và la_tester) VÀ `requireXacThucLai` (vừa xác
 * thực lại) — cùng hạng với resolve/huỷ kèo, vì cả ba quyền ở đây đều đụng tới
 * số dư/điểm không hoàn tác dễ dàng. Xem lý lẽ đầy đủ ở `server/admin_bao_mat.ts`
 * ngay trên `laTester()`.
 *
 * MỌI THAO TÁC GHI `admin_audit` (append-only) — đây là sổ DUY NHẤT nói rằng
 * một con số vừa được CONJURED thay vì kiếm được (A11 luật 6: nghiệm thu =
 * tiêm lỗi ngược, không phải "trông ổn").
 */
import { Hono } from 'hono';
import type pg from 'pg';
import { AVATAR_NEN, NHAN_DAN } from '../config/avatar.js';
import { taoAvatarNen } from './avatar.js';
import { currentSeasonId } from './season.js';
import { capMonHuuHan, docTonKho, ShopError } from './shop_kho.js';
import { requireTester } from './admin_bao_mat.js';

import { ducBanThe } from './kinh_te/so_vat.js';
import type { Env, Mw as Middleware } from './http/types.js';

async function auditTester(
  db: pg.Pool | pg.PoolClient,
  adminId: string,
  action: string,
  payload: unknown,
): Promise<void> {
  await db.query(
    `INSERT INTO admin_audit (admin_id, action, payload_json) VALUES ($1, $2, $3)`,
    [adminId, action, JSON.stringify(payload)],
  );
}

export function registerAdminTesterRoutes(
  app: Hono<Env>,
  pool: pg.Pool,
  mw: {
    requireAuth: Middleware; requireOnboarded: Middleware;
    requireAdmin: Middleware; requireXacThucLai: Middleware;
  },
): void {
  // Cùng hạng "không hoàn tác dễ dàng" với resolve/huỷ kèo — xem docstring trên.
  const guard = [
    mw.requireAuth, mw.requireOnboarded, mw.requireAdmin, requireTester, mw.requireXacThucLai,
  ] as const;

  // =========================================================================
  // 1. CẤP TOKEN — mint T trực tiếp vào ví CỦA CHÍNH TESTER.
  //
  // Một ledger THẬT (reason 'admin_adjust', đã có sẵn trong CHECK của
  // wallet_ledger từ 0001) trong CÙNG transaction với UPDATE bankroll — đây là
  // lý do `npm run audit:supply` vẫn báo CÂN sau lượt cấp (server/audit.ts:
  // `mintedWallet` cộng cả 'signup_grant' lẫn 'admin_adjust'). C5: chỉ nhận số
  // nguyên; `so_luong <= 0` bị chặn Ở CỬA — một khoản cấp không dương không
  // phải một khoản cấp.
  // =========================================================================
  app.post('/api/v1/admin/tester/token', ...guard, async (c) => {
    const actor = c.get('actor');
    const body = await c.req.json().catch(() => null) as { so_luong?: unknown } | null;
    const soLuong = body?.so_luong;
    if (!Number.isInteger(soLuong) || (soLuong as number) <= 0) {
      return c.json({
        error: 'invalid_input', field: 'so_luong',
        message: 'so_luong phải là số nguyên dương (C5 — không có T phân số, không cấp số 0/âm).',
      }, 400);
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT bankroll FROM users WHERE user_id = $1 FOR UPDATE`, [actor.userId]);
      if (!rows[0]) {
        await client.query('ROLLBACK');
        return c.json({ error: 'khong_co_ho_so' }, 404);
      }
      const truoc = rows[0].bankroll as bigint;
      const sau = truoc + BigInt(soLuong as number);
      // Bất khả thi về mặt số học (so_luong > 0, truoc >= 0 do CHECK ở 0001) —
      // giữ lại tường minh vì "cấm kết quả âm" là điều kiện founder đặt tên,
      // không phải suy luận ngầm mà người đọc sau phải tự chứng minh lại.
      if (sau < 0n) {
        await client.query('ROLLBACK');
        return c.json({ error: 'ket_qua_am', message: 'Kết quả không được âm.' }, 400);
      }
      await client.query(`UPDATE users SET bankroll = $1 WHERE user_id = $2`,
        [sau.toString(), actor.userId]);
      await client.query(
        `INSERT INTO wallet_ledger (user_id, delta, balance_after, reason)
         VALUES ($1, $2, $3, 'admin_adjust')`,
        [actor.userId, String(soLuong), sau.toString()],
      );
      await auditTester(client, actor.userId!, 'tester_cap_token', {
        so_luong: soLuong, truoc: truoc.toString(), sau: sau.toString(),
      });
      await client.query('COMMIT');
      return c.json({ ok: true, bankroll: Number(sau) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // 4. MỞ KHOÁ TOÀN BỘ — cosmetics của CHÍNH tài khoản tester.
  //
  // ⚠⚠ BỎ QUA MÓN CÓ `gioi_han` HỮU HẠN, CÓ CHỦ Ý — không phải sót. D36 hứa
  // "số lượng cực ít" cho bậc epic; hứa đó SỐNG được là nhờ mọi lần cấp đều đi
  // qua `capMonHuuHan`/tồn kho thật (server/shop_kho.ts). Một cheat mà tự cấp
  // cho mình cả món hữu hạn là ĂN VÀO ĐÚNG nguồn cung mà người chơi thật sắp
  // tới sẽ rút ra từ hộp gacha — vi phạm đúng tinh thần "không mua lợi thế
  // bằng tiền/token" (A3.9), dù đường vào khác nhau. Khung (kind='khung')
  // không nằm trong hệ thống hữu hạn (không CHECK gioi_han nào áp lên nó —
  // xem `docTonKho`), nên cấp hết an toàn.
  //
  // "Cards" (thẻ chiến thuật) trong danh sách founder duyệt KHÔNG có ở đây:
  // không có bảng "đã mở khoá" nào cho chien_thuat — nó chỉ bị khoá bởi
  // `moKhoaTheoTran` (số trận đã xong) lúc TẠO TRẬN, và quyền đó đã mở cho
  // tester ở `POST /holdem/matches` (bỏ qua cổng `moKhoa`). Dựng thêm một
  // "khoá" giả ở đây là dựng một bản sao của luật đã sống nơi khác (D61).
  // =========================================================================
  app.post('/api/v1/admin/tester/mo-khoa', ...guard, async (c) => {
    const actor = c.get('actor');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ton = await docTonKho(client);

      const { rows: khungRows } = await client.query(
        `SELECT cosmetic_id FROM cosmetic_items WHERE kind = 'khung' AND trang_thai = 'song'`);
      let khungCap = 0;
      for (const r of khungRows) {
        const kq = await client.query(
          `INSERT INTO user_cosmetics (user_id, cosmetic_id, source)
           VALUES ($1, $2, 'merit') ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
          [actor.userId, r.cosmetic_id],
        );
        // Chỉ đúc khi thật sự vừa trao — xem lý do ở `server/nhiem_vu.ts`.
        if (kq.rowCount === 1) {
          await ducBanThe(client, {
            mauId: r.cosmetic_id, chuSoHuu: actor.userId!, nguon: 'tang', soLuong: 1,
          });
        }
        khungCap += kq.rowCount ?? 0;
      }

      let nenCap = 0; let nenBoQuaHuuHan = 0;
      for (const n of AVATAR_NEN) {
        const t = ton.get(n.id);
        if (t && t.gioiHan !== null) { nenBoQuaHuuHan += 1; continue; }
        await taoAvatarNen(client, actor.userId!, n.ma, 'merit');
        nenCap += 1;
      }

      /** Một lượng rộng rãi để test dán thoải mái mà không phải quay lại xin thêm. */
      const SO_LUONG_STICKER = 20;
      let stickerCap = 0; let stickerBoQuaHuuHanHoacTat = 0;
      for (const s of NHAN_DAN) {
        const t = ton.get(s.id);
        if (t && t.gioiHan !== null) { stickerBoQuaHuuHanHoacTat += 1; continue; }
        try {
          await capMonHuuHan(client, actor.userId!, s.id, SO_LUONG_STICKER);
          stickerCap += 1;
        } catch (e) {
          // Món vừa ngừng phát hành giữa lúc đọc catalog và lúc cấp — bỏ qua,
          // không sập cả lượt mở khoá vì một món không còn bán.
          if (!(e instanceof ShopError)) throw e;
          stickerBoQuaHuuHanHoacTat += 1;
        }
      }

      await auditTester(client, actor.userId!, 'tester_mo_khoa', {
        khung_cap: khungCap, nen_cap: nenCap, nen_bo_qua_huu_han: nenBoQuaHuuHan,
        sticker_cap: stickerCap, sticker_bo_qua: stickerBoQuaHuuHanHoacTat,
      });
      await client.query('COMMIT');
      return c.json({
        ok: true,
        khung_cap: khungCap,
        nen_cap: nenCap,
        nen_bo_qua_huu_han: nenBoQuaHuuHan,
        sticker_cap: stickerCap,
        sticker_bo_qua: stickerBoQuaHuuHanHoacTat,
      });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  // =========================================================================
  // 5. ĐẶT LẠI TIẾN TRÌNH — rank Đấu trường + Q của CHÍNH tester, về không.
  //
  // ⚠⚠ PHẠM VI CÓ CHỦ Ý HẸP HƠN CÂU "progression" NGHE CÓ VẺ NÓI — đọc trước
  // khi mở rộng nó:
  //
  //   · `quest_points`  → 0, qua MỘT dòng `quest_ledger` (reason 'admin_sua_q',
  //     đã có sẵn trong CHECK từ 0016 — không cần migration).
  //   · `rank_diem` (Đấu trường, mùa hiện tại) → 0, kèm MỘT dòng đối ứng ở
  //     `rank_quy_diem` (reason 'admin_sua', đã có sẵn từ 0017/0022) để BẤT
  //     BIẾN "Σ rank_diem.diem + rank_quy_diem.so_du_sau = 0 mỗi mùa"
  //     (`kiemToanLamPhat`, server/rank.ts) KHÔNG bị lệch — cùng cơ chế
  //     `ghiDiemPve` đã dùng để mint điểm PvE, chỉ đảo dấu vì đây là RÚT chứ
  //     không PHÁT.
  //
  //   · "Oracle Level"/XP (`GET /me/progress`) và "bậc dự báo" (Brier per-pool)
  //     KHÔNG bị đụng — cả hai là SỐ DẪN XUẤT từ `bets`/`holdem_results`/
  //     `rank_snapshots`, không lưu trạng thái nào để mà đặt lại. Xoá các bảng
  //     đó để "về 0" bị BÁC vì hai lý do không thương lượng được:
  //       (a) A3.8: "Lịch sử Brier không bao giờ xoá" — `rank_snapshots` là
  //           đúng bảng đó, xoá là phá bất biến cứng.
  //       (b) `holdem_results`/`bets`/`rank_ledger` là sổ VẾT TÍCH; xoá chúng
  //           xoá luôn chốt chặn "chống nhận thưởng hai lần" của các bảng liền
  //           kề (`nhiem_vu_xong`/`lo_trinh_nhan`) và phá khả năng đối chiếu
  //           của `kiemToanLamPhat`/`auditSupply` trên đúng những trận đã xảy
  //           ra thật. Không phải nợ kỹ thuật — là ranh giới không vượt qua.
  //     Tester muốn "như tài khoản mới" ở hai chỉ số này thì cách đúng là dùng
  //     một handle mới, không phải xoá lịch sử của handle cũ.
  // =========================================================================
  app.post('/api/v1/admin/tester/dat-lai', ...guard, async (c) => {
    const actor = c.get('actor');
    const seasonId = currentSeasonId();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: uRows } = await client.query(
        `SELECT quest_points FROM users WHERE user_id = $1 FOR UPDATE`, [actor.userId]);
      if (!uRows[0]) {
        await client.query('ROLLBACK');
        return c.json({ error: 'khong_co_ho_so' }, 404);
      }
      const qTruoc = uRows[0].quest_points as bigint;
      if (qTruoc !== 0n) {
        await client.query(`UPDATE users SET quest_points = 0 WHERE user_id = $1`, [actor.userId]);
        await client.query(
          `INSERT INTO quest_ledger (user_id, delta, balance_after, reason, season_id)
           VALUES ($1, $2, 0, 'admin_sua_q', $3)`,
          [actor.userId, (-qTruoc).toString(), seasonId],
        );
      }

      const { rows: rRows } = await client.query(
        `SELECT diem FROM rank_diem WHERE user_id = $1 AND season_id = $2 FOR UPDATE`,
        [actor.userId, seasonId],
      );
      let diemTruoc = 0;
      if (rRows[0] && Number(rRows[0].diem) !== 0) {
        diemTruoc = Number(rRows[0].diem);
        await client.query(
          `UPDATE rank_diem SET diem = 0, diem_dinh = 0, so_tran = 0, hang = NULL, updated_at = now()
            WHERE user_id = $1 AND season_id = $2`,
          [actor.userId, seasonId],
        );
        /*
         * Khoá cùng advisory lock với `ghiDiemPve` (server/rank.ts) — hai lượt
         * "trả điểm về quỹ" cùng mùa chạy song song không được phép cùng đọc
         * một `so_du_sau` cũ rồi cùng cộng lên, tức sổ chẻ nhánh.
         */
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('rank_quy_diem:' || $1))`,
          [seasonId]);
        const { rows: qd } = await client.query(
          `SELECT so_du_sau FROM rank_quy_diem WHERE season_id = $1
            ORDER BY entry_id DESC LIMIT 1`, [seasonId]);
        const soDuTruoc = qd[0] ? Number(qd[0].so_du_sau) : 0;
        // delta = +diemTruoc: quỹ NHẬN LẠI đúng phần vừa rút khỏi người chơi,
        // giữ Σ diem + quỹ không đổi (xem docstring trên).
        await client.query(
          `INSERT INTO rank_quy_diem (season_id, delta, so_du_sau, reason)
           VALUES ($1, $2, $3, 'admin_sua')`,
          [seasonId, diemTruoc, soDuTruoc + diemTruoc],
        );
      }

      await auditTester(client, actor.userId!, 'tester_dat_lai', {
        season_id: seasonId, quest_points_truoc: qTruoc.toString(), rank_diem_truoc: diemTruoc,
      });
      await client.query('COMMIT');
      return c.json({ ok: true, quest_points: 0, rank_diem: 0 });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });
}
