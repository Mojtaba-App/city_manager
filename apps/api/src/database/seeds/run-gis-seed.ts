import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import dataSource from '../data-source';
import { FabricType } from '../../modules/gis/entities/fabric-type.entity';
import { Organization } from '../../modules/organizations/entities/organization.entity';

config({ path: resolve(__dirname, '../../../../../.env') });

const DEFAULT_FABRIC_TYPES = [
  { code: 'deteriorated', name: 'بافت فرسوده', colorHex: '#c0392b' },
  { code: 'historic', name: 'بافت تاریخی', colorHex: '#8e44ad' },
  { code: 'informal', name: 'بافت خودرو', colorHex: '#d35400' },
  { code: 'commercial', name: 'بافت تجاری', colorHex: '#2980b9' },
  { code: 'residential', name: 'بافت مسکونی', colorHex: '#27ae60' },
];

async function seedGis() {
  await dataSource.initialize();
  const orgRepo = dataSource.getRepository(Organization);
  const fabricTypeRepo = dataSource.getRepository(FabricType);

  const org = await orgRepo.findOne({ where: { code: 'default' } });
  if (!org) {
    console.log('Default org not found — run main seed first');
    await dataSource.destroy();
    return;
  }

  for (const [i, ft] of DEFAULT_FABRIC_TYPES.entries()) {
    const existing = await fabricTypeRepo.findOne({
      where: { organizationId: org.id, code: ft.code },
    });
    if (!existing) {
      await fabricTypeRepo.save({
        organizationId: org.id,
        code: ft.code,
        name: ft.name,
        colorHex: ft.colorHex,
        fillOpacity: 0.35,
        sortOrder: i,
        isActive: true,
      });
      console.log(`Created fabric type: ${ft.name}`);
    }
  }

  await dataSource.destroy();
  console.log('GIS seed completed.');
}

seedGis().catch((err) => {
  console.error(err);
  process.exit(1);
});
