const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP TRANSPORTER
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE === 'true',
  // Force IPv4
  family: 4,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// SEND OTP
const sendOTP = async (to, otp, subject = 'Your Account Verification Code') => {
  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text: `Your OTP is ${otp}. It is valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Verification Code</h2>
        <p>Your verification code is:</p>
        <h1 style="letter-spacing: 5px; color: #007bff; text-align: center; background: #f8f9fa; padding: 20px; border-radius: 8px;">
          ${otp}
        </h1>
        <p>
          This OTP is valid for
          ${process.env.OTP_EXPIRY_MINUTES || 10}
          minutes.
        </p>
        <p>
          If you did not request this code,
          please ignore this email.
        </p>
      </div>
    `,
  };

  try {
    if (process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      console.log(`[DEV MODE] OTP for ${to}: ${otp}`);
      console.log(`[DEV MODE] Email would be sent in production with proper SMTP configuration`);
      return { messageId: 'dev-mode-message-id' };
    }

    console.log(`Attempting to send OTP to ${to}`);
    const result = await transporter.sendMail(mailOptions);
    console.log(`OTP email sent successfully to ${to}. Message ID: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('Failed to send OTP email:', error);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV MODE] Email sending failed but continuing registration. OTP: ${otp}`);
      return { messageId: 'dev-fallback-message-id' };
    }
    
    throw error;
  }
};

// VERIFY SMTP CONNECTION
const verifySMTPConnection = async () => {
  try {
    await transporter.verify();
    console.log('SMTP connection verified.');
    return true;
  } catch (error) {
    console.error('SMTP connection verification failed:', error);
    if (process.env.NODE_ENV === 'development') {
      console.log('[DEV MODE] SMTP verification failed but continuing in development mode');
      return false;
    }
    throw error;
  }
};

class EmailService {
  static async sendOtp(email, otp) {
    return await sendOTP(email, otp);
  }

  static async verifyConnection() {
    return await verifySMTPConnection();
  }
}

module.exports = {
  sendOTP,
  verifySMTPConnection,
  EmailService
};