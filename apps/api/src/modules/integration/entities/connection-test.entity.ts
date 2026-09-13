import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity({ schema: 'integration', name: 'connection_tests' })
export class ConnectionTest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'connector_id' })
  connectorId!: string;

  @Column({ type: 'boolean' })
  success!: boolean;

  @Column({ type: 'int', name: 'status_code', nullable: true })
  statusCode?: number;

  @Column({ type: 'int', name: 'latency_ms', nullable: true })
  latencyMs?: number;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'text', name: 'response_preview', nullable: true })
  responsePreview?: string;

  @Column({ type: 'uuid', name: 'tested_by', nullable: true })
  testedBy?: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'tested_at' })
  testedAt!: Date;
}
