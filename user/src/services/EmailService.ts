import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@dreamscape.app';
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Dreamscape';

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

export async function sendBookingConfirmationEmail(params: {
  to: string;
  userName: string;
  reference: string;
  type: string;
  destination: string | null;
  totalAmount: number;
  currency: string;
}): Promise<void> {
  const { to, userName, reference, type, destination, totalAmount, currency } = params;

  const formattedAmount = totalAmount.toLocaleString('fr-FR', { style: 'currency', currency });
  const destLine = destination ? `<p><strong>Destination :</strong> ${destination}</p>` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f97316;">Confirmation de réservation — Dreamscape</h2>
      <p>Bonjour ${userName},</p>
      <p>Votre réservation a bien été confirmée.</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p><strong>Référence :</strong> ${reference}</p>
        <p><strong>Type :</strong> ${type}</p>
        ${destLine}
        <p><strong>Montant :</strong> ${formattedAmount}</p>
      </div>
      <p>Pour toute question, contactez notre support.</p>
      <p>L'équipe Dreamscape</p>
    </div>
  `;

  await sendEmail({
    to,
    subject: `Confirmation de réservation ${reference} — Dreamscape`,
    text: `Bonjour ${userName}, votre réservation ${reference} est confirmée. Montant : ${formattedAmount}.`,
    html,
  });
}
