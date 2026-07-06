import {
  IPaymentGateway,
  CreateCustomerDto,
  CreateSubscriptionDto,
  UpdateSubscriptionDto,
  CreateInvoiceDto,
  CreateGatewayPlanDto,
  CreateGatewayProductDto,
  CreateGatewayPriceDto,
  RecordUsageDto,
  AddInvoiceItemDto,
  GatewayCustomer,
  GatewayPaymentMethod,
  GatewaySubscription,
  GatewayInvoice,
  GatewayPlan,
  GatewayProduct,
  GatewayPrice,
  GatewayWebhookEvent,
} from '../gateway.interface';

export class RazorpayGateway implements IPaymentGateway {
  public readonly provider = 'razorpay';

  async createCustomer(_data: CreateCustomerDto): Promise<GatewayCustomer> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async deleteCustomer(_customerId: string): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async getCustomer(_customerId: string): Promise<GatewayCustomer> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async createPlan(_data: CreateGatewayPlanDto): Promise<GatewayPlan> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async createProduct(_data: CreateGatewayProductDto): Promise<GatewayProduct> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async createPrice(_data: CreateGatewayPriceDto): Promise<GatewayPrice> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async recordUsage(_data: RecordUsageDto): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async addInvoiceItem(_data: AddInvoiceItemDto): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async attachPaymentMethod(_customerId: string, _token: string): Promise<GatewayPaymentMethod> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async listPaymentMethods(_customerId: string): Promise<GatewayPaymentMethod[]> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async createSubscription(_data: CreateSubscriptionDto): Promise<GatewaySubscription> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async cancelSubscription(_subscriptionId: string, _immediately: boolean): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async pauseSubscription(_subscriptionId: string): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async resumeSubscription(_subscriptionId: string): Promise<void> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async updateSubscription(
    _subscriptionId: string,
    _data: UpdateSubscriptionDto
  ): Promise<GatewaySubscription> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async createInvoice(_data: CreateInvoiceDto): Promise<GatewayInvoice> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async retryInvoice(_invoiceId: string): Promise<GatewayInvoice> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  async getInvoice(_invoiceId: string): Promise<GatewayInvoice> {
    throw new Error('RazorpayGateway not yet implemented');
  }
  constructWebhookEvent(_payload: Buffer, _signature: string): GatewayWebhookEvent {
    throw new Error('RazorpayGateway not yet implemented');
  }
}