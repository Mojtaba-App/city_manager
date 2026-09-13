import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Permissions } from '../../common/decorators/auth.decorators';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Audited } from '../../common/decorators/audit.decorator';
import { Permission, JwtPayload, ApiResponse, GisFeatureType } from '@city-manager/shared';
import { NeighborhoodsService } from './services/neighborhoods.service';
import { FabricsService } from './services/fabrics.service';
import { DwellingsService } from './services/dwellings.service';
import { GeoJsonService } from './services/geojson.service';
import { SpatialSearchService } from './services/spatial-search.service';
import { IngestService } from './services/ingest.service';
import {
  CreateFabricTypeDto,
  UpdateFabricTypeDto,
  CreateNeighborhoodDto,
  UpdateNeighborhoodDto,
  UpdateGeometryDto,
  CreateFabricDto,
  UpdateFabricDto,
  CreateDwellingDto,
  IngestFileQueryDto,
  SpatialSearchQueryDto,
  BboxQueryDto,
  GeoJsonLayersQueryDto,
  CreateAreaProjectDto,
  UpdateAreaProjectDto,
  CreateRegenerationProgramDto,
  UpdateRegenerationProgramDto,
  CreateUrbanLayerDto,
  UpdateUrbanLayerDto,
} from './dto/gis.dto';
import { FabricTypesService } from './services/fabric-types.service';
import { AreaProjectsService } from './services/area-projects.service';
import { UrbanLayersService } from './services/urban-layers.service';
import { RegenerationProgramsService } from './services/regeneration-programs.service';
import { MvtService, MvtLayer } from './services/mvt.service';

function resolveOrgId(user: JwtPayload): string {
  if (!user.orgId) {
    throw new ForbiddenException('سازمان کاربر تعریف نشده است');
  }
  return user.orgId;
}

@ApiTags('gis')
@ApiBearerAuth()
@SkipThrottle()
@UseGuards(JwtAuthGuard)
@Controller('gis')
export class GisController {
  constructor(
    private readonly fabricTypesService: FabricTypesService,
    private readonly neighborhoodsService: NeighborhoodsService,
    private readonly fabricsService: FabricsService,
    private readonly dwellingsService: DwellingsService,
    private readonly geoJsonService: GeoJsonService,
    private readonly spatialSearchService: SpatialSearchService,
    private readonly ingestService: IngestService,
    private readonly areaProjectsService: AreaProjectsService,
    private readonly urbanLayersService: UrbanLayersService,
    private readonly programsService: RegenerationProgramsService,
    private readonly mvtService: MvtService,
  ) {}

  // --- Urban reference layers ---
  @Get('urban-layers')
  @Permissions(Permission.GIS_LAYERS_READ)
  listUrbanLayers(@CurrentUser() user: JwtPayload) {
    return this.urbanLayersService.findAll(resolveOrgId(user));
  }

  @Post('urban-layers')
  @Permissions(Permission.GIS_LAYERS_WRITE)
  @Audited({ action: 'urban_layer.create', resource: 'urban_layer' })
  createUrbanLayer(@CurrentUser() user: JwtPayload, @Body() dto: CreateUrbanLayerDto) {
    return this.urbanLayersService.create(resolveOrgId(user), dto);
  }

  @Patch('urban-layers/:id')
  @Permissions(Permission.GIS_LAYERS_WRITE)
  @Audited({ action: 'urban_layer.update', resource: 'urban_layer' })
  updateUrbanLayer(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUrbanLayerDto,
  ) {
    return this.urbanLayersService.update(resolveOrgId(user), id, dto);
  }

  @Delete('urban-layers/:id')
  @Permissions(Permission.GIS_LAYERS_WRITE)
  @Audited({ action: 'urban_layer.delete', resource: 'urban_layer', severity: 'warning' })
  deleteUrbanLayer(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.urbanLayersService.remove(resolveOrgId(user), id);
  }

