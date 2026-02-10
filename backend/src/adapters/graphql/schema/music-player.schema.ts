import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MusicPlayer {
  @Field(() => [Float], { nullable: true })
  currentWaveformData?: number[];
}
