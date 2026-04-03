import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('activity_log')
export class ActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventType: string;

  @Column()
  documentId: string;

  @Column()
  filename: string;

  @CreateDateColumn()
  occurredAt: Date;
}
