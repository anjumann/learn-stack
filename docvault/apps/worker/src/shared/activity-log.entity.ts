import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type ActivityLogDocument = HydratedDocument<ActivityLog>;

@Schema({ collection: 'activity_log' })
export class ActivityLog {
  @Prop({ type: String, default: () => uuidv4() })
  _id!: string;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ required: true })
  documentId!: string;

  @Prop({ required: true })
  filename!: string;

  @Prop({ default: () => new Date() })
  occurredAt!: Date;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
