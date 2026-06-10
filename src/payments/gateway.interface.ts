export interface CreateCustomerDto {
  email: string;
  name?: string;
  tenantId: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionDto {
  planId: string;
  gatewayPlanId?: string;
  userId: string;
  paymentMethodId?: string;
}

export interface UpdateSubscriptionDto {
  planId?: string;
  prorationBehavior?: 'always_invoice' | 'always_prorate' | 'none';
}

export interface CreateInvoiceDto {
  subscriptionId: string;
  description?: string;
}

export interface GatewayCustomer {
  id: string;
  email: string;
  name?: string;
}

export interface GatewayPaymentMethod {
  id: string;
  type: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
}

export interface GatewaySubscription {
  id: string;
  customerId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface GatewayInvoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paidAt?: Date;
  hostedUrl?: string;
}

export interface GatewayWebhookEvent {
  type: string;
  data: Record<string, any>;
}

export interface IPaymentGateway {
  readonly provider: string;

  // Customer management
  createCustomer(data: CreateCustomerDto): Promise<GatewayCustomer>;
  deleteCustomer(customerId: string): Promise<void>;
  getCustomer(customerId: string): Promise<GatewayCustomer>;

  // Payment methods
  attachPaymentMethod(customerId: string, token: string): Promise<GatewayPaymentMethod>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
  listPaymentMethods(customerId: string): Promise<GatewayPaymentMethod[]>;

  // Subscriptions
  createSubscription(data: CreateSubscriptionDto): Promise<GatewaySubscription>;
  cancelSubscription(subscriptionId: string, immediately: boolean): Promise<void>;
  pauseSubscription(subscriptionId: string): Promise<void>;
  resumeSubscription(subscriptionId: string): Promise<void>;
  updateSubscription(subscriptionId: string, data: UpdateSubscriptionDto): Promise<GatewaySubscription>;

  // Invoices
  createInvoice(data: CreateInvoiceDto): Promise<GatewayInvoice>;
  retryInvoice(invoiceId: string): Promise<GatewayInvoice>;
  getInvoice(invoiceId: string): Promise<GatewayInvoice>;

  // Webhooks
  constructWebhookEvent(payload: Buffer, signature: string): GatewayWebhookEvent;
}