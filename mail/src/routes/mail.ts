import { Router, Request, Response } from 'express';
import emailService from '../services/EmailService';
import { getTemplate, listTemplates, renderTemplate } from '../templates';
import type { SendMailOptions } from '../types';

const router = Router();

/**
 * POST /api/v1/mail/send
 * Send an email via SendGrid.
 */
router.post('/send', async (req: Request, res: Response): Promise<void> => {
  const { to, subject, templateId, dynamicData, html, text, replyTo, cc, bcc } = req.body;

  if (!to || !subject) {
    res.status(400).json({ success: false, error: 'Missing required fields: to, subject' });
    return;
  }

  if (!templateId && !html && !text) {
    res.status(400).json({ success: false, error: 'Provide at least one of: templateId, html, text' });
    return;
  }

  const options: SendMailOptions = { to, subject, templateId, dynamicData, html, text, replyTo, cc, bcc };

  const result = await emailService.send(options);

  if (result.success) {
    res.status(200).json({ success: true, messageId: result.messageId });
  } else {
    res.status(502).json({ success: false, error: result.error });
  }
});

/**
 * POST /api/v1/mail/send-template
 * Send an email using a named template from the registry.
 * Uses SendGrid dynamic template if `id` is set, otherwise falls back to inline HTML.
 */
router.post('/send-template', async (req: Request, res: Response): Promise<void> => {
  const { to, templateName, dynamicData } = req.body;

  if (!to || !templateName) {
    res.status(400).json({ success: false, error: 'Missing required fields: to, templateName' });
    return;
  }

  const template = getTemplate(templateName);
  if (!template) {
    res.status(404).json({ success: false, error: `Template "${templateName}" not found` });
    return;
  }

  // Validate required fields
  const missingFields = template.requiredFields.filter(
    (field) => !dynamicData || !(field in dynamicData),
  );
  if (missingFields.length > 0) {
    res.status(400).json({
      success: false,
      error: `Missing required dynamic data fields: ${missingFields.join(', ')}`,
    });
    return;
  }

  // Enrich dynamic data with defaults
  const enrichedData = {
    year: new Date().getFullYear().toString(),
    ...dynamicData,
  };

  let result;

  if (template.id) {
    // Use SendGrid dynamic template
    result = await emailService.send({
      to,
      subject: renderTemplate(template.subject, enrichedData),
      templateId: template.id,
      dynamicData: enrichedData,
    });
  } else {
    // Fallback: render inline HTML with placeholder substitution
    result = await emailService.send({
      to,
      subject: renderTemplate(template.subject, enrichedData),
      html: renderTemplate(template.html, enrichedData),
    });
  }

  if (result.success) {
    res.status(200).json({ success: true, messageId: result.messageId });
  } else {
    res.status(502).json({ success: false, error: result.error });
  }
});

/**
 * GET /api/v1/mail/templates
 * List all available email templates.
 */
router.get('/templates', (_req: Request, res: Response): void => {
  res.status(200).json({ success: true, templates: listTemplates() });
});

/**
 * GET /api/v1/mail/preview/:templateName
 * Render a template in the browser with sample data — no email sent.
 * Accepts optional query params to override dynamic data.
 */
router.get('/preview/:templateName', (req: Request, res: Response): void => {
  const { templateName } = req.params;
  const template = getTemplate(templateName);

  if (!template) {
    res.status(404).json({ success: false, error: `Template "${templateName}" not found` });
    return;
  }

  // Build sample data from required fields + query params
  const sampleData: Record<string, string> = {
    year: new Date().getFullYear().toString(),
    firstName: 'Nicolas',
    loginUrl: 'https://dreamscape.com/login',
    resetUrl: 'https://dreamscape.com/reset?token=sample-token',
    expiresIn: '15 minutes',
    bookingRef: 'DS-2026-4567',
    destination: 'Bali',
    departureDate: '2026-07-15',
    returnDate: '2026-07-28',
    bookingUrl: 'https://dreamscape.com/bookings/DS-2026-4567',
    dashboardUrl: 'https://dreamscape.com/dashboard',
    amount: '1 249.00',
    currency: 'EUR',
    paymentDate: '2026-03-12',
    paymentMethod: 'Visa •••• 4242',
    receiptUrl: 'https://dreamscape.com/receipts/DS-2026-4567',
    retryUrl: 'https://dreamscape.com/payment/retry/DS-2026-4567',
    supportUrl: 'https://dreamscape.com/support',
    unsubscribeUrl: '#',
    preferencesUrl: '#',
  };

  // Override with query params
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') sampleData[key] = value;
  }

  const renderedSubject = renderTemplate(template.subject, sampleData);
  const renderedHtml = renderTemplate(template.html, sampleData);

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!-- Subject: ${renderedSubject} -->
    ${renderedHtml}
  `);
});

export default router;
