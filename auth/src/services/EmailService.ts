import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@dreamscape.app';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Dreamscape';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export function isSendGridConfigured(): boolean {
  return !!SENDGRID_API_KEY && SENDGRID_API_KEY !== 'your-sendgrid-api-key-here';
}

if (SENDGRID_API_KEY && isSendGridConfigured()) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (!isSendGridConfigured()) {
    throw new Error('SENDGRID_NOT_CONFIGURED');
  }

  await sgMail.send({
    to: params.to,
    from: { email: SENDGRID_FROM_EMAIL, name: SENDGRID_FROM_NAME },
    subject: params.subject,
    text: params.text,
    html: params.html || params.text,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  userName: string;
  resetLink: string;
}): Promise<void> {
  const { to, userName, resetLink } = params;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">Réinitialisation de votre mot de passe — Dreamscape</h2>
      <p>Bonjour ${userName},</p>
      <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetLink}"
           style="background-color: #f97316; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Ce lien est valable pendant <strong>24 heures</strong>.</p>
      <p style="color: #6b7280; font-size: 14px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">L'équipe Dreamscape</p>
    </div>
  `;

  await sendEmail({
    to,
    subject: 'Réinitialisation de votre mot de passe — Dreamscape',
    text: `Bonjour ${userName},\n\nVous avez demandé la réinitialisation de votre mot de passe.\n\nCliquez sur ce lien pour créer un nouveau mot de passe (valable 24h) :\n${resetLink}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\nL'équipe Dreamscape`,
    html,
  });
}

export { FRONTEND_URL };