  @Delete('features/:type/:id')
  @Permissions(Permission.GIS_LAYERS_WRITE)
  @Audited({ action: 'gis_feature.delete', resource: 'gis_feature', severity: 'warning' })
  async deleteFeature(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: GisFeatureType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const orgId = resolveOrgId(user);
    if (type === GisFeatureType.LAYER_FEATURE) {
      return this.urbanLayersService.softDeleteFeature(orgId, id);
    }
    if (type === GisFeatureType.NEIGHBORHOOD) {
      return this.neighborhoodsService.softDelete(orgId, id);
    }
    if (type === GisFeatureType.FABRIC) {
      return this.fabricsService.softDelete(orgId, id);
    }
    if (type === GisFeatureType.DWELLING) {
      return this.dwellingsService.softDelete(orgId, id);
    }
    throw new BadRequestException('نوع عارضه نامعتبر است');
  }

  // --- Fabric Types (dynamic) ---
  @Get('fabric-types')
  @Permissions(Permission.FABRICS_READ)
  listFabricTypes(@CurrentUser() user: JwtPayload) {
    return this.fabricTypesService.findAll(resolveOrgId(user));
  }

  @Post('fabric-types')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric_type.create', resource: 'fabric_type' })
  createFabricType(@CurrentUser() user: JwtPayload, @Body() dto: CreateFabricTypeDto) {
    return this.fabricTypesService.create(resolveOrgId(user), dto);
  }

  @Patch('fabric-types/:id')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric_type.update', resource: 'fabric_type' })
  updateFabricType(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFabricTypeDto,
  ) {
    return this.fabricTypesService.update(resolveOrgId(user), id, dto);
  }

  @Delete('fabric-types/:id')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric_type.delete', resource: 'fabric_type', severity: 'warning' })
  deleteFabricType(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.fabricTypesService.remove(resolveOrgId(user), id);
  }

  // --- Neighborhoods (target areas) ---
  @Get('neighborhoods')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  listNeighborhoods(@CurrentUser() user: JwtPayload) {
    return this.neighborhoodsService.findAll(resolveOrgId(user));
  }

  @Get('neighborhoods/:id')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  getNeighborhood(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.neighborhoodsService.findOne(resolveOrgId(user), id);
  }

