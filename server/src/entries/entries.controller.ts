import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { EntriesService } from './entries.service';

@Controller('entries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.STAFF)
export class EntriesController {
  constructor(private readonly entriesService: EntriesService) {}

  @Get('ipo/:ipoId')
  listByIpo(@Param('ipoId', ParseIntPipe) ipoId: number) {
    return this.entriesService.findByIpo(ipoId);
  }

  @Post('ipo/:ipoId')
  create(
    @Param('ipoId', ParseIntPipe) ipoId: number,
    @Body() dto: CreateEntryDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.entriesService.create(ipoId, dto, userId);
  }

  @Patch(':entryId')
  update(
    @Param('entryId', ParseIntPipe) entryId: number,
    @Body() dto: UpdateEntryDto,
    @CurrentUser('userId') userId: number,
  ) {
    return this.entriesService.update(entryId, dto, userId);
  }

  @Post('ipo/:ipoId/upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('ipoId', ParseIntPipe) ipoId: number,
    @UploadedFile() file: { buffer: Buffer },
    @CurrentUser('userId') userId: number,
  ) {
    return this.entriesService.bulkUpload(ipoId, file.buffer, userId);
  }

  @Get('export')
  async export(
    @Query('ipoId') ipoId: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.entriesService.exportExcel(ipoId ? Number(ipoId) : undefined);
    const fileName = ipoId ? `ipo-entries-${ipoId}.xlsx` : 'ipo-entries-all.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(data));
  }
}
