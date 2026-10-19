/** BẢN DEMO — module Node không dùng tới trong trang (`nodemailer` nạp động · `node:zlib` của sao lưu). */
const rong = {
  createTransport: () => ({ sendMail: async () => ({}) }),
};
export default rong;