  @Post('neighborhoods')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'neighborhood.create', resource: 'neighborhood' })
  createNeighborhood(@CurrentUser() user: JwtPayload, @Body() dto: CreateNeighborhoodDto) {
    return this.neighborhoodsService.create(resolveOrgId(user), dto);
  }

  @Patch('neighborhoods/:id')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'neighborhood.update', resource: 'neighborhood' })
  updateNeighborhood(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNeighborhoodDto,
  ) {
    return this.neighborhoodsService.update(resolveOrgId(user), id, dto);
  }

  @Patch('neighborhoods/:id/geometry')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'neighborhood.geometry', resource: 'neighborhood' })
  updateNeighborhoodGeometry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeometryDto,
  ) {
    return this.neighborhoodsService.updateGeometry(resolveOrgId(user), id, dto.geometry);
  }

  @Get('neighborhoods/:id/contained')
  @Permissions(Permission.GIS_SPATIAL_SEARCH)
  getNeighborhoodContained(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.neighborhoodsService.getContainedData(resolveOrgId(user), id);
  }

  @Get('neighborhoods/:id/dashboard')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  getNeighborhoodDashboard(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.neighborhoodsService.getDashboard(resolveOrgId(user), id);
  }

  // --- Regeneration programs ---
  @Get('programs')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  listPrograms(@CurrentUser() user: JwtPayload) {
    return this.programsService.findAll(resolveOrgId(user));
  }

  @Get('programs/:id')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  getProgram(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.programsService.findOne(resolveOrgId(user), id);
  }

  @Post('programs')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'program.create', resource: 'regeneration_program' })
  createProgram(@CurrentUser() user: JwtPayload, @Body() dto: CreateRegenerationProgramDto) {
    return this.programsService.create(resolveOrgId(user), dto);
  }

  @Patch('programs/:id')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'program.update', resource: 'regeneration_program' })
  updateProgram(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRegenerationProgramDto,
  ) {
    return this.programsService.update(resolveOrgId(user), id, dto);
  }

  @Delete('programs/:id')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'program.delete', resource: 'regeneration_program', severity: 'warning' })
  deleteProgram(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.programsService.softDelete(resolveOrgId(user), id);
  }

  // --- Fabrics ---
  @Get('fabrics')
  @Permissions(Permission.FABRICS_READ)
  listFabrics(
    @CurrentUser() user: JwtPayload,
    @Query('neighborhoodId') neighborhoodId?: string,
  ) {
    return this.fabricsService.findAll(resolveOrgId(user), neighborhoodId);
  }

  @Post('fabrics')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric.create', resource: 'fabric' })
  createFabric(@CurrentUser() user: JwtPayload, @Body() dto: CreateFabricDto) {
    return this.fabricsService.create(resolveOrgId(user), dto);
  }

  @Patch('fabrics/:id')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric.update', resource: 'fabric' })
  updateFabric(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFabricDto,
  ) {
    return this.fabricsService.updateMeta(resolveOrgId(user), id, dto);
  }

  @Patch('fabrics/:id/geometry')
  @Permissions(Permission.FABRICS_WRITE)
  @Audited({ action: 'fabric.geometry', resource: 'fabric' })
  updateFabricGeometry(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeometryDto,
  ) {
    return this.fabricsService.updateGeometry(resolveOrgId(user), id, dto.geometry);
  }

  // --- Dwellings ---
  @Get('dwellings')
  @Permissions(Permission.DWELLINGS_READ)
  listDwellings(
    @CurrentUser() user: JwtPayload,
    @Query('neighborhoodId') neighborhoodId?: string,
  ) {
    return this.dwellingsService.findAll(resolveOrgId(user), neighborhoodId);
  }

  @Post('dwellings')
  @Permissions(Permission.DWELLINGS_WRITE)
  @Audited({ action: 'gis_dwelling.create', resource: 'dwelling' })
  createDwelling(@CurrentUser() user: JwtPayload, @Body() dto: CreateDwellingDto) {
    return this.dwellingsService.create(resolveOrgId(user), dto, user.sub);
  }

  @Patch('dwellings/:id/location')
  @Permissions(Permission.DWELLINGS_WRITE)
  @Audited({ action: 'gis_dwelling.location', resource: 'dwelling' })
  updateDwellingLocation(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGeometryDto,
  ) {
    return this.dwellingsService.updateLocation(resolveOrgId(user), id, dto.geometry, user.sub);
  }

  // --- GeoJSON map feed ---
  @Get('geojson')
  @Permissions(Permission.GIS_LAYERS_READ)
  async getGeoJson(@CurrentUser() user: JwtPayload, @Query() query: GeoJsonLayersQueryDto): Promise<ApiResponse<unknown>> {
    const bboxParts = query.bbox
      ?.split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    const bbox =
      bboxParts?.length === 4
        ? ([bboxParts[0], bboxParts[1], bboxParts[2], bboxParts[3]] as [
            number,
            number,
            number,
            number,
          ])
        : undefined;

    const data = await this.geoJsonService.getLayers(resolveOrgId(user), {
      layers: query.layers?.split(',').map((s: string) => s.trim()),
      neighborhoodIds: query.neighborhoodIds?.split(','),
      fabricTypeIds: query.fabricTypeIds?.split(','),
      urbanLayerIds: query.urbanLayerIds?.split(',').filter(Boolean),
      bbox,
      zoom: query.zoom,
      limit: query.limit,
      offset: query.offset,
    });
    return { success: true, data };
  }

  @Get('tiles/:layer/:z/:x/:y')
  @Permissions(Permission.GIS_LAYERS_READ)
  async getMvtTile(
    @CurrentUser() user: JwtPayload,
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res() res: Response,
  ) {
    const allowed: MvtLayer[] = ['neighborhoods', 'fabrics', 'urban'];
    if (!allowed.includes(layer as MvtLayer)) {
      throw new BadRequestException('لایه MVT نامعتبر است (neighborhoods|fabrics|urban)');
    }
    const tile = await this.mvtService.getTile(
      resolveOrgId(user),
      layer as MvtLayer,
      Number(z),
      Number(x),
      Number(String(y).replace(/\.mvt$/i, '')),
    );
    res.setHeader('Content-Type', 'application/vnd.mapbox-vector-tile');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(tile);
  }

  // --- Spatial search ---
  @Get('spatial/search')
  @Permissions(Permission.GIS_SPATIAL_SEARCH)
  async spatialSearch(@CurrentUser() user: JwtPayload, @Query() query: SpatialSearchQueryDto) {
    const data = await this.spatialSearchService.searchNearby(
      resolveOrgId(user),
      query.lat,
      query.lng,
      query.radiusMeters ?? 500,
    );
    return { success: true, data };
  }

  @Get('spatial/at-point')
  @Permissions(Permission.GIS_SPATIAL_SEARCH)
  async atPoint(
    @CurrentUser() user: JwtPayload,
    @Query('lat') lat: number,
    @Query('lng') lng: number,
  ) {
    const data = await this.spatialSearchService.findAtPoint(resolveOrgId(user), +lat, +lng);
    return { success: true, data };
  }

  @Get('spatial/bbox')
  @Permissions(Permission.GIS_LAYERS_READ)
  async bboxSearch(@CurrentUser() user: JwtPayload, @Query() query: BboxQueryDto) {
    const data = await this.geoJsonService.getLayers(resolveOrgId(user), {
      bbox: [query.minLng, query.minLat, query.maxLng, query.maxLat],
    });
    return { success: true, data };
  }

  // --- Feature popup detail ---
  @Get('features/:type/:id')
  @Permissions(Permission.GIS_LAYERS_READ)
  async featureDetail(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: GisFeatureType,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const data = await this.spatialSearchService.getFeatureDetail(resolveOrgId(user), type, id);
    return { success: true, data };
  }

  // --- File ingest ---
  @Post('ingest')
  @Permissions(Permission.GIS_INGEST)
  @Audited({ action: 'gis.ingest', resource: 'gis_ingest', severity: 'warning' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        targetType: { type: 'string', enum: ['neighborhood', 'fabric', 'layer'] },
        fabricTypeId: { type: 'string' },
        neighborhoodId: { type: 'string' },
        layerId: { type: 'string' },
        layerCode: { type: 'string' },
        layerName: { type: 'string' },
        category: { type: 'string' },
        colorHex: { type: 'string' },
        defaultName: { type: 'string' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  ingest(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Query() query: IngestFileQueryDto,
  ) {
    if (!file) throw new BadRequestException('فایل الزامی است');
    return this.ingestService.ingestFile(resolveOrgId(user), user.sub, file, query);
  }

  @Get('ingest/:uploadId')
  @Permissions(Permission.GIS_INGEST)
  getIngestStatus(
    @CurrentUser() user: JwtPayload,
    @Param('uploadId', ParseUUIDPipe) uploadId: string,
  ) {
    return this.ingestService.getUpload(resolveOrgId(user), uploadId);
  }

  @Get('projects')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  listProjects(
    @CurrentUser() user: JwtPayload,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('programId') programId?: string,
  ) {
    return this.areaProjectsService.findAll(resolveOrgId(user), { targetType, targetId, programId });
  }

  @Get('projects/:id')
  @Permissions(Permission.NEIGHBORHOODS_READ)
  getProject(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.areaProjectsService.findOne(resolveOrgId(user), id);
  }

  @Post('projects')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'project.create', resource: 'area_project' })
  createProject(@CurrentUser() user: JwtPayload, @Body() dto: CreateAreaProjectDto) {
    return this.areaProjectsService.create(resolveOrgId(user), dto);
  }

  @Patch('projects/:id')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'project.update', resource: 'area_project' })
  updateProject(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAreaProjectDto,
  ) {
    return this.areaProjectsService.update(resolveOrgId(user), id, dto);
  }

  @Delete('projects/:id')
  @Permissions(Permission.NEIGHBORHOODS_WRITE)
  @Audited({ action: 'project.delete', resource: 'area_project', severity: 'warning' })
  deleteProject(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.areaProjectsService.remove(resolveOrgId(user), id);
  }
}
