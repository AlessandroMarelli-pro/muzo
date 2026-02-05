import { FactoryProvider, Type } from '@nestjs/common';

/** Token that provides T when injected. Use createToken<T>() for symbols. */
export type InjectionToken<T = unknown> = symbol | Type<T> | string;

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
