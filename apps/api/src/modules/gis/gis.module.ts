import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GisController } from './gis.controller';
import { FabricType } from './entities/fabric-type.entity';
import { Fabric } from './entities/fabric.entity';
import { Neighborhood } from './entities/neighborhood.entity';
import { RegenerationProgram } from './entities/regeneration-program.entity';
import { Dwelling } from '../case/entities/dwelling.entity';
import { SpatialUpload } from './entities/spatial-upload.entity';
import { FabricTypesService } from './services/fabric-types.service';
import { NeighborhoodsService } from './services/neighborhoods.service';
import { FabricsService } from './services/fabrics.service';
import { DwellingsService } from './services/dwellings.service';
import { GeoJsonService } from './services/geojson.service';
import { SpatialSearchService } from './services/spatial-search.service';
import { IngestService } from './services/ingest.service';
import { GeometryService } from './services/geometry.service';
import { ProgramContextService } from './services/program-context.service';
import { SpatialFileParserService } from './parsers/spatial-file-parser.service';
import { AreaProject } from './entities/area-project.entity';
import { AreaProjectsService } from './services/area-projects.service';
import { GisLayer, LayerVersion, LayerFeature } from './entities/gis-layer.entity';
import { UrbanLayersService } from './services/urban-layers.service';
import { RegenerationProgramsService } from './services/regeneration-programs.service';
import { AuditModule } from '../audit/audit.module';
import { CaseModule } from '../case/case.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FabricType,
      Fabric,
      Neighborhood,
      RegenerationProgram,
      Dwelling,
      SpatialUpload,
      AreaProject,
      GisLayer,
      LayerVersion,
      LayerFeature,
    ]),
    AuditModule,
    CaseModule,
  ],
  controllers: [GisController],
  providers: [
    FabricTypesService,
    NeighborhoodsService,
    FabricsService,
    DwellingsService,
    GeoJsonService,
    MvtService,
    SpatialSearchService,
    IngestService,
    GeometryService,
    ProgramContextService,
    SpatialFileParserService,
    AreaProjectsService,
    UrbanLayersService,
    RegenerationProgramsService,
  ],
  exports: [
    GeoJsonService,
    MvtService,
    NeighborhoodsService,
    FabricsService,
    DwellingsService,
    AreaProjectsService,
    UrbanLayersService,
    RegenerationProgramsService,
  ],
})
export class GisModule {}
