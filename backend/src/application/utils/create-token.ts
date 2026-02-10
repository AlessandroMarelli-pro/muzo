import { Type } from '@nestjs/common';

/** Token that provides T when injected. Use createToken<T>() for symbols. */
export type InjectionToken<T = unknown> = symbol | Type<T> | string;

/** Creates a symbol token typed as providing T. Use for ports so order is checked. */
export function createToken<T>(name: string): InjectionToken<T> {
  return Symbol(name) as InjectionToken<T>;
}
