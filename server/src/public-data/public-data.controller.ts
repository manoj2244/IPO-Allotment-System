import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { PublicDataService } from './public-data.service';
import { BoidService } from '../boid/boid.service';

@Controller('public-data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class PublicDataController {
  constructor(
    private readonly publicDataService: PublicDataService,
    private readonly boidService: BoidService,
  ) {}

  @Get('banks')
  getBanks() {
    return this.publicDataService.getBanks();
  }

  @Get('addresses')
  getAddresses() {
    return this.publicDataService.getAddresses();
  }

  @Get('capitals')
  getCapitals() {
    return this.boidService.getCapitalList();
  }
}
