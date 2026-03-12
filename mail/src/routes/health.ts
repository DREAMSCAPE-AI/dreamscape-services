import { Router, Request, Response } from 'express';
import emailService from '../services/EmailService';
import mailKafkaService from '../services/KafkaService';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();

  const sendgridHealth = await emailService.verify();
  const kafkaHealth = await mailKafkaService.healthCheck();

  const status = sendgridHealth.healthy ? 'healthy' : 'degraded';
  const totalTime = Date.now() - startTime;

  res.status(sendgridHealth.healthy ? 200 : 206).json({
    status,
    service: 'mail-service',
    timestamp: new Date().toISOString(),
    responseTime: totalTime,
    checks: {
      sendgrid: sendgridHealth,
      kafka: kafkaHealth
    }
  });
});

router.get('/live', (req: Request, res: Response): void => {
  res.status(200).json({
    alive: true,
    service: 'mail-service',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

router.get('/ready', async (req: Request, res: Response): Promise<void> => {
  const sendgridHealth = await emailService.verify();

  if (sendgridHealth.healthy) {
    res.status(200).json({
      ready: true,
      service: 'mail-service',
      timestamp: new Date().toISOString(),
      dependencies: {
        sendgrid: true
      }
    });
    return;
  }

  res.status(503).json({
    ready: false,
    service: 'mail-service',
    timestamp: new Date().toISOString(),
    reason: sendgridHealth.message,
    dependencies: {
      sendgrid: false
    }
  });
});

export default router;
