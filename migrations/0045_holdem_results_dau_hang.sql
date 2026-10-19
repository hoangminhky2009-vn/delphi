-- 22/08 — ĐẦU HÀNG khép trận ngay (founder: "thoát trận với lý do đầu hàng thì
-- đâu thể vào lại trận được? Cho người đó hạng E- luôn"). Trận khép kiểu này
-- vẫn có dòng kết quả (hạng bét, E-) nhưng KHÔNG được đếm là "trận xong" cho
-- mở khoá (D86: đếm được là farm được) và phải tách được trong phân tích.
ALTER TABLE holdem_results ADD COLUMN dau_hang BOOLEAN NOT NULL DEFAULT false;
