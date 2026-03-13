export interface SendMailOptions {
  to: string | string[];
  subject: string;
  templateId?: string;
  dynamicData?: Record<string, unknown>;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Attachment[];
}

export interface Attachment {
  content: string;
  filename: string;
  type: string;
  disposition?: 'attachment' | 'inline';
  contentId?: string;
}

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MailHealthCheck {
  healthy: boolean;
  message: string;
  responseTime?: number;
}

export interface KafkaMailPayload {
  to: string | string[];
  subject: string;
  templateId?: string;
  dynamicData?: Record<string, unknown>;
  html?: string;
  text?: string;
  userId?: string;
  correlationId?: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}
