import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AllotmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async uploadAllotment(ipoId: number, fileBuffer: Buffer) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new BadRequestException('Invalid Excel format');
    }

    const firstSheet = workbook.SheetNames[0];
    if (!firstSheet) throw new BadRequestException('Excel file has no sheet');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
      defval: '',
      raw: false,
    });

    let matchedByBoid = 0;
    let matchedByName = 0;

    for (const row of rows) {
      const boid = String(row['BOID'] ?? '').trim();
      const name = String(row['Name'] ?? '').trim();
      const allottedUnits = Number(row['Allotted Units'] ?? 0);
      if (!name || Number.isNaN(allottedUnits)) continue;

      await this.prisma.allotment.create({
        data: {
          ipoId,
          boid: boid || null,
          name,
          allottedUnits,
        },
      });

      const matchedEntryByBoid = boid
        ? await this.prisma.ipoEntry.findFirst({ where: { ipoId, boid } })
        : null;

      if (matchedEntryByBoid) {
        matchedByBoid += 1;
        continue;
      }

      const matchedEntryByName = await this.prisma.ipoEntry.findFirst({
        where: { ipoId, name },
      });

      if (matchedEntryByName) {
        matchedByName += 1;
      }
    }

    return {
      message: 'Allotment uploaded',
      totalRows: rows.length,
      matchedByBoid,
      matchedByName,
    };
  }

  async refundReport(ipoId: number) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    const entries = await this.prisma.ipoEntry.findMany({ where: { ipoId } });
    const allotments = await this.prisma.allotment.findMany({ where: { ipoId } });

    const result = entries.map((entry) => {
      const byBoid = allotments.find((a) => !!a.boid && a.boid === entry.boid);
      const byName = allotments.find(
        (a) => a.name.trim().toLowerCase() === entry.name.trim().toLowerCase(),
      );

      const allotment = byBoid ?? byName;
      const allottedUnits = allotment?.allottedUnits ?? 0;
      const refundUnits = entry.appliedUnits - allottedUnits;
      const refundAmount = Number(ipo.pricePerUnit) * refundUnits;

      return {
        applicantName: entry.name,
        boid: entry.boid,
        bankName: entry.bankName,
        accountNumber: entry.accountNo,
        appliedUnits: entry.appliedUnits,
        allottedUnits,
        refundUnits,
        refundAmount,
      };
    });

    return result;
  }

  async refundReportExcel(ipoId: number) {
    const rows = await this.refundReport(ipoId);

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Refund Report');
    ws.columns = [
      { header: 'Applicant Name', key: 'applicantName', width: 25 },
      { header: 'BOID', key: 'boid', width: 18 },
      { header: 'Bank Name', key: 'bankName', width: 20 },
      { header: 'Account Number', key: 'accountNumber', width: 18 },
      { header: 'Applied Units', key: 'appliedUnits', width: 14 },
      { header: 'Allotted Units', key: 'allottedUnits', width: 14 },
      { header: 'Refund Units', key: 'refundUnits', width: 14 },
      { header: 'Refund Amount', key: 'refundAmount', width: 16 },
    ];

    rows.forEach((r) => ws.addRow(r));

    return workbook.xlsx.writeBuffer();
  }

  async sendAllotmentEmails(ipoId: number) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    const entries = await this.prisma.ipoEntry.findMany({ where: { ipoId } });
    const allotments = await this.prisma.allotment.findMany({ where: { ipoId } });

    const host = this.configService.get<string>('SMTP_HOST');
    const port = Number(this.configService.get<string>('SMTP_PORT') || 587);
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('MAIL_FROM') || 'noreply@example.com';
    const logoUrl =
      this.configService.get<string>('COMPANY_LOGO_URL') ||
      'https://www.prabhucapital.com.np/wp-content/uploads/2020/09/logo.png';

    if (!host || !user || !pass) {
      throw new BadRequestException('SMTP config missing');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    let sent = 0;

    for (const entry of entries) {
      const allotment =
        allotments.find((a) => !!a.boid && a.boid === entry.boid) ||
        allotments.find((a) => a.name.trim().toLowerCase() === entry.name.trim().toLowerCase());

      if (!allotment || allotment.allottedUnits <= 0) continue;
      if (!entry.panNo || !entry.panNo.includes('@')) continue;

      await transporter.sendMail({
        from,
        to: entry.panNo,
        subject: `IPO Allotment Notice - ${ipo.companyName}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height:1.5">
            <img src="${logoUrl}" alt="Prabhu Capital Limited" style="height:56px; margin-bottom: 12px;" />
            <h3 style="margin:0 0 10px;"><strong>🎉 Congratulations!</strong></h3>
            <p>Dear ${entry.name},</p>
            <p>Your IPO allotment details are below:</p>
            <ul>
              <li><strong>Company:</strong> ${ipo.companyName}</li>
              <li><strong>Applied Units:</strong> ${entry.appliedUnits}</li>
              <li><strong>Allotted Units:</strong> ${allotment.allottedUnits}</li>
            </ul>
            <p>Thank you.</p>
          </div>
        `,
      });

      sent += 1;
    }

    return { sent };
  }
}
