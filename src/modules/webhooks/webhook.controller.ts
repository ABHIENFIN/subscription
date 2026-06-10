import { Request, Response, NextFunction } from 'express';
import { getGateway } from '../../payments/gateway.factory';
import { BadRequestException } from '../../common/exceptions';

export class WebhookController {
  async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const provider = (req.query.provider as string) ?? 'stripe';
      const signature = (req.headers['stripe-signature'] as string) ?? '';

      if (!Buffer.isBuffer(req.body)) {
        throw new BadRequestException('Webhook payload must be raw buffer');
      }

      const gateway = getGateway(provider);
      const event = gateway.constructWebhookEvent(req.body, signature);

      console.log(`[Webhook ${provider}] Event received: ${event.type}`);

      // TODO: Dispatch to event handlers based on event.type
      // - customer.subscription.created
      // - customer.subscription.updated
      // - customer.subscription.deleted
      // - invoice.paid
      // - invoice.payment_failed

      res.json({ received: true, type: event.type });
    } catch (err) {
      next(err);
    }
  }
}

export const webhookController = new WebhookController();