export type Maybe<T> = T | null;

type Fail = (message: string) => never;

export const fail: Fail = (message) => {
  throw new Error(message);
};

type OverlapKeys<A, B> = Extract<keyof A, keyof B>;

export type StrictExtend<U, Add> = [OverlapKeys<Add, U>] extends [never]
  ? U & Add
  : never;
