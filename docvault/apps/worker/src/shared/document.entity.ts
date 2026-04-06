import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type DocumentDocument = HydratedDocument<Document>;

@Schema({ collection: 'documents' })
export class Document {
  @Prop({ type: String, default: () => uuidv4() })
  _id!: string;

  @Prop({ required: true })
  filename!: string;

  @Prop({ required: true })
  mimeType!: string;

  @Prop({ required: true })
  s3Key!: string;

  @Prop({ default: 'pending' })
  status!: string;

  @Prop({ type: Number, default: null })
  chunkCount!: number | null;

  @Prop({ default: () => new Date() })
  createdAt!: Date;
}

export const DocumentSchema = SchemaFactory.createForClass(Document);
