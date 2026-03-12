/**
 * Email templates registry.
 *
 * Each template can work in two modes:
 * 1. SendGrid dynamic template (set `id` to the template ID from the dashboard)
 * 2. Inline HTML fallback (uses `subject` + `html` when no SendGrid template ID is set)
 *
 * Placeholders use Handlebars syntax: {{variable}}
 */

export interface TemplateDefinition {
  id: string;
  description: string;
  requiredFields: string[];
  subject: string;
  html: string;
}

// ── Shared layout ───────────────────────────────────
const layout = (content: string) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #f4f4f7; color: #333; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 28px; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px 24px; line-height: 1.6; font-size: 15px; }
    .body h2 { color: #6366f1; margin: 0 0 16px; }
    .btn { display: inline-block; padding: 12px 28px; background: #6366f1; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .info-box { background: #f8f7ff; border-left: 4px solid #6366f1; padding: 16px; margin: 16px 0; border-radius: 0 6px 6px 0; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
    .footer a { color: #6366f1; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>DreamScape</h1>
      <p>Your journey starts here</p>
    </div>
    <div class="body">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; {{year}} DreamScape — All rights reserved</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> · <a href="{{preferencesUrl}}">Email preferences</a></p>
    </div>
  </div>
</body>
</html>`;

const templates: Record<string, TemplateDefinition> = {
  // ── Authentication ────────────────────────────────
  welcome: {
    id: '', // TODO: set SendGrid template ID
    description: 'Welcome email sent after registration',
    requiredFields: ['firstName', 'loginUrl'],
    subject: 'Welcome to DreamScape, {{firstName}}!',
    html: layout(`
      <h2>Welcome aboard, {{firstName}}! 🎉</h2>
      <p>We're thrilled to have you join DreamScape. Your account is ready and the world is waiting.</p>
      <a class="btn" href="{{loginUrl}}">Start exploring</a>
      <p style="color:#6b7280; font-size:13px;">If the button doesn't work, copy and paste this URL into your browser:<br/>{{loginUrl}}</p>
    `),
  },

  passwordReset: {
    id: '', // TODO: set SendGrid template ID
    description: 'Password reset request with token link',
    requiredFields: ['firstName', 'resetUrl', 'expiresIn'],
    subject: 'Reset your DreamScape password',
    html: layout(`
      <h2>Password reset</h2>
      <p>Hi {{firstName}},</p>
      <p>We received a request to reset your password. Click the button below to choose a new one:</p>
      <a class="btn" href="{{resetUrl}}">Reset password</a>
      <div class="info-box">
        <strong>⏱ This link expires in {{expiresIn}}.</strong><br/>
        If you didn't request this, you can safely ignore this email.
      </div>
      <p style="color:#6b7280; font-size:13px;">Direct link: {{resetUrl}}</p>
    `),
  },

  passwordChanged: {
    id: '', // TODO: set SendGrid template ID
    description: 'Confirmation that the password has been changed',
    requiredFields: ['firstName'],
    subject: 'Your DreamScape password has been changed',
    html: layout(`
      <h2>Password updated</h2>
      <p>Hi {{firstName}},</p>
      <p>Your password has been successfully changed. If you did not make this change, please contact our support team immediately.</p>
      <a class="btn" href="{{supportUrl}}">Contact support</a>
    `),
  },

  // ── Booking / Voyage ──────────────────────────────
  bookingConfirmation: {
    id: '', // TODO: set SendGrid template ID
    description: 'Booking confirmation with trip details',
    requiredFields: ['firstName', 'bookingRef', 'destination', 'departureDate'],
    subject: 'Booking confirmed — {{destination}} 🌍',
    html: layout(`
      <h2>Your trip is confirmed!</h2>
      <p>Hi {{firstName}},</p>
      <p>Great news — your booking is confirmed. Here are the details:</p>
      <div class="info-box">
        <strong>Booking ref:</strong> {{bookingRef}}<br/>
        <strong>Destination:</strong> {{destination}}<br/>
        <strong>Departure:</strong> {{departureDate}}<br/>
        <strong>Return:</strong> {{returnDate}}
      </div>
      <a class="btn" href="{{bookingUrl}}">View booking</a>
      <p>Need to make changes? You can manage your booking from your dashboard at any time.</p>
    `),
  },

  bookingCancellation: {
    id: '', // TODO: set SendGrid template ID
    description: 'Booking cancellation notice',
    requiredFields: ['firstName', 'bookingRef'],
    subject: 'Booking {{bookingRef}} cancelled',
    html: layout(`
      <h2>Booking cancelled</h2>
      <p>Hi {{firstName}},</p>
      <p>Your booking <strong>{{bookingRef}}</strong> has been cancelled.</p>
      <div class="info-box">
        If a refund applies, it will be processed within 5–10 business days.
      </div>
      <a class="btn" href="{{dashboardUrl}}">Back to dashboard</a>
    `),
  },

  // ── Payment ───────────────────────────────────────
  paymentReceipt: {
    id: '', // TODO: set SendGrid template ID
    description: 'Payment receipt / invoice',
    requiredFields: ['firstName', 'amount', 'currency', 'bookingRef'],
    subject: 'Payment received — {{amount}} {{currency}}',
    html: layout(`
      <h2>Payment received ✓</h2>
      <p>Hi {{firstName}},</p>
      <p>We've received your payment. Here's your receipt:</p>
      <div class="info-box">
        <strong>Amount:</strong> {{amount}} {{currency}}<br/>
        <strong>Booking ref:</strong> {{bookingRef}}<br/>
        <strong>Date:</strong> {{paymentDate}}<br/>
        <strong>Method:</strong> {{paymentMethod}}
      </div>
      <a class="btn" href="{{receiptUrl}}">Download receipt</a>
    `),
  },

  paymentFailed: {
    id: '', // TODO: set SendGrid template ID
    description: 'Payment failure notification',
    requiredFields: ['firstName', 'bookingRef', 'retryUrl'],
    subject: 'Payment failed for booking {{bookingRef}}',
    html: layout(`
      <h2>Payment issue</h2>
      <p>Hi {{firstName}},</p>
      <p>Unfortunately, we were unable to process your payment for booking <strong>{{bookingRef}}</strong>.</p>
      <div class="info-box">
        Please verify your payment details and try again. Your booking will be held for 24 hours.
      </div>
      <a class="btn" href="{{retryUrl}}">Retry payment</a>
    `),
  },
};

export function getTemplate(name: string): TemplateDefinition | undefined {
  return templates[name];
}

export function listTemplates(): Record<string, TemplateDefinition> {
  return { ...templates };
}

/**
 * Replace {{placeholder}} tokens in a template string with values from data.
 */
export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return key in data ? String(data[key]) : match;
  });
}
