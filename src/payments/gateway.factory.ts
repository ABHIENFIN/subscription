import { IPaymentGateway } from './gateway.interface';
import { StripeGateway } from './stripe/stripe.gateway';
import { BadRequestException } from '../common/exceptions';

const registry: Record<string, () => IPaymentGateway> = {
  stripe: () => new StripeGateway(),
};

export function getGateway(provider: string): IPaymentGateway {
  const factory = registry[provider];
  if (!factory) {
    throw new BadRequestException(
      `Unsupported payment provider: ${provider}. Supported: ${Object.keys(registry).join(', ')}`
    );
  }
  return factory();
}

export function registerGateway(provider: string, factory: () => IPaymentGateway): void {
  registry[provider] = factory;
}
