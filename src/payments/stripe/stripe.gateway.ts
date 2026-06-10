import Stripe from 'stripe';
import {
  IPaymentGateway,
  CreateCustomerDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateInvoiceDto,
  GatewayCustomer,
  GatewayPaymentMethod,
  GatewaySubscription,
  GatewayInvoice,
  GatewayWebhookEvent,
} from '../gateway.interface';

export class StripeGateway implements IPaymentGateway {
  public readonly provider = 'stripe';
  private stripe: Stripe;

  constructor(secretKey?: string) {
    const key = secretKey ?? process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is required for StripeGateway');
    }
    this.stripe = new Stripe(key, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }

  async createCustomer(data: CreateCustomerDto): Promise<GatewayCustomer> {
    const customer = await this.stripe.customers.create({
      email: data.email,
      name: data.name,
      metadata: { tenantId: data.tenantId, ...data.metadata },
    });
    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name ?? undefined,
    };
  }

  async deleteCustomer(customerId: string): Promise<void> {
    await this.stripe.customers.del(customerId);
  }

  async getCustomer(customerId: string): Promise<GatewayCustomer> {
    const customer = await this.stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error(`Customer ${customerId} has been deleted`);
    }
    return {
      id: customer.id,
      email: customer.email!,
      name: customer.name ?? undefined,
    };
  }

  async attachPaymentMethod(customerId: string, token: string): Promise<GatewayPaymentMethod> {
    const pm = await this.stripe.paymentMethods.attach(token, { customer: customerId });
    return this.toGatewayPaymentMethod(pm);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]> {
    const list = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return list.data.map((pm) => this.toGatewayPaymentMethod(pm));
  }

  async createSubscription(data: CreateSubscriptionDto): Promise<GatewaySubscription> {
    let customerId = data.paymentMethodId;

    if (!customerId) {
      throw new Error('paymentMethodId (Stripe customer ID) is required');
    }

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: data.gatewayPlanId
        ? [{ price: data.gatewayPlanId }]
        : undefined,
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });

    return {
      id: subscription.id,
      customerId: subscription.customer as string,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  }

  async cancelSubscription(subscriptionId: string, immediately: boolean): Promise<void> {
    if (immediately) {
      await this.stripe.subscriptions.cancel(subscriptionId);
    } else {
      await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  }

  async pauseSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      pause_collection: { behavior: 'void' },
    });
  }

  async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.stripe.subscriptions.update(subscriptionId, {
      pause_collection: null,
    });
  }

  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionDto
  ): Promise<GatewaySubscription> {
    const params: Stripe.SubscriptionUpdateParams = {};
    if (data.prorationBehavior) {
      params.proration_behavior = data.prorationBehavior === 'always_prorate'
        ? 'create_prorations'
        : data.prorationBehavior;
    }
    const sub = await this.stripe.subscriptions.update(subscriptionId, params);
    return {
      id: sub.id,
      customerId: sub.customer as string,
      status: sub.status,
      currentPeriodStart: new Date(sub.current_period_start * 1000),
      currentPeriodEnd: new Date(sub.current_period_end * 1000),
    };
  }

  async createInvoice(data: CreateInvoiceDto): Promise<GatewayInvoice> {
    const invoice = await this.stripe.invoices.create({
      subscription: data.subscriptionId,
      description: data.description,
    });
    return this.toGatewayInvoice(invoice);
  }

  async retryInvoice(invoiceId: string): Promise<GatewayInvoice> {
    const invoice = await this.stripe.invoices.pay(invoiceId);
    return this.toGatewayInvoice(invoice);
  }

  async getInvoice(invoiceId: string): Promise<GatewayInvoice> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    return this.toGatewayInvoice(invoice);
  }

  constructWebhookEvent(payload: Buffer, signature: string): GatewayWebhookEvent {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required to verify webhooks');
    }
    const event = this.stripe.webhooks.constructEvent(payload, signature, secret);
    return {
      type: event.type,
      data: event.data.object as Record<string, any>,
    };
  }

  private toGatewayPaymentMethod(pm: Stripe.PaymentMethod): GatewayPaymentMethod {
    const card = pm.card;
    return {
      id: pm.id,
      type: pm.type,
      last4: card?.last4,
      expiryMonth: card?.exp_month,
      expiryYear: card?.exp_year,
    };
  }

  private toGatewayInvoice(invoice: Stripe.Invoice): GatewayInvoice {
    return {
      id: invoice.id,
      amount: invoice.amount_paid ?? invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status ?? 'unknown',
      paidAt: invoice.status === 'paid' && invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000)
        : undefined,
      hostedUrl: invoice.hosted_invoice_url ?? undefined,
    };
  }
}