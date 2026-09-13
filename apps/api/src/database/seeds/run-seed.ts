import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import * as bcrypt from 'bcrypt';
import dataSource from '../data-source';
import { Organization } from '../../modules/organizations/entities/organization.entity';
import { Role } from '../../modules/users/entities/role.entity';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/entities/user-role.entity';
import { Agency } from '../../modules/case/entities/agency.entity';
import { SupportPackage } from '../../modules/case/entities/support-package.entity';
import { SystemSetting } from '../../modules/admin/entities/system-setting.entity';
import {
  SystemRole,
  ROLE_PERMISSIONS,
  SupportPackageCategory,
} from '@city-manager/shared';

config({ path: resolve(__dirname, '../../../../../.env') });

async function seed() {
  await dataSource.initialize();
  console.log('Database connected for seeding...');

  const orgRepo = dataSource.getRepository(Organization);
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const agencyRepo = dataSource.getRepository(Agency);
  const packageRepo = dataSource.getRepository(SupportPackage);
  const settingsRepo = dataSource.getRepository(SystemSetting);

  const defaultAgencies = [
    { code: 'welfare', name: 'سازمان بهزیستی', agencyType: 'support' },
    { code: 'social-security', name: 'تأمین اجتماعی', agencyType: 'insurance' },
    { code: 'health-insurance', name: 'بیمه سلامت', agencyType: 'insurance' },
    { code: 'komite-emdad', name: 'کمیته امداد', agencyType: 'support' },
  ];

  let org = await orgRepo.findOne({ where: { code: 'default' } });
  if (!org) {
    org = await orgRepo.save({
      code: 'default',
      name: 'سازمان پیش‌فرض',
      nameEn: 'Default Organization',
      isActive: true,
    });
    console.log('Created default organization');
  }

  for (const code of Object.values(SystemRole)) {
    const existing = await roleRepo.findOne({ where: { code } });
    const names: Record<SystemRole, string> = {
      [SystemRole.SUPER_ADMIN]: 'مدیر کل سیستم',
      [SystemRole.ORG_ADMIN]: 'مدیر سازمان',
      [SystemRole.MANAGER]: 'مدیر',
      [SystemRole.SOCIAL_WORKER]: 'مددکار اجتماعی',
      [SystemRole.ANALYST]: 'تحلیل‌گر',
      [SystemRole.VIEWER]: 'بازدیدکننده',
    };
    if (!existing) {
      await roleRepo.save({
        code,
        name: names[code],
        permissions: ROLE_PERMISSIONS[code],
        isSystem: true,
      });
      console.log(`Created role: ${code}`);
    } else {
      existing.permissions = ROLE_PERMISSIONS[code];
      existing.name = names[code];
      await roleRepo.save(existing);
      console.log(`Updated role permissions: ${code}`);
    }
  }

  const adminEmail = 'admin@city.local';
  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await userRepo.save({
      email: adminEmail,
      username: 'admin',
      passwordHash: await bcrypt.hash('Admin@1234', 12),
      firstName: 'مدیر',
      lastName: 'سیستم',
      organizationId: org.id,
      isActive: true,
      isEmailVerified: true,
    });

    const superAdminRole = await roleRepo.findOneOrFail({
      where: { code: SystemRole.SUPER_ADMIN },
    });
    await userRoleRepo.save({ userId: admin.id, roleId: superAdminRole.id });
    console.log(`Created admin user: ${adminEmail} / Admin@1234 (username: admin)`);
  } else if (!admin.username) {
    admin.username = 'admin';
    await userRepo.save(admin);
    console.log('Backfilled admin username: admin');
  }

  for (const a of defaultAgencies) {
    const existing = await agencyRepo.findOne({ where: { organizationId: org.id, code: a.code } });
    if (!existing) {
      await agencyRepo.save({ ...a, organizationId: org.id, isActive: true });
      console.log(`Created agency: ${a.name}`);
    }
  }

  const defaultPackages = [
    { code: 'livelihood-basic', name: 'بسته معیشتی پایه', category: SupportPackageCategory.LIVELIHOOD, budgetAmount: '5000000' },
    { code: 'housing-repair', name: 'بازسازی مسکن', category: SupportPackageCategory.HOUSING, budgetAmount: '50000000' },
    { code: 'employment-skill', name: 'آموزش مهارت اشتغال', category: SupportPackageCategory.EMPLOYMENT, budgetAmount: '8000000' },
    { code: 'education-aid', name: 'کمک تحصیلی', category: SupportPackageCategory.EDUCATION, budgetAmount: '3000000' },
    { code: 'health-cover', name: 'پوشش درمانی', category: SupportPackageCategory.HEALTH, budgetAmount: '12000000' },
  ];
  for (const p of defaultPackages) {
    const existing = await packageRepo.findOne({ where: { organizationId: org.id, code: p.code } });
    if (!existing) {
      await packageRepo.save({ ...p, organizationId: org.id, isActive: true });
      console.log(`Created support package: ${p.name}`);
    }
  }

  const smsTemplates = [
    { code: 'general_notice', name: 'اطلاع عمومی', body: '{name} عزیز، {message}' },
    { code: 'household_assigned', name: 'ارجاع پرونده', body: '{name} عزیز، {message} — پرونده {caseNumber}' },
    { code: 'task_created', name: 'وظیفه جدید', body: '{name} عزیز، {message}' },
    { code: 'visit_scheduled', name: 'بازدید میدانی', body: '{name} عزیز، {message}' },
    { code: 'support_assigned', name: 'تخصیص بسته', body: '{name} عزیز، {message}' },
    { code: 'vulnerability_high', name: 'آسیب‌پذیری بالا', body: '{name} عزیز، {message}' },
  ];
  const smsKey = 'messaging_sms';
  let smsSetting = await settingsRepo.findOne({ where: { organizationId: org.id, key: smsKey } });
  if (!smsSetting) {
    smsSetting = settingsRepo.create({
      organizationId: org.id,
      key: smsKey,
      value: {
        enabled: false,
        provider: 'smsir',
        apiBaseUrl: 'https://api.sms.ir/v1',
        apiKey: '',
        sender: '',
        templates: smsTemplates,
      },
      description: 'تنظیمات پیامک عملیاتی',
    });
    await settingsRepo.save(smsSetting);
    console.log('Created default messaging_sms templates');
  }

  await dataSource.destroy();
  console.log('Seed completed.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
