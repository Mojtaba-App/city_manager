'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { NavIcon } from '@/components/NavIcons';
import { DynamicFormFields } from '@/components/case/DynamicFormFields';
import {
  createDwelling, createHousehold, createMember, createInsurance, createOwnership,
  fetchAgencies, fetchFormSchema, fetchAssignees,
} from '@/lib/case-api';
import {
  MemberRole, OwnershipType, HouseholdStatus, FormDefinitionSchema, LandUseType, LAND_USE_LABELS,
  validateDynamicRequired, validateDwellingStep, validateHouseholdStep, validateMemberHeadStep,
  type LinkedPlaceIds,
} from '@city-manager/shared';
import { toPersianDigits } from '@/lib/format';
import { useFeedback } from '@/components/ui/Feedback';
import { apiFetch } from '@/lib/api';
import { LoadingOverlay } from '@/components/ui/LoadingSpinner';
import { getCitiesForProvince, IRAN_DISTRICTS, IRAN_PROVINCE_NAMES } from '@/lib/iran-locations';
import { LinkedPlaceCascade, type CascadeFabric, type CascadeFabricType, type CascadeNeighborhood } from '@/components/gis/LinkedPlaceCascade';
import { fetchFabricTypes } from '@/lib/gis-api';

const WIZARD_STEPS = [
  { id: 1, title: 'ملک', desc: 'آدرس و مشخصات منزل' },
  { id: 2, title: 'خانوار', desc: 'پرونده و وضعیت' },
  { id: 3, title: 'سرپرست', desc: 'عضو اول خانوار' },
  { id: 4, title: 'بیمه', desc: 'حمایت و بیمه (اختیاری)' },
];

type FieldErrors = Record<string, string>;

