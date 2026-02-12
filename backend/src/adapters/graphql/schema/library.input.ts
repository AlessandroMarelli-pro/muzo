import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateLibraryInput {
  @Field()
  name: string;

  @Field()
  rootPath: string;

  @Field({ nullable: true })
  autoScan?: boolean;

  @Field(() => Int, { nullable: true })
  scanInterval?: number;

  @Field({ nullable: true })
  includeSubdirectories?: boolean;

  @Field(() => [String], { nullable: true })
  supportedFormats?: string[];

  @Field(() => Int, { nullable: true })
  maxFileSize?: number;
}
