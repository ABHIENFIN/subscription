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
  items?: { gatewayPriceId: string; quantity?: number }[];
}

export interface UpdateSubscriptionDto {
  planId?: string;
  planPriceId?: string;
  prorationBehavior?: 'always_invoice' | 'always_prorate' | 'none';
}

export interface CreateInvoiceDto {
  subscriptionId: string;
  description?: string;
}

// Approach A — split product/price.
export interface CreateGatewayProductDto {
  name: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface CreateGatewayPriceDto {
  productId: string;
  amount: number;          // smallest currency unit (cents)
  currency: string;
  type: 'RECURRING' | 'ONE_TIME';
  interval?: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';  // required when type=RECURRING
  intervalCount?: number;
  usageType?: 'LICENSED' | 'METERED';
  nickname?: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export interface GatewayProduct {
  id: string;
  name?: string;
}

export interface GatewayPrice {
  id: string;
  productId: string;
  type: 'RECURRING' | 'ONE_TIME';
}

export interface RecordUsageDto {
  subscriptionItemId: string;
  quantity: number;
  timestamp?: Date;
  action?: 'increment' | 'set';
}

export interface AddInvoiceItemDto {
  customerId: string;
  subscriptionId?: string;
  priceId: string;
  quantity?: number;
}

// Legacy single-call helper. Kept for back-compat with the Approach B prototype
// and used when you don't care about products (test-only convenience).
export interface CreateGatewayPlanDto {
  name: string;
  amount: number;
  currency: string;
  interval: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';
  intervalCount?: number;
  metadata?: Record<string, string>;
}

export interface GatewayPlan {
  id: string;
  productId?: string;
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
  items?: { id: string; priceId: string; quantity?: number }[];
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

  // Plan/price management — Approach A (preferred)
  createProduct(data: CreateGatewayProductDto): Promise<GatewayProduct>;
  createPrice(data: CreateGatewayPriceDto): Promise<GatewayPrice>;

  // Convenience: legacy single-call helper (creates Product + Price in one shot).
  // Used only by the Approach B prototype smoke test; new code should call
  // createProduct + createPrice explicitly.
  createPlan(data: CreateGatewayPlanDto): Promise<GatewayPlan>;

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

  // Usage (metered prices)
  recordUsage(data: RecordUsageDto): Promise<void>;

  // Add a one-time line item to a customer / upcoming subscription invoice
  addInvoiceItem(data: AddInvoiceItemDto): Promise<void>;

  // Invoices
  createInvoice(data: CreateInvoiceDto): Promise<GatewayInvoice>;
  retryInvoice(invoiceId: string): Promise<GatewayInvoice>;
  getInvoice(invoiceId: string): Promise<GatewayInvoice>;

  // Webhooks
  constructWebhookEvent(payload: Buffer, signature: string): GatewayWebhookEvent;
}
