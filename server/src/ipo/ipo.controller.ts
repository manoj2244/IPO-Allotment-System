import { Body, Controller, Get, Param, ParseBoolPipe, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IpoService } from './ipo.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CreateIpoDto } from './dto/create-ipo.dto';
import { UpdateIpoDto } from './dto/update-ipo.dto';

@Controller('ipos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IpoController {
  constructor(private readonly ipoService: IpoService) {}

  @Get('active')
  @Roles(Role.ADMIN, Role.STAFF)
  findActive() {
    return this.ipoService.findActive();
  }

  @Get()
  @Roles(Role.ADMIN)
  findAll(@Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive?: boolean) {
    return this.ipoService.findAll(includeInactive ?? true);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateIpoDto) {
    return this.ipoService.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateIpoDto) {
    return this.ipoService.update(id, dto);
  }
}
