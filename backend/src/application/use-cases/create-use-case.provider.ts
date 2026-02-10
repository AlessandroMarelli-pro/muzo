import { FactoryProvider } from '@nestjs/common';
import { InjectionToken } from '../utils/create-token';

export function createUseCaseProvider<T, A extends any[]>(
  UseCaseClass: new (...args: A) => T,
  inject: { [K in keyof A]: InjectionToken<A[K]> },
): FactoryProvider {
  return {
    provide: UseCaseClass,
    useFactory: (...args: A) => new UseCaseClass(...args),
    inject,
  };
}
