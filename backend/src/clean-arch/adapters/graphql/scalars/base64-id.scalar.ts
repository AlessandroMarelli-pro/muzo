// adaptaters/graphql/scalars/base64-id.scalar.ts
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { fromBase64Id, toBase64Id } from '../utils/id-encoding';

@Scalar('Base64ID')
export class Base64ID implements CustomScalar<string, string> {
  description = 'ID encoded as base64 for transport';

  serialize(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Base64ID must be a string');
    return toBase64Id(value);
  }

  parseValue(value: unknown): string {
    if (typeof value !== 'string') throw new Error('Base64ID must be a string');
    return fromBase64Id(value);
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) throw new Error('Base64ID must be a string');
    return fromBase64Id(ast.value);
  }
}
