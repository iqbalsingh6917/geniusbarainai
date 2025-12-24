import nodemailer from 'nodemailer';
import config from '../config';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Send an email using configured SMTP settings or log to console if not configured
 * @param options Email options including recipient, subject, and content
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  // If SMTP is configured, send real email
  if (config.smtpHost && config.smtpPort && config.smtpUser && config.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });

      const mailOptions = {
        from: config.smtpFrom || config.smtpUser,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      await transporter.sendMail(mailOptions);
      console.log(`[EMAIL] Sent email to ${options.to} with subject: ${options.subject}`);
    } catch (error) {
      console.error('[EMAIL] Failed to send email:', error);
      throw error;
    }
  } else {
    // Log to console if SMTP not configured
    console.log('[DEV] Email would be sent:');
    console.log('- To:', options.to);
    console.log('- Subject:', options.subject);
    console.log('- Text:', options.text);
    if (options.html) {
      console.log('- HTML:', options.html);
    }
  }
}

/**
 * Send a password reset email to a user
 * @param userEmail The email address of the user
 * @param username The username of the user
 * @param resetLink The password reset link
 */
export async function sendPasswordResetEmail(
  userEmail: string,
  username: string,
  resetLink: string
): Promise<void> {
  const subject = 'Password Reset Request';
  const text = `Hello ${username},

You have requested to reset your password. Please click the link below to reset your password:

${resetLink}

This link will expire in 1 hour.

If you did not request this, please ignore this email.

Best regards,
The Beats LMS Team`;

  const html = `<p>Hello <strong>${username}</strong>,</p>
<p>You have requested to reset your password. Please click the link below to reset your password:</p>
<p><a href="${resetLink}">Reset Password</a></p>
<p>This link will expire in 1 hour.</p>
<p>If you did not request this, please ignore this email.</p>
<p>Best regards,<br>The Beats LMS Team</p>`;

  await sendEmail({
    to: userEmail,
    subject,
    text,
    html,
  });
}
