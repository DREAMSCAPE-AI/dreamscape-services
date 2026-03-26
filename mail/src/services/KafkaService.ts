import { getKafkaClient, KAFKA_TOPICS, CONSUMER_GROUPS } from '@dreamscape/kafka';
import type { KafkaMailPayload } from '../types';
import emailService from './EmailService';

class MailKafkaService {
  private client = getKafkaClient('mail-service');
  private running = false;

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscribeToMailEvents();
      this.running = true;
      console.log('✅ Mail Kafka service initialized');
    } catch (error) {
      console.warn('⚠️  Kafka initialization failed — mail service running without event consumers');
    }
  }

  private async subscribeToMailEvents(): Promise<void> {
    await this.client.subscribe(CONSUMER_GROUPS.NOTIFICATION_SERVICE, [
      {
        topic: KAFKA_TOPICS.NOTIFICATION_EMAIL_REQUESTED,
        handler: async (event) => {
          const payload = event.payload as KafkaMailPayload;
          console.log(`📧 Processing email request: ${payload.subject} → ${payload.to}`);
          
          let lastError: Error | null = null;

          for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
              const result = await emailService.send({
                to: payload.to,
                subject: payload.subject,
                templateId: payload.templateId,
                dynamicData: payload.dynamicData,
                html: payload.html,
                text: payload.text,
              });

              if (!result.success) {
                throw new Error(`Email send failed: ${result.error || 'unknown error'}`);
              }

              console.log(`✅ Email request processed successfully (attempt ${attempt})`);
              return; // succès: on sort du handler
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              console.error(`❌ Attempt ${attempt}/5 failed: ${lastError.message}`);

              if (attempt < 5) {
                await new Promise((resolve) => setTimeout(resolve, 500 * attempt)); // petit backoff
              }
            }
          }
          throw new Error(`Failed after 5 attempts: ${lastError?.message || 'unknown error'}`);
        },
      },
    ]);
  }

  async shutdown(): Promise<void> {
    if (this.running) {
      await this.client.disconnect();
      this.running = false;
      console.log('🛑 Mail Kafka service shut down');
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; details?: Record<string, unknown> }> {
    if (!this.running) {
      return { healthy: false, details: { message: 'Kafka not connected' } };
    }
    return this.client.healthCheck();
  }
}

const mailKafkaService = new MailKafkaService();
export default mailKafkaService;
