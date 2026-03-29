import {
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AllotmentService } from './allotment.service';

@Controller('allotments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AllotmentController {
  constructor(private readonly allotmentService: AllotmentService) {}

  @Post('ipo/:ipoId/upload')
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('ipoId', ParseIntPipe) ipoId: number,
    @Query('strictAppliedMatch', new ParseBoolPipe({ optional: true })) strictAppliedMatch: boolean | undefined,
    @UploadedFile() file: { buffer: Buffer },
  ) {
    return this.allotmentService.uploadAllotment(ipoId, file.buffer, strictAppliedMatch ?? false);
  }

  @Delete('ipo/:ipoId/clear')
  @Roles(Role.ADMIN)
  clearForReupload(@Param('ipoId', ParseIntPipe) ipoId: number) {
    return this.allotmentService.clearForReupload(ipoId);
  }

  @Get('ipo/:ipoId/report/:type')
  @Roles(Role.ADMIN, Role.STAFF)
  report(
    @Param('ipoId', ParseIntPipe) ipoId: number,
    @Param('type') type: 'refund' | 'allotted' | 'not-allotted' | 'unmatched',
  ) {
    return this.allotmentService.reportByType(ipoId, type);
  }

  @Get('ipo/:ipoId/report/:type/export')
  @Roles(Role.ADMIN, Role.STAFF)
  async reportExport(
    @Param('ipoId', ParseIntPipe) ipoId: number,
    @Param('type') type: 'refund' | 'allotted' | 'not-allotted' | 'unmatched',
    @Res() res: Response,
  ) {
    const data = await this.allotmentService.reportByTypeExcel(ipoId, type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-report-${ipoId}.xlsx`);
    res.send(Buffer.from(data));
  }

  @Get('ipo/:ipoId/refund-report')
  @Roles(Role.ADMIN, Role.STAFF)
  refundReport(@Param('ipoId', ParseIntPipe) ipoId: number) {
    return this.allotmentService.refundReport(ipoId);
  }

  @Get('ipo/:ipoId/refund-report/export')
  @Roles(Role.ADMIN, Role.STAFF)
  async refundReportExport(@Param('ipoId', ParseIntPipe) ipoId: number, @Res() res: Response) {
    const data = await this.allotmentService.refundReportExcel(ipoId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=refund-report-${ipoId}.xlsx`);
    res.send(Buffer.from(data));
  }

  @Post('ipo/:ipoId/send-emails')
  @Roles(Role.ADMIN)
  sendEmails(@Param('ipoId', ParseIntPipe) ipoId: number) {
    return this.allotmentService.sendAllotmentEmails(ipoId);
  }
}