function Field({
  label,
  required,
  error,
  children,
  full,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`form-group ${full ? 'form-full' : ''} ${error ? 'has-error' : ''}`}>
      <span>
        {label}
        {required ? <em className="req-star"> *</em> : null}
      </span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

export default function NewHouseholdPage() {
  const router = useRouter();
  const feedback = useFeedback();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [neighborhoods, setNeighborhoods] = useState<CascadeNeighborhood[]>([]);
  const [fabrics, setFabrics] = useState<CascadeFabric[]>([]);
  const [fabricTypes, setFabricTypes] = useState<CascadeFabricType[]>([]);
  const [agencies, setAgencies] = useState<Array<{ id: string; name: string }>>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; displayName: string; email: string }>>([]);
  const [householdFormSchema, setHouseholdFormSchema] = useState<FormDefinitionSchema>({ sections: [], fields: [] });
  const [memberFormSchema, setMemberFormSchema] = useState<FormDefinitionSchema>({ sections: [], fields: [] });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touchedStep, setTouchedStep] = useState(false);

  const [dwelling, setDwelling] = useState({
    title: '', province: '', city: '', district: '', street: '', plaque: '',
    neighborhoodId: '', fabricTypeId: '',
    areaSqm: '', buildingType: '', landUse: '', buildingAgeYears: '', ownershipType: OwnershipType.TENANT,
  });

  useEffect(() => {
    apiFetch<CascadeNeighborhood[]>('/gis/neighborhoods', {}).then((r) => {
      if (r.success && Array.isArray(r.data)) setNeighborhoods(r.data);
    });
    apiFetch<CascadeFabric[]>('/gis/fabrics', {}).then((r) => {
      if (r.success && Array.isArray(r.data)) setFabrics(r.data);
    });
    void fetchFabricTypes().then((ft) => {
      if (Array.isArray(ft)) setFabricTypes(ft);
    });
  }, []);

  const place: LinkedPlaceIds = {
    neighborhoodId: dwelling.neighborhoodId,
    fabricId: '',
    fabricTypeId: dwelling.fabricTypeId,
  };

  const citiesForProvince = useMemo(
    () => (dwelling.province ? getCitiesForProvince(dwelling.province) : []),
    [dwelling.province],
  );
  const [household, setHousehold] = useState({
    caseNumber: '', status: HouseholdStatus.DRAFT, assignedUserId: '', notes: '', customFields: {} as Record<string, unknown>,
  });
  const [member, setMember] = useState({
    memberRole: MemberRole.HEAD, firstName: '', lastName: '', birthDate: '',
    fatherName: '', motherName: '', nationalId: '', phone: '',
    educationLevel: 'none', employmentStatus: 'unemployed', jobTitle: '', monthlyIncome: '',
    customFields: {} as Record<string, unknown>,
  });
  const [insurance, setInsurance] = useState({ insuranceType: '', agencyId: '', policyNumber: '' });

  const currentStep = useMemo(
    () => WIZARD_STEPS.find((s) => s.id === step) ?? WIZARD_STEPS[0],
    [step],
  );

  async function loadStepData(s: number) {
    if (s === 2) {
      const [f, users] = await Promise.all([fetchFormSchema('household'), fetchAssignees()]);
      if (f.success && f.data) setHouseholdFormSchema(f.data);
      if (users.success && Array.isArray(users.data)) setAssignees(users.data);
    }
    if (s === 3) {
      const f = await fetchFormSchema('member');
      if (f.success && f.data) setMemberFormSchema(f.data);
    }
    if (s === 4) {
      const a = await fetchAgencies();
      if (a.success && a.data) setAgencies(a.data as Array<{ id: string; name: string }>);
    }
  }

  function validateStep(s: number): FieldErrors {
    const e: FieldErrors = {};
    if (s === 1) {
      Object.assign(e, validateDwellingStep({
        title: dwelling.title,
        province: dwelling.province,
        city: dwelling.city,
        street: dwelling.street,
        plaque: dwelling.plaque,
        buildingType: dwelling.buildingType,
        ownershipType: dwelling.ownershipType,
      }));
    }
    if (s === 2) {
      Object.assign(e, validateHouseholdStep({ caseNumber: household.caseNumber }));
      Object.assign(e, validateDynamicRequired(householdFormSchema, household.customFields));
    }
    if (s === 3) {
      Object.assign(e, validateMemberHeadStep({
        firstName: member.firstName,
        lastName: member.lastName,
        nationalId: member.nationalId,
        phone: member.phone,
        birthDate: member.birthDate,
      }));
      Object.assign(e, validateDynamicRequired(memberFormSchema, member.customFields));
    }
    return e;
  }

  async function goNext() {
    setTouchedStep(true);
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length > 0) {
      feedback.error('لطفاً فیلدهای الزامی را کامل کنید', 'اعتبارسنجی');
      return;
    }
    const next = step + 1;
    await loadStepData(next);
    setTouchedStep(false);
    setErrors({});
    setStep(next);
  }

  function goPrev() {
    setTouchedStep(false);
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  async function submit() {
    setTouchedStep(true);
    // validate all critical steps before submit
    for (const s of [1, 2, 3]) {
      const e = validateStep(s);
      if (Object.keys(e).length > 0) {
        setStep(s);
        setErrors(e);
        feedback.error('برخی فیلدهای الزامی ناقص است', 'اعتبارسنجی');
        return;
      }
    }

    setSubmitting(true);
    try {
      const dw = await createDwelling({
        title: dwelling.title.trim(),
        province: dwelling.province.trim(),
        city: dwelling.city.trim(),
        district: dwelling.district.trim() || undefined,
        street: dwelling.street.trim(),
        plaque: dwelling.plaque.trim(),
        neighborhoodId: dwelling.neighborhoodId || undefined,
        areaSqm: dwelling.areaSqm ? Number(dwelling.areaSqm) : undefined,
        buildingType: dwelling.buildingType.trim(),
        landUse: dwelling.landUse || undefined,
        buildingAgeYears: dwelling.buildingAgeYears ? Number(dwelling.buildingAgeYears) : undefined,
        fullAddress: [dwelling.province, dwelling.city, dwelling.district, dwelling.street, dwelling.plaque].filter(Boolean).join('، '),
        customFields: dwelling.fabricTypeId
          ? { fabricTypeId: dwelling.fabricTypeId }
          : undefined,
      });
      if (!dw.success || !dw.data) throw new Error(dw.error?.message ?? 'خطا در ثبت ملک');

      const dwellingId = (dw.data as { id: string }).id;

      await createOwnership(dwellingId, {
        ownershipType: dwelling.ownershipType,
        isCurrent: true,
      });

      const hh = await createHousehold({
        dwellingId,
        neighborhoodId: dwelling.neighborhoodId || undefined,
        caseNumber: household.caseNumber.trim(),
        status: household.status,
        assignedUserId: household.assignedUserId || undefined,
        notes: household.notes.trim() || undefined,
        customFields: household.customFields,
      });
      if (!hh.success || !hh.data) throw new Error(hh.error?.message ?? 'خطا در ثبت خانوار');

      const householdId = (hh.data as { id: string }).id;

      const mem = await createMember(householdId, {
        ...member,
        firstName: member.firstName.trim(),
        lastName: member.lastName.trim(),
        nationalId: member.nationalId.trim(),
        phone: member.phone.trim(),
        monthlyIncome: member.monthlyIncome ? Number(member.monthlyIncome) : undefined,
      });
      if (!mem.success) throw new Error(mem.error?.message ?? 'خطا در ثبت سرپرست');

      if (insurance.insuranceType.trim() || insurance.agencyId || insurance.policyNumber.trim()) {
        await createInsurance(householdId, {
          insuranceType: insurance.insuranceType.trim() || 'health',
          agencyId: insurance.agencyId || undefined,
          policyNumber: insurance.policyNumber.trim() || undefined,
        });
      }

      feedback.success('پرونده خانوار با موفقیت ثبت شد');
      router.push(`/dashboard/households/${householdId}`);
    } catch (err) {
      feedback.error(err instanceof Error ? err.message : 'خطا در ثبت', 'ثبت پرونده');
    } finally {
      setSubmitting(false);
    }
  }

  function mark(name: string) {
    return touchedStep && errors[name] ? errors[name] : undefined;
  }

  return (
    <AppShell title="ثبت خانوار">
      <LoadingOverlay
        open={submitting}
        label="در حال ثبت پرونده…"
        hint="لطفاً تا پایان عملیات صبر کنید"
      />
      <div className="case-wizard">
        <header className="wizard-hero">
          <div>
            <p className="wizard-kicker">پرونده جدید</p>
            <h2>ثبت پرونده خانوار</h2>
            <p className="wizard-lead">
              مرحله فعلی: {currentStep.title} — {currentStep.desc}
            </p>
          </div>
          <div className="wizard-progress-ring" aria-hidden>
            <strong>{toPersianDigits(step)}</strong>
            <span>از {toPersianDigits(4)}</span>
          </div>
        </header>

        <ol className="wizard-steps" aria-label="مراحل ثبت">
          {WIZARD_STEPS.map((s) => (
            <li
              key={s.id}
              className={[
                step === s.id ? 'is-current' : '',
                step > s.id ? 'is-done' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="wizard-step-index">{toPersianDigits(s.id)}</span>
              <span className="wizard-step-meta">
                <strong>{s.title}</strong>
                <small>{s.desc}</small>
              </span>
            </li>
          ))}
        </ol>

        {step === 1 && (
          <div className="card wizard-card">
            <div className="wizard-card-head">
              <div>
                <h3>اطلاعات منزل / ملک</h3>
                <p>فیلدهای ستاره‌دار الزامی هستند و بدون آن‌ها نمی‌توانید ادامه دهید.</p>
              </div>
            </div>

            <section className="wizard-block">
              <h4>آدرس</h4>
              <div className="form-grid">
                <Field label="عنوان ملک" required error={mark('title')} full>
                  <input
                    value={dwelling.title}
                    aria-invalid={Boolean(mark('title'))}
                    onChange={(e) => setDwelling({ ...dwelling, title: e.target.value })}
                    placeholder="مثلاً واحد جنوبی پلاک ۱۲"
                  />
                </Field>
                <Field label="استان" required error={mark('province')}>
                  <select
                    value={dwelling.province}
                    aria-invalid={Boolean(mark('province'))}
                    onChange={(e) => setDwelling({ ...dwelling, province: e.target.value, city: '' })}
                  >
                    <option value="">— انتخاب استان —</option>
                    {IRAN_PROVINCE_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="شهر" required error={mark('city')}>
                  <select
                    value={dwelling.city}
                    disabled={!dwelling.province}
                    aria-invalid={Boolean(mark('city'))}
                    onChange={(e) => setDwelling({ ...dwelling, city: e.target.value })}
                  >
                    <option value="">
                      {dwelling.province ? '— انتخاب شهر —' : 'ابتدا استان را انتخاب کنید'}
                    </option>
                    {citiesForProvince.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="منطقه" error={mark('district')}>
                  <select
                    value={dwelling.district}
                    onChange={(e) => setDwelling({ ...dwelling, district: e.target.value })}
                  >
                    <option value="">— انتخاب منطقه —</option>
                    {IRAN_DISTRICTS.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="خیابان" required error={mark('street')}>
                  <input value={dwelling.street} aria-invalid={Boolean(mark('street'))} onChange={(e) => setDwelling({ ...dwelling, street: e.target.value })} />
                </Field>
                <Field label="پلاک" required error={mark('plaque')}>
                  <input value={dwelling.plaque} aria-invalid={Boolean(mark('plaque'))} onChange={(e) => setDwelling({ ...dwelling, plaque: e.target.value })} />
                </Field>
                <LinkedPlaceCascade
                  neighborhoods={neighborhoods}
                  fabrics={fabrics}
                  fabricTypes={fabricTypes}
                  value={place}
                  onChange={(next) => setDwelling({
                    ...dwelling,
                    neighborhoodId: next.neighborhoodId,
                    fabricTypeId: next.fabricTypeId,
                  })}
                  variant="form"
                />
              </div>
            </section>

            <section className="wizard-block">
              <h4>مشخصات ابنیه</h4>
              <div className="form-grid">
                <Field label="مساحت (m²)">
                  <input type="number" min={0} value={dwelling.areaSqm} onChange={(e) => setDwelling({ ...dwelling, areaSqm: e.target.value })} />
                </Field>
                <Field label="کاربری زمین">
                  <select
                    value={dwelling.landUse}
                    onChange={(e) => setDwelling({ ...dwelling, landUse: e.target.value })}
                  >
                    <option value="">— انتخاب کاربری —</option>
                    {Object.values(LandUseType).map((u) => (
                      <option key={u} value={u}>{LAND_USE_LABELS[u]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="نوع ساختمان" required error={mark('buildingType')}>
                  <input
                    value={dwelling.buildingType}
                    aria-invalid={Boolean(mark('buildingType'))}
                    onChange={(e) => setDwelling({ ...dwelling, buildingType: e.target.value })}
                    placeholder="آجری، فلزی، بتنی…"
                  />
                </Field>
                <Field label="قدمت ابنیه (سال)">
                  <input type="number" min={0} value={dwelling.buildingAgeYears} onChange={(e) => setDwelling({ ...dwelling, buildingAgeYears: e.target.value })} />
                </Field>
                <Field label="نوع مالکیت" required error={mark('ownershipType')}>
                  <select
                    value={dwelling.ownershipType}
                    aria-invalid={Boolean(mark('ownershipType'))}
                    onChange={(e) => setDwelling({ ...dwelling, ownershipType: e.target.value as OwnershipType })}
                  >
                    <option value={OwnershipType.OWNER}>مالک</option>
                    <option value={OwnershipType.TENANT}>مستأجر</option>
                    <option value={OwnershipType.RENT_FREE}>بدون اجاره</option>
                    <option value={OwnershipType.COOPERATIVE}>تعاونی</option>
                    <option value={OwnershipType.NO_DEED}>فاقد سند</option>
                    <option value={OwnershipType.SHARED}>مشاعی</option>
                    <option value={OwnershipType.OTHER}>سایر</option>
                  </select>
                </Field>
              </div>
            </section>

            <div className="wizard-actions">
              <Link href="/dashboard/households" className="btn">انصراف</Link>
              <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
                ادامه
                <NavIcon name="collapse" size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card wizard-card">
            <div className="wizard-card-head">
              <div>
                <h3>اطلاعات خانوار</h3>
                <p>شماره پرونده یکتا و وضعیت اولیه را مشخص کنید.</p>
              </div>
            </div>
            <section className="wizard-block">
              <div className="form-grid">
                <Field label="شماره پرونده" required error={mark('caseNumber')}>
                  <input
                    value={household.caseNumber}
                    aria-invalid={Boolean(mark('caseNumber'))}
                    onChange={(e) => setHousehold({ ...household, caseNumber: e.target.value })}
                    placeholder="مثلاً HH-1403-001"
                  />
                </Field>
                <Field label="وضعیت">
                  <select
                    value={household.status}
                    onChange={(e) => setHousehold({ ...household, status: e.target.value as HouseholdStatus })}
                  >
                    <option value="draft">پیش‌نویس</option>
                    <option value="active">فعال</option>
                  </select>
                </Field>
                <Field label="کاربر مسئول">
                  <select
                    value={household.assignedUserId}
                    onChange={(e) => setHousehold({ ...household, assignedUserId: e.target.value })}
                  >
                    <option value="">— انتخاب کاربر —</option>
                    {assignees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName}{u.email ? ` (${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="یادداشت" full>
                  <textarea value={household.notes} onChange={(e) => setHousehold({ ...household, notes: e.target.value })} />
                </Field>
              </div>
            </section>
            <DynamicFormFields
              schema={householdFormSchema}
              values={household.customFields}
              errors={touchedStep ? errors : undefined}
              onChange={(k, v) => setHousehold({ ...household, customFields: { ...household.customFields, [k]: v } })}
            />
            <div className="wizard-actions">
              <button type="button" className="btn" onClick={goPrev}>
                <NavIcon name="expand" size={16} />
                بازگشت
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
                ادامه
                <NavIcon name="collapse" size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card wizard-card">
            <div className="wizard-card-head">
              <div>
                <h3>سرپرست خانوار</h3>
                <p>اطلاعات عضو اول (سرپرست) را کامل وارد کنید.</p>
              </div>
            </div>
            <section className="wizard-block">
              <div className="form-grid">
                <Field label="نام" required error={mark('firstName')}>
                  <input value={member.firstName} aria-invalid={Boolean(mark('firstName'))} onChange={(e) => setMember({ ...member, firstName: e.target.value })} />
                </Field>
                <Field label="نام خانوادگی" required error={mark('lastName')}>
                  <input value={member.lastName} aria-invalid={Boolean(mark('lastName'))} onChange={(e) => setMember({ ...member, lastName: e.target.value })} />
                </Field>
                <Field label="تاریخ تولد" required error={mark('birthDate')}>
                  <input type="date" value={member.birthDate} aria-invalid={Boolean(mark('birthDate'))} onChange={(e) => setMember({ ...member, birthDate: e.target.value })} />
                </Field>
                <Field label="نام پدر">
                  <input value={member.fatherName} onChange={(e) => setMember({ ...member, fatherName: e.target.value })} />
                </Field>
                <Field label="نام مادر">
                  <input value={member.motherName} onChange={(e) => setMember({ ...member, motherName: e.target.value })} />
                </Field>
                <Field label="کد ملی" required error={mark('nationalId')}>
                  <input
                    dir="ltr"
                    maxLength={10}
                    value={member.nationalId}
                    aria-invalid={Boolean(mark('nationalId'))}
                    onChange={(e) => setMember({ ...member, nationalId: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                </Field>
                <Field label="تلفن" required error={mark('phone')}>
                  <input
                    dir="ltr"
                    value={member.phone}
                    aria-invalid={Boolean(mark('phone'))}
                    onChange={(e) => setMember({ ...member, phone: e.target.value })}
                  />
                </Field>
                <Field label="تحصیلات">
                  <select value={member.educationLevel} onChange={(e) => setMember({ ...member, educationLevel: e.target.value })}>
                    <option value="none">ندارد</option>
                    <option value="diploma">دیپلم</option>
                    <option value="bachelor">کارشناسی</option>
                    <option value="master">کارشناسی ارشد</option>
                  </select>
                </Field>
                <Field label="شغل">
                  <input value={member.jobTitle} onChange={(e) => setMember({ ...member, jobTitle: e.target.value })} />
                </Field>
                <Field label="درآمد ماهانه">
                  <input type="number" min={0} value={member.monthlyIncome} onChange={(e) => setMember({ ...member, monthlyIncome: e.target.value })} />
                </Field>
              </div>
            </section>
            <DynamicFormFields
              schema={memberFormSchema}
              values={member.customFields}
              errors={touchedStep ? errors : undefined}
              onChange={(k, v) => setMember({ ...member, customFields: { ...member.customFields, [k]: v } })}
            />
            <div className="wizard-actions">
              <button type="button" className="btn" onClick={goPrev}>
                <NavIcon name="expand" size={16} />
                بازگشت
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void goNext()}>
                ادامه
                <NavIcon name="collapse" size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="card wizard-card">
            <div className="wizard-card-head">
              <div>
                <h3>بیمه و ارگان حمایتی</h3>
                <p>این مرحله اختیاری است؛ در صورت نداشتن اطلاعات می‌توانید مستقیم ثبت نهایی کنید.</p>
              </div>
            </div>
            <section className="wizard-block">
              <div className="form-grid">
                <Field label="نوع بیمه">
                  <input
                    value={insurance.insuranceType}
                    onChange={(e) => setInsurance({ ...insurance, insuranceType: e.target.value })}
                    placeholder="مثلاً سلامت / تأمین اجتماعی"
                  />
                </Field>
                <Field label="ارگان">
                  <select value={insurance.agencyId} onChange={(e) => setInsurance({ ...insurance, agencyId: e.target.value })}>
                    <option value="">—</option>
                    {agencies.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="شماره بیمه‌نامه">
                  <input value={insurance.policyNumber} onChange={(e) => setInsurance({ ...insurance, policyNumber: e.target.value })} />
                </Field>
              </div>
            </section>
            <div className="wizard-actions">
              <button type="button" className="btn" onClick={goPrev} disabled={submitting}>بازگشت</button>
              <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => void submit()}>
                {submitting ? 'در حال ثبت…' : 'ثبت نهایی پرونده'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
