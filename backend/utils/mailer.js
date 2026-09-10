import nodemailer from 'nodemailer';

let transporter;

// Lazily created so a missing SMTP config only breaks the code paths that
// actually try to send mail, not the whole server on startup.
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // false = STARTTLS on 587, true = implicit TLS on 465
      // Hostname sent in the SMTP EHLO/HELO greeting. Defaults to the machine's OS
      // hostname (e.g. "DESKTOP-AB12CD3" on Windows) if unset, which isn't a real
      // domain and some mail servers penalize; set it to the sending domain instead.
      name: process.env.SMTP_CLIENT_NAME || undefined,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function sendMail({ to, subject, html }) {
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

function button(url, label) {
  return `<p><a href="${url}" style="display:inline-block;padding:10px 22px;background:#aa3bff;color:#fff;text-decoration:none;border-radius:6px;font-family:sans-serif;">${label}</a></p>
    <p style="font-family:sans-serif;font-size:0.85em;color:#666;">Or copy this link into your browser:<br>${url}</p>`;
}

export function sendVerificationEmail(to, firstName, token) {
  const url = `${process.env.BACKEND_PUBLIC_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Verify your email - Church Directory',
    html: `
      <p style="font-family:sans-serif;">Hi ${firstName},</p>
      <p style="font-family:sans-serif;">Thanks for requesting an account on the Church Directory. Please confirm your email address to continue:</p>
      ${button(url, 'Verify Email')}
    `,
  });
}

export function sendApprovalEmail(to, firstName, token) {
  const url = `${process.env.FRONTEND_PUBLIC_URL}/?setPasswordToken=${encodeURIComponent(token)}`;
  return sendMail({
    to,
    subject: 'Your Church Directory account has been approved',
    html: `
      <p style="font-family:sans-serif;">Hi ${firstName},</p>
      <p style="font-family:sans-serif;">Your registration has been approved. Click below to set your password:</p>
      ${button(url, 'Set Password')}
    `,
  });
}

export function sendDenialEmail(to, firstName) {
  return sendMail({
    to,
    subject: 'Your Church Directory registration request',
    html: `
      <p style="font-family:sans-serif;">Hi ${firstName},</p>
      <p style="font-family:sans-serif;">Your request for a Church Directory account was not approved.</p>
      <p style="font-family:sans-serif;">If you believe this was in error, please contact the Church Office.</p>
    `,
  });
}
