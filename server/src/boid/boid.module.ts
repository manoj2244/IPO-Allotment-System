import { Module } from '@nestjs/common';
import { BoidService } from './boid.service';
import { BoidController } from './boid.controller';

@Module({
  providers: [BoidService],
  controllers: [BoidController],
  exports: [BoidService],
})
export class BoidModule {}
