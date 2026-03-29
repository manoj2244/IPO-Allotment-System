import { Module } from '@nestjs/common';
import { BoidModule } from '../boid/boid.module';
import { PublicDataController } from './public-data.controller';
import { PublicDataService } from './public-data.service';

@Module({
  imports: [BoidModule],
  controllers: [PublicDataController],
  providers: [PublicDataService],
  exports: [PublicDataService],
})
export class PublicDataModule {}
