/**
 * CA GỐC CỦA SUPABASE — B3 (SPEC va-bao-mat-chuan-hoa-api-dot-1). CÔNG KHAI, không phải bí mật: đây là chứng chỉ để
 * KIỂM đầu kia của kết nối DB, ai cũng tải được (Supabase Dashboard → Database → SSL Configuration → "Download
 * certificate", tệp `prod-ca-2021.crt`).
 *
 * Nguồn của bản này (17/10/2026): bắt tay TLS `openssl s_client -starttls postgres -showcerts` tới
 * `aws-{0,1}-ap-southeast-1.pooler.supabase.com` cổng 5432 + 6543 — chuỗi `*.pooler.supabase.com` ← "Supabase
 * Intermediate 2021 CA" ← "Supabase Root 2021 CA" (tự ký); kiểm lại bằng `-CAfile` + `-verify_hostname` ⇒ `Verify return
 * code: 0` ở cả bốn cửa. Cùng CA cho DB trực tiếp `db.<ref>.supabase.co`.
 * SHA-256: 80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA
 * ⇒ founder so dấu này với tệp tải từ Dashboard một lần (bắt tay TLS tự ký là tin-lần-đầu, Dashboard là nguồn gốc).
 *
 * ⚠ HẾT HẠN 26/04/2031 (`tests/db_tls.test.ts` đỏ trước ngày đó). Supabase đổi CA ⇒ thay khối dưới, hoặc đặt
 * `DATABASE_SSL_CA` (nội dung PEM) trên Vercel để chữa nóng không cần deploy mã.
 *
 * Vì sao là `.ts` chứ không phải `config/supabase-ca.crt` như SPEC ghi: hàm Vercel chỉ đóng gói tệp mà trình lần dấu
 * (nft) thấy được qua `import`; một `readFileSync` tệp `.crt` mà lần dấu sót thì prod mất DB ngay lần khởi động đầu.
 * Chuỗi trong mã nguồn thì không có đường nào bị sót.
 */
export const SUPABASE_CA_GOC = `
-----BEGIN CERTIFICATE-----
MIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL
BQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l
dyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh
c2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow
azELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD
YXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug
Um9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW
QyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q
DmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2
GtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi
cvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4
O4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt
NaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX
uXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt
aUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU
tVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b
VW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6
jB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx
Cea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2
CMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P
o/bKiIz+Fq8=
-----END CERTIFICATE-----
`.trim();
