// Gui email that (quen mat khau...). Cau hinh qua SMTP_* trong .env - dien gia
// tri that sau (Gmail App Password, SendGrid, Resend...). Neu chua dien, KHONG
// nem loi: ghi ma ra log server (du dung cho dev/demo) de luong khong bi chan
// boi thieu credentials.
import nodemailer from "nodemailer";
import logger from "./logger.js";

let transporter;

const getTransporter = () => {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    transporter = null;
    return transporter;
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number.parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

export const sendPasswordResetEmail = async (toEmail, userName, code) => {
  const transport = getTransporter();
  const subject = "Mã đặt lại mật khẩu FoodGo";
  const text = `Xin chào ${userName},\n\nMã xác nhận đặt lại mật khẩu của bạn là: ${code}\n`
    + "Mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.\n\nFoodGo";

  if (!transport) {
    logger.warn(`SMTP chưa được cấu hình - mã đặt lại mật khẩu cho ${toEmail}: ${code} (chỉ hiện trong log, không gửi email thật)`);
    return;
  }

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: toEmail,
    subject,
    text,
  });
};

export default { sendPasswordResetEmail };
