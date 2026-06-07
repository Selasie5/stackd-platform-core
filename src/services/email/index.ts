import { Resend } from 'resend';
import { config } from '@/config/index';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${config.FRONTEND_URL}/verify-email?token=${token}`;

  if (!resend || config.NODE_ENV === 'development') {
    console.log(`[Email] Verification link for ${email}: ${verifyUrl}`);
    if (!resend) return;
  }

  const { error } = await resend.emails.send({
    from: config.EMAIL_FROM,
    to: email,
    subject: 'Verify your Splennet account',
    html: `
      <p>Welcome to Splennet!</p>
      <p>Click the link below to verify your email address:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });

  if (error) {
    console.error('[Email] Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}
