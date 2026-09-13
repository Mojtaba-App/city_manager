import { MigrationInterface, QueryRunner } from 'typeorm';

const NEW_VALUES = [
  'plan_spatial',
  'plan_national',
  'plan_metro',
  'plan_master',
  'plan_strategic',
  'plan_detailed',
  'plan_hadi',
  'plan_regeneration',
  'plan_renewal',
  'plan_improvement',
  'plan_restoration',
  'plan_infill',
  'plan_tod',
  'plan_special',
  'plan_land_prep',
  'plan_placemaking',
] as const;

export class UrbanLayerPlanCategories1736200000000 implements MigrationInterface {
  name = 'UrbanLayerPlanCategories1736200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const value of NEW_VALUES) {
      await queryRunner.query(`
        DO $$ BEGIN
          ALTER TYPE gis.urban_layer_category_enum ADD VALUE IF NOT EXISTS '${value}';
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL cannot safely remove enum values; keep for forward compatibility.
  }
}
