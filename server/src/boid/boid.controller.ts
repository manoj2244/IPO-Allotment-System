import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { BoidService } from './boid.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('boid')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class BoidController {
  constructor(private readonly boidService: BoidService) {}

  @Get('verify/:boid')
  verify(@Param('boid') boid: string) {
    return this.boidService.verify(boid);
  }
}
