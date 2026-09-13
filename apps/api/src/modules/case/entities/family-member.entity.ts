import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

@Entity({ schema: 'case', name: 'family_members' })
export class FamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId!: string;

  @Column({ type: 'uuid', name: 'household_id' })
  householdId!: string;

  @Column({ type: 'varchar', length: 50, name: 'member_role', default: 'other' })
  memberRole!: string;

  @Column({ type: 'boolean', name: 'is_beneficiary', default: true })
  isBeneficiary!: boolean;

  @Column({ type: 'varchar', length: 100, name: 'first_name' })
  firstName!: string;

  @Column({ type: 'varchar', length: 100, name: 'last_name' })
  lastName!: string;

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  gender!: string;

  @Column({ type: 'date', name: 'birth_date', nullable: true })
  birthDate?: string;

  @Column({ type: 'varchar', length: 100, name: 'father_name', nullable: true })
  fatherName?: string;

  @Column({ type: 'varchar', length: 100, name: 'mother_name', nullable: true })
  motherName?: string;

  @Column({ type: 'varchar', length: 50, name: 'marital_status', nullable: true })
  maritalStatus?: string;

  @Column({ type: 'text', name: 'national_id_enc', nullable: true })
  nationalIdEnc?: string;

  @Column({ type: 'varchar', length: 64, name: 'national_id_hash', nullable: true })
  nationalIdHash?: string;

  @Column({ type: 'text', name: 'phone_enc', nullable: true })
  phoneEnc?: string;

  @Column({ type: 'varchar', length: 64, name: 'phone_hash', nullable: true })
  phoneHash?: string;

  @Column({ type: 'varchar', length: 50, name: 'education_level', nullable: true })
  educationLevel?: string;

  @Column({ type: 'varchar', length: 200, name: 'education_field', nullable: true })
  educationField?: string;

  @Column({ type: 'varchar', length: 50, name: 'employment_status', nullable: true })
  employmentStatus?: string;

  @Column({ type: 'varchar', length: 200, name: 'job_title', nullable: true })
  jobTitle?: string;

  @Column({ type: 'numeric', name: 'monthly_income', nullable: true })
  monthlyIncome?: number;

  @Column({ type: 'boolean', name: 'is_identity_verified', default: false })
  isIdentityVerified!: boolean;

  @Column({ type: 'date', name: 'left_household_at', nullable: true })
  leftHouseholdAt?: string;

  @Column({ type: 'varchar', length: 200, name: 'left_reason', nullable: true })
  leftReason?: string;

  @Column({ type: 'jsonb', name: 'custom_fields', default: {} })
  customFields!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date;
}
