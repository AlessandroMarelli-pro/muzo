import { fail } from '../common';
import { Model } from '../types/model-types';
import { Brand } from './scalars';

export const modelIdFactory = <Y extends string, B extends Brand<string, `${Y}Id`>>(prefix: Y) => {
  const validator = (x: string): x is B => {
    return x.split(':')[0] === prefix;
  };
  const generator = (x: string): B => {
    const id = `${prefix}:${x}`;
    return validator(id) ? id : fail(`${prefix} id creation failed : ${id}`);
  };
  return {
    isId: validator,
    id: generator,
  };
};

export const extractModelId = (id: Model['id']) => {
  const [modelName, dbId] = id.split(':');
  if (modelName === undefined || dbId === undefined)
    throw new Error(`extractModelId impossible ${id}`);

  return { modelName, dbId };
};
