import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpatialUpload } from '../entities/spatial-upload.entity';
import { SpatialFileParserService } from '../parsers/spatial-file-parser.service';
import { NeighborhoodsService } from './neighborhoods.service';
import { FabricsService } from './fabrics.service';
import { FabricTypesService } from './fabric-types.service';
import { UrbanLayersService } from './urban-layers.service';
import { IngestTargetType, ApiResponse, featureMapLabel, flattenGisAttributes } from '@city-manager/shared';
import { IngestFileQueryDto } from '../dto/gis.dto';

/** Soft cap — beyond this, ask user to simplify in QGIS (map UI cannot render millions of rings well). */
const MAX_LAYER_FEATURES = 250_000;

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @InjectRepository(SpatialUpload)
    private readonly uploadRepo: Repository<SpatialUpload>,
    private readonly parser: SpatialFileParserService,
    private readonly neighborhoodsService: NeighborhoodsService,
    private readonly fabricsService: FabricsService,
    private readonly fabricTypesService: FabricTypesService,
    private readonly urbanLayersService: UrbanLayersService,
  ) {}

  async ingestFile(
    orgId: string,
    userId: string,
    file: Express.Multer.File,
    query: IngestFileQueryDto,
  ): Promise<ApiResponse<unknown>> {
    const upload = this.uploadRepo.create({
      organizationId: orgId,
      uploadedBy: userId,
      originalFilename: file.originalname,
      fileFormat: file.originalname.split('.').pop()?.toLowerCase() ?? 'unknown',
      targetType: query.targetType,
      status: 'queued',
    });
    await this.uploadRepo.save(upload);

    const buffer = Buffer.from(file.buffer);
    const filename = file.originalname;
    const mimetype = file.mimetype;

    // Async processing — return job id immediately for large imports
    void this.processUpload(upload.id, orgId, userId, buffer, filename, mimetype, query).catch((err) => {
      this.logger.error(`Async ingest ${upload.id} failed: ${err instanceof Error ? err.message : err}`);
    });

    return {
      success: true,
      data: {
        uploadId: upload.id,
        status: 'queued',
        message: 'درخواست import در صف پردازش قرار گرفت',
      },
    };
  }

  async getUpload(orgId: string, uploadId: string): Promise<ApiResponse<SpatialUpload>> {
    const row = await this.uploadRepo.findOne({ where: { id: uploadId, organizationId: orgId } });
    if (!row) throw new NotFoundException('آپلود یافت نشد');
    return { success: true, data: row };
  }

  private async processUpload(
    uploadId: string,
    orgId: string,
    userId: string,
    buffer: Buffer,
    filename: string,
    mimetype: string,
    query: IngestFileQueryDto,
  ) {
    const upload = await this.uploadRepo.findOne({ where: { id: uploadId } });
    if (!upload) return;
    upload.status = 'processing';
    await this.uploadRepo.save(upload);

    try {
      const { format, geojson } = await this.parser.parse(buffer, filename, mimetype);
      upload.fileFormat = format;

      const polygons = this.parser.extractPolygons(geojson);
      if (!polygons.length) {
        throw new BadRequestException(
          'فایل فاقد محدوده چندضلعی (Polygon) است. برای لایه‌های شهری فقط Polygon/MultiPolygon پشتیبانی می‌شود؛ اگر فایل نقطه یا خط است، در QGIS به چندضلعی تبدیل کنید.',
        );
      }

      if (query.targetType === IngestTargetType.LAYER && polygons.length > MAX_LAYER_FEATURES) {
        throw new BadRequestException(
          `تعداد عوارض (${polygons.length.toLocaleString('en-US')}) بیش از حد مجاز (${MAX_LAYER_FEATURES.toLocaleString('en-US')}) است. فایل را در QGIS ساده‌سازی یا به لایه‌های کوچک‌تر تقسیم کنید.`,
        );
      }

      let featuresImported = 0;
      let layerMeta: { layerId: string; versionId: string; versionNumber: number } | null = null;

      if (query.targetType === IngestTargetType.LAYER) {
        const layer = await this.urbanLayersService.ensureLayer(orgId, {
          layerId: query.layerId,
          layerCode: query.layerCode,
          layerName: query.layerName,
          category: query.category,
          colorHex: query.colorHex,
        });
        const version = await this.urbanLayersService.createDraftVersion(
          layer.id,
          userId,
          `آپلود ${filename}`,
        );
        layerMeta = {
          layerId: layer.id,
          versionId: version.id,
          versionNumber: version.versionNumber,
        };

        const batch = polygons.map((feature, i) => {
          const props = feature.properties ?? {};
          const name =
            (typeof props.name === 'string' && props.name.trim()) ||
            (typeof props.title === 'string' && props.title.trim()) ||
            query.defaultName ||
            `عارضه ${i + 1}`;
          const code =
            (typeof props.code === 'string' && props.code) ||
            (typeof props.Code === 'string' && props.Code) ||
            `UL-${i + 1}`;
          return {
            code: String(code).slice(0, 100),
            name: String(name).slice(0, 300),
            geometry: feature.geometry as Record<string, unknown>,
            attributes: flattenGisAttributes(props),
          };
        });

        this.logger.log(`Ingesting ${batch.length} urban features into layer ${layer.id}`);
        try {
          featuresImported = await this.urbanLayersService.insertFeaturesBatch(
            orgId,
            layer.id,
            version.id,
            batch,
          );
          await this.urbanLayersService.publishLayerVersion(layer.id, version.id);
          await this.urbanLayersService.repairLayerPublications(orgId);
        } catch (err) {
          await this.urbanLayersService.deleteDraftVersion(version.id);
          throw err;
        }
      } else if (query.targetType === IngestTargetType.NEIGHBORHOOD) {
        const batch = polygons.map((feature, i) => {
          const name =
            featureMapLabel({
              ...(feature.properties ?? {}),
              attributes: feature.properties,
            }) ||
            query.defaultName ||
            `${filename}-${i + 1}`;
          const code =
            (feature.properties?.code as string) ??
            (feature.properties?.Code as string) ??
            `IMP-${Date.now()}-${i + 1}`;
          return {
            code: String(code).slice(0, 100),
            name: String(name).slice(0, 300),
            geometry: feature.geometry as Record<string, unknown>,
            metadata: feature.properties as Record<string, unknown>,
          };
        });
        featuresImported = await this.neighborhoodsService.createBatch(orgId, batch);
      } else if (query.targetType === IngestTargetType.FABRIC) {
        if (!query.fabricTypeId) {
          throw new BadRequestException('fabricTypeId برای import بافت الزامی است');
        }
        await this.fabricTypesService.getOrThrow(orgId, query.fabricTypeId);
        const batch = polygons.map((feature, i) => {
          const name =
            featureMapLabel({
              ...(feature.properties ?? {}),
              attributes: feature.properties,
            }) ||
            query.defaultName ||
            `${filename}-${i + 1}`;
          const code =
            (feature.properties?.code as string) ??
            (feature.properties?.Code as string) ??
            `IMP-${Date.now()}-${i + 1}`;
          return {
            code: String(code).slice(0, 100),
            name: String(name).slice(0, 300),
            neighborhoodId: query.neighborhoodId,
            geometry: feature.geometry as Record<string, unknown>,
            attributes: feature.properties as Record<string, unknown>,
          };
        });
        featuresImported = await this.fabricsService.createBatch(orgId, query.fabricTypeId, batch);
      }

      upload.featuresImported = featuresImported;
      upload.status = 'completed';
      upload.metadata = {
        featuresImported,
        ...(layerMeta ?? {}),
      };
      await this.uploadRepo.save(upload);
    } catch (err) {
      upload.status = 'failed';
      upload.errorMessage = err instanceof Error ? err.message : 'خطای import';
      await this.uploadRepo.save(upload);
    }
  }
}
