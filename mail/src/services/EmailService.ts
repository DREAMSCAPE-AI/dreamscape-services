import sgMail, { MailDataRequired } from '@sendgrid/mail';
import sgClient from '@sendgrid/client';
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
    sgClient.setApiKey(config.sendgrid.apiKey);
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
    
    
    const baseMsg = {
      to: options.to,
      from: {
        email: config.sendgrid.fromEmail,
        name: config.sendgrid.fromName,
      },
      subject: options.subject,
    };

    let msg: MailDataRequired;

    if (options.templateId) {
      msg = {
        ...baseMsg,
        templateId: options.templateId,
      };
      if (options.dynamicData) {
        msg.dynamicTemplateData = options.dynamicData;
      }
    } else if (options.html) {
      msg = {
        ...baseMsg,
        html: options.html,
      };
      if (options.text) msg.text = options.text;
    } else {
      msg = {
        ...baseMsg,
        text: options.text || '',
      };
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

  async verify(): Promise<MailHealthCheck> {
    if (!this.initialized) {
      return {
        healthy: true,
        message: 'SendGrid in dry-run mode (no API key configured)',
      };
    }

    const start = Date.now();
    try {
      // Real connectivity check against a lightweight SendGrid account endpoint.
      const [response] = await sgClient.request({
        method: 'GET',
        url: '/v3/user/account',
      });

      const statusCode = response.statusCode || 0;
      const healthy = statusCode >= 200 && statusCode < 300;
      return {
        healthy,
        message: healthy
          ? `SendGrid API reachable (status ${statusCode})`
          : `SendGrid API returned status ${statusCode}`,
        responseTime: Date.now() - start,
      };
    } catch (error: unknown) {
      const message = error instanceof Error
        ? `SendGrid connectivity check failed: ${error.message}`
        : 'SendGrid connectivity check failed';
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
