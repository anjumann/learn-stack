import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  filename: string;

  @Column()
  mimeType: string;

  @Column()
  s3Key: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ nullable: true, default: null })
  chunkCount: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
