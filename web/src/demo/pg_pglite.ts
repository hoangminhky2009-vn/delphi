/**
 * BẢN DEMO — `pg.Pool` GIẢ TRÊN MỘT PHIÊN PGlite (Postgres WASM) chạy trong Web Worker của trang.
 *
 * Server (`createApp`) viết cho node-pg: `pool.query` · `pool.connect()` → client có `query`/`release`, giao dịch bằng
 * `BEGIN`/`COMMIT` trên client. PGlite chỉ có MỘT phiên, nên:
 *   · `connect()` là ĐỘC QUYỀN theo hàng chờ — hai giao dịch không bao giờ đan câu vào nhau (BEGIN đè BEGIN là hỏng);
 *   · `query` lẻ chạy ngay (một người chơi, yêu cầu gần như tuần tự). Chạy giữa lúc một giao dịch đang mở thì nó thành
 *     một phần giao dịch ấy — với một người chơi, trên dữ liệu đóng tab là mất, cái giá đó chấp nhận được; đợi hàng chờ
 *     thì một lời gọi `pool.query` từ BÊN TRONG giao dịch (có thật ở vài đường) sẽ khoá chết.
 *
 * Hai chỗ PHẢI giống node-pg, đã đo trên chính server (thử khả thi 28/09):
 *   · `rowCount` = số dòng TRẢ VỀ (SELECT / RETURNING) hoặc số dòng BỊ ĐỔI — PGlite để `affectedRows = 0` cho SELECT, và
 *     `layTran` kiểm `rowCount === 0` ⇒ mọi trận "không thấy";
 *   · int8 trả CHUỖI (đặt ở `parsers` lúc dựng PGlite, không ở đây).
 */
import type { PGlite } from '@electric-sql/pglite';

interface KetQua { rows: any[]; rowCount: number; fields: any[] }

export function taoPoolPglite(db: PGlite) {
  let hangCho: Promise<void> = Promise.resolve();
  const doi = (r: { rows?: any[]; affectedRows?: number; fields?: any[] }): KetQua => {
    const rows = r.rows ?? [];
    return { rows, rowCount: rows.length > 0 ? rows.length : (r.affectedRows ?? 0), fields: r.fields ?? [] };
  };
  const chay = async (text: unknown, params?: unknown[]): Promise<KetQua> => {
    if (typeof text === 'object' && text !== null) {
      const q = text as { text: string; values?: unknown[] };
      return doi(await db.query(q.text, (q.values ?? params ?? []) as any[]));
    }
    const sql = String(text);
    // node-pg chạy được NHIỀU câu một chuỗi khi không có tham số (giao thức đơn giản); PGlite `query` thì không.
    if ((!params || params.length === 0) && /;\s*\S/.test(sql.replace(/'[^']*'/g, "''"))) {
      const ds = await db.exec(sql);
      return doi(ds[ds.length - 1] ?? { rows: [] });
    }
    return doi(await db.query(sql, (params ?? []) as any[]));
  };
  const pool = {
    query: (text: unknown, params?: unknown[]) => chay(text, params),
    async connect() {
      let tha!: () => void;
      const cho = new Promise<void>((ok) => { tha = ok; });
      const truoc = hangCho;
      hangCho = truoc.then(() => cho);
      await truoc;
      let daTra = false;
      return {
        query: (text: unknown, params?: unknown[]) => chay(text, params),
        release: () => { if (!daTra) { daTra = true; tha(); } },
      };
    },
    on: () => pool,
    end: async () => {},
    totalCount: 1, idleCount: 1, waitingCount: 0,
  };
  return pool;
}
