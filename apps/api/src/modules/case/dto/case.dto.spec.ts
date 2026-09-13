import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateDwellingDto,
  CreateHouseholdDto,
  CreateMemberDto,
  UpsertFormDefinitionDto,
} from './case.dto';
import { MemberRole, OwnershipType } from '@city-manager/shared';

async function errorsOf<T extends object>(Cls: new () => T, payload: Record<string, unknown>) {
  const dto = plainToInstance(Cls, payload);
  const errors = await validate(dto);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

describe('CreateDwellingDto', () => {
  const valid = {
    title: 'واحد ۱',
    province: 'تهران',
    city: 'تهران',
    street: 'ولیعصر',
    plaque: '۱۲',
    buildingType: 'آجری',
  };

  it('accepts valid dwelling', async () => {
    expect(await errorsOf(CreateDwellingDto, valid)).toHaveLength(0);
  });

  it('accepts land use', async () => {
    expect(await errorsOf(CreateDwellingDto, { ...valid, landUse: 'residential' })).toHaveLength(0);
  });

  it('rejects missing required fields', async () => {
    const msgs = await errorsOf(CreateDwellingDto, {});
    expect(msgs.some((m) => m.includes('عنوان'))).toBe(true);
    expect(msgs.some((m) => m.includes('استان'))).toBe(true);
    expect(msgs.some((m) => m.includes('شهر'))).toBe(true);
  });
});

describe('CreateHouseholdDto', () => {
  it('requires case number and dwelling id', async () => {
    const msgs = await errorsOf(CreateHouseholdDto, { dwellingId: '00000000-0000-4000-8000-000000000001' });
    expect(msgs.some((m) => m.includes('پرونده'))).toBe(true);
  });
});

describe('CreateMemberDto', () => {
  const base = {
    memberRole: MemberRole.HEAD,
    firstName: 'علی',
    lastName: 'رضایی',
  };

  it('accepts member without optional PII', async () => {
    expect(await errorsOf(CreateMemberDto, base)).toHaveLength(0);
  });

  it('rejects invalid national id format', async () => {
    const msgs = await errorsOf(CreateMemberDto, { ...base, nationalId: '123' });
    expect(msgs.some((m) => m.includes('کد ملی'))).toBe(true);
  });

  it('rejects short phone', async () => {
    const msgs = await errorsOf(CreateMemberDto, { ...base, phone: '0912' });
    expect(msgs.some((m) => m.includes('تلفن'))).toBe(true);
  });

  it('rejects invalid birth date', async () => {
    const msgs = await errorsOf(CreateMemberDto, { ...base, birthDate: 'not-a-date' });
    expect(msgs.some((m) => m.includes('تاریخ'))).toBe(true);
  });
});

describe('UpsertFormDefinitionDto', () => {
  it('requires entity type and name', async () => {
    const msgs = await errorsOf(UpsertFormDefinitionDto, { schema: { fields: [] } });
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('rejects unknown entity type', async () => {
    const msgs = await errorsOf(UpsertFormDefinitionDto, {
      entityType: 'widget',
      name: 'فرم',
      schema: { sections: [], fields: [] },
    });
    expect(msgs.some((m) => m.includes('نامعتبر'))).toBe(true);
  });
});
