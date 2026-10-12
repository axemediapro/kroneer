const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: process.env.SMTP_PORT || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'info@kroneer.com',
        pass: process.env.SMTP_PASS || 'VendosFjalekaliminKetu'
      }
    });
  }

  async sendVerificationEmail(toEmail, customerName, code) {
    const loginUrl = process.env.APP_URL ? `${process.env.APP_URL}/kycu` : 'http://localhost:3000/kycu';
    
    const mailOptions = {
      from: `"KRONEER" <${process.env.SMTP_USER || 'info@kroneer.com'}>`,
      to: toEmail,
      subject: 'Aktivizimi i llogarisë - KRONEER Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 20px; border-radius: 8px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #0f172a; margin: 0;">KRONEER</h1>
            <p style="color: #64748b; font-size: 14px; margin-top: 5px;">Platforma e Menaxhimit të Lifteve</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #0f172a; font-size: 20px; margin-top: 0;">Përshëndetje ${customerName},</h2>
            <p style="color: #475569; line-height: 1.6;">Llogaria juaj në portalin e klientëve KRONEER është krijuar. Për të aktivizuar llogarinë dhe për të vendosur fjalëkalimin tuaj, ju lutem përdorni kodin e verifikimit më poshtë:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; padding: 15px 30px; background-color: #f1f5f9; color: #0f172a; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; border: 1px solid #e2e8f0;">
                ${code}
              </span>
            </div>
            
            <p style="color: #475569; line-height: 1.6;">Ose mund të klikoni butonin më poshtë për të shkuar direkt në faqen e aktivizimit:</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}/aktivizo?email=${encodeURIComponent(toEmail)}&code=${code}" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: #000000; font-weight: bold; text-decoration: none; border-radius: 6px;">Aktivizo Llogarinë</a>
            </div>
            
            <p style="color: #64748b; font-size: 13px;">Ky kod është i vlefshëm për 24 orë. Nëse nuk e keni kërkuar këtë llogari, ju lutem injoroni këtë email.</p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #94a3b8; font-size: 12px;">
            <p>&copy; ${new Date().getFullYear()} KRONEER. Të gjitha të drejtat e rezervuara.</p>
          </div>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Email i verifikimit u dërgua me sukses te: ${toEmail}`);
      return true;
    } catch (error) {
      console.error('Gabim në dërgimin e emailit:', error);
      return false;
    }
  }
}

module.exports = new EmailService();
