import sgMail, { MailDataRequired } from '@sendgrid/mail';
import config from '../config';
import type { SendMailOptions, MailResult, MailHealthCheck } from '../types';

class EmailService {
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    if (!config.sendgrid.apiKey) {
      console.warn('⚠️  SENDGRID_API_KEY is not set — mail service will operate in dry-run mode');
      return;
    }
    sgMail.setApiKey(config.sendgrid.apiKey);
    this.initialized = true;
    console.log('✅ SendGrid client initialized');
  }

  async send(options: SendMailOptions): Promise<MailResult> {
    if (!this.initialized) {
      console.warn('📧 [DRY-RUN] Would send email:', {
        to: options.to,
        subject: options.subject,
        templateId: options.templateId,
      });
      return { success: true, messageId: `dry-run-${Date.now()}` };
    }

    const msg: MailDataRequired = {
      to: options.to,
      from: {
        email: config.sendgrid.fromEmail,
        name: config.sendgrid.fromName,
      },
      subject: options.subject,
    };

    if (options.templateId) {
      msg.templateId = options.templateId;
      if (options.dynamicData) {
        msg.dynamicTemplateData = options.dynamicData;
      }
    } else if (options.html) {
      msg.html = options.html;
      if (options.text) msg.text = options.text;
    } else if (options.text) {
      msg.text = options.text;
    }

    if (options.replyTo) msg.replyTo = options.replyTo;
    if (options.cc) msg.cc = options.cc;
    if (options.bcc) msg.bcc = options.bcc;
    if (options.attachments) {
      msg.attachments = options.attachments.map((a) => ({
        content: a.content,
        filename: a.filename,
        type: a.type,
        disposition: a.disposition || 'attachment',
        contentId: a.contentId,
      }));
    }

    try {
      const [response] = await sgMail.send(msg);
      return {
        success: true,
        messageId: response.headers['x-message-id'] as string,
      };
    } catch (error: unknown) {
      let message = 'Unknown SendGrid error';
      if (error && typeof error === 'object' && 'response' in error) {
        const sgError = error as { response: { body?: unknown; statusCode?: number } };
        console.error('❌ SendGrid send failed:', JSON.stringify(sgError.response.body));
        message = `SendGrid ${sgError.response.statusCode}: ${JSON.stringify(sgError.response.body)}`;
      } else if (error instanceof Error) {
        console.error('❌ SendGrid send failed:', error.message);
        message = error.message;
      }
      return { success: false, error: message };
    }
  }

  async sendBatch(messages: SendMailOptions[]): Promise<MailResult[]> {
    return Promise.all(messages.map((msg) => this.send(msg)));
  }

  async verify(): Promise<MailHealthCheck> {
    if (!this.initialized) {
      return {
        healthy: true,
        message: 'SendGrid in dry-run mode (no API key configured)',
      };
    }

    const start = Date.now();
    try {
      // Lightweight verification: attempt to set api key (validates format)
      sgMail.setApiKey(config.sendgrid.apiKey);
      return {
        healthy: true,
        message: 'SendGrid client configured and ready',
        responseTime: Date.now() - start,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'SendGrid verification failed';
      return {
        healthy: false,
        message,
        responseTime: Date.now() - start,
      };
    }
  }

  isReady(): boolean {
    return this.initialized;
  }
}

const emailService = new EmailService();
export default emailService;
