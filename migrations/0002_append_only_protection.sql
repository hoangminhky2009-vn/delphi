-- GĐ1 / Migration 0002 — Bảo vệ tầng DB (A3.3, A3.10):
-- chặn UPDATE / DELETE / TRUNCATE trên các bảng append-only bằng trigger.
-- Cấp permission là tầng bảo vệ thứ hai (tùy môi trường deploy, thêm sau);
-- trigger đảm bảo bất biến kể cả khi kết nối bằng role owner.

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Bảng % là append-only: % bị cấm (CLAUDE.md A3.3/A3.10)',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$;

-- events
CREATE TRIGGER events_append_only
    BEFORE UPDATE OR DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER events_no_truncate
    BEFORE TRUNCATE ON events
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- wallet_ledger
CREATE TRIGGER wallet_ledger_append_only
    BEFORE UPDATE OR DELETE ON wallet_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER wallet_ledger_no_truncate
    BEFORE TRUNCATE ON wallet_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- treasury_ledger
CREATE TRIGGER treasury_ledger_append_only
    BEFORE UPDATE OR DELETE ON treasury_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER treasury_ledger_no_truncate
    BEFORE TRUNCATE ON treasury_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- burn_ledger
CREATE TRIGGER burn_ledger_append_only
    BEFORE UPDATE OR DELETE ON burn_ledger
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER burn_ledger_no_truncate
    BEFORE TRUNCATE ON burn_ledger
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- admin_audit
CREATE TRIGGER admin_audit_append_only
    BEFORE UPDATE OR DELETE ON admin_audit
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER admin_audit_no_truncate
    BEFORE TRUNCATE ON admin_audit
    FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- Tường lửa T↔Q (A3.5): v0.1 chưa có bất kỳ đường ghi quest_points nào.
-- Chốt cứng ở tầng DB: quest_points không được phép thay đổi khỏi 0
-- cho tới khi founder duyệt hệ quest (gỡ bằng migration mới + cập nhật CLAUDE.md).
CREATE OR REPLACE FUNCTION forbid_quest_points_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quest_points IS DISTINCT FROM OLD.quest_points THEN
        RAISE EXCEPTION 'Tường lửa T↔Q: v0.1 cấm thay đổi quest_points (CLAUDE.md A3.5)'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER users_quest_points_frozen
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION forbid_quest_points_change();
