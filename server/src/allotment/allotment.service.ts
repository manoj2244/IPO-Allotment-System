import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

type MatchStatus = 'MATCHED_BOID' | 'MATCHED_NAME' | 'AMBIGUOUS' | 'UNMATCHED' | 'BOID_MISMATCH' | 'INVALID';

type UploadFailure = {
  row: number;
  reason: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class AllotmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async clearForReupload(ipoId: number) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    await this.prisma.$transaction([
      this.prisma.allotment.deleteMany({ where: { ipoId } }),
      this.prisma.ipoEntry.updateMany({
        where: { ipoId },
        data: {
          allottedUnits: 0,
          refundUnits: 0,
          refundAmount: new Prisma.Decimal(0),
          entryStatus: 'PENDING',
        },
      }),
    ]);

    return { message: 'Allotment data cleared. You can re-upload now.' };
  }

  private normalizeKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private getValueByAliases(row: Record<string, unknown>, aliases: string[]) {
    const normalizedRow = new Map<string, unknown>();
    Object.entries(row).forEach(([key, value]) => {
      normalizedRow.set(this.normalizeKey(key), value);
    });

    for (const alias of aliases) {
      const found = normalizedRow.get(this.normalizeKey(alias));
      if (found !== undefined && found !== null) {
        return String(found).trim();
      }
    }

    return '';
  }

  private parseNumber(value: string) {
    const sanitized = value.replace(/,/g, '').trim();
    if (!sanitized) return NaN;
    return Number(sanitized);
  }

  private normalizeName(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeBoid(value: string) {
    return value.replace(/\D/g, '');
  }

  private isValidBoid(boid: string) {
    return /^\d{16}$/.test(boid);
  }

  async uploadAllotment(ipoId: number, fileBuffer: Buffer, strictAppliedMatch = false) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    const existingForIpo = await this.prisma.allotment.count({ where: { ipoId } });
    if (existingForIpo > 0) {
      throw new BadRequestException('Allotment already uploaded for this IPO. Clear existing data before re-upload.');
    }

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

    const ipoEntries = await this.prisma.ipoEntry.findMany({
      where: { ipoId },
      orderBy: { id: 'asc' },
    });

    const entriesByBoid = new Map<string, typeof ipoEntries>();
    const entriesByName = new Map<string, typeof ipoEntries>();

    for (const entry of ipoEntries) {
      const boidKey = this.normalizeBoid(entry.boid);
      const nameKey = this.normalizeName(entry.name);

      if (boidKey) {
        const existing = entriesByBoid.get(boidKey) || [];
        existing.push(entry);
        entriesByBoid.set(boidKey, existing);
      }

      const existingByName = entriesByName.get(nameKey) || [];
      existingByName.push(entry);
      entriesByName.set(nameKey, existingByName);
    }

    const uploadBatch = `${ipoId}-${Date.now()}`;
    const failures: UploadFailure[] = [];
    let matchedByBoid = 0;
    let matchedByName = 0;
    let ambiguous = 0;
    let unmatched = 0;
    let boidMismatch = 0;
    let invalidCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const fullName = this.getValueByAliases(row, ['fullName', 'Name']);
        const boidRaw = this.getValueByAliases(row, ['BOID', 'boid']);
        const boidNormalized = this.normalizeBoid(boidRaw);
        const nameNormalized = this.normalizeName(fullName);
        const appliedQty = this.parseNumber(this.getValueByAliases(row, ['appliedQty', 'applied_units', 'Applied Units']));
        const allottedQty = this.parseNumber(this.getValueByAliases(row, ['allottedQty', 'allotted_units', 'Allotted Units']));
        const companyCode = this.getValueByAliases(row, ['CompanyCode', 'company_code', 'companyCode']);

        if (!fullName || Number.isNaN(appliedQty) || Number.isNaN(allottedQty)) {
          throw new BadRequestException('Required fields missing: fullName, appliedQty, allottedQty');
        }

        if (companyCode && companyCode !== ipo.companyCode) {
          // Non-blocking: selected IPO controls processing target.
          // Keep row processable even when incoming file company code differs.
        }

        if (boidRaw && !this.isValidBoid(boidNormalized)) {
          throw new BadRequestException('BOID must be 16 digits when provided');
        }

        if (allottedQty > appliedQty) {
          throw new BadRequestException('allottedQty cannot be greater than appliedQty');
        }

        let matchStatus: MatchStatus = 'UNMATCHED';
        let matchNote: string | null = null;
        let matchedEntryId: number | null = null;
        let matchedEntry: (typeof ipoEntries)[number] | null = null;

        const matchedByBoidCandidates = boidRaw ? entriesByBoid.get(boidNormalized) || [] : [];
        const matchedByNameCandidates = entriesByName.get(nameNormalized) || [];

        if (matchedByBoidCandidates.length === 1) {
          matchStatus = 'MATCHED_BOID';
          matchedEntry = matchedByBoidCandidates[0];
          matchedEntryId = matchedEntry.id;
        } else if (matchedByBoidCandidates.length > 1) {
          matchStatus = 'AMBIGUOUS';
          matchNote = 'Multiple IPO entries found for same BOID';
        } else if (!boidRaw) {
          if (matchedByNameCandidates.length === 1) {
            matchStatus = 'MATCHED_NAME';
            matchedEntry = matchedByNameCandidates[0];
            matchedEntryId = matchedEntry.id;
          } else if (matchedByNameCandidates.length > 1) {
            matchStatus = 'AMBIGUOUS';
            matchNote = 'Multiple entries with same full name';
          } else {
            matchStatus = 'UNMATCHED';
            matchNote = 'No IPO entry found';
          }
        } else {
          if (matchedByNameCandidates.length === 1) {
            matchStatus = 'MATCHED_NAME';
            matchedEntry = matchedByNameCandidates[0];
            matchedEntryId = matchedEntry.id;
            matchNote = `BOID not found in entries; matched by name with entry BOID ${matchedByNameCandidates[0].boid}`;
          } else if (matchedByNameCandidates.length > 1) {
            matchStatus = 'AMBIGUOUS';
            matchNote = 'BOID not found and full name has multiple matches';
          } else {
            matchStatus = 'UNMATCHED';
            matchNote = 'No IPO entry found for BOID/full name';
          }
        }

        const created = await this.prisma.allotment.create({
          data: {
            ipoId,
            fullName,
            boid: boidNormalized || null,
            appliedQty,
            allottedQty,
            companyCode: companyCode || ipo.companyCode,
            matchStatus,
            matchNote,
            matchedEntryId,
            uploadBatch,
          },
        });

        if (matchStatus === 'MATCHED_BOID' || matchStatus === 'MATCHED_NAME') {
          if (!matchedEntry) {
            throw new BadRequestException('Matched entry not found');
          }

          if (strictAppliedMatch && matchedEntry.appliedUnits !== appliedQty) {
            await this.prisma.allotment.update({
              where: { id: created.id },
              data: {
                matchStatus: 'INVALID',
                matchNote: `appliedQty mismatch with entry. entry=${matchedEntry.appliedUnits}, file=${appliedQty}`,
              },
            });
            invalidCount += 1;
            continue;
          }

          const effectiveApplied = strictAppliedMatch ? appliedQty : matchedEntry.appliedUnits;
          const refundUnits = effectiveApplied - allottedQty;
          if (refundUnits < 0) {
            await this.prisma.allotment.update({
              where: { id: created.id },
              data: {
                matchStatus: 'INVALID',
                matchNote: 'Negative refund units detected',
              },
            });
            invalidCount += 1;
            continue;
          }

          const refundAmount = Number(ipo.pricePerUnit) * refundUnits;

          await this.prisma.ipoEntry.update({
            where: { id: matchedEntry.id },
            data: {
              allottedUnits: allottedQty,
              refundUnits,
              refundAmount: new Prisma.Decimal(refundAmount.toFixed(2)),
              entryStatus: allottedQty > 0 ? 'ALLOTTED' : 'NOT_ALLOTTED',
            },
          });

          if (matchStatus === 'MATCHED_BOID') matchedByBoid += 1;
          if (matchStatus === 'MATCHED_NAME') matchedByName += 1;
        } else if (matchStatus === 'AMBIGUOUS') {
          ambiguous += 1;
        } else if (matchStatus === 'UNMATCHED') {
          unmatched += 1;
        }
      } catch (error) {
        failures.push({
          row: rowNumber,
          reason: error instanceof Error ? error.message : 'Unknown error',
          payload: row,
        });
      }
    }

    return {
      message: 'Allotment uploaded',
      totalRows: rows.length,
      failedCount: failures.length,
      failures,
      matchedByBoid,
      matchedByName,
      ambiguous,
      unmatched,
      boidMismatch,
      invalidCount,
      uploadBatch,
    };
  }

  async refundReport(ipoId: number) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    return this.prisma.ipoEntry.findMany({
      where: { ipoId },
      orderBy: { id: 'asc' },
      select: {
        name: true,
        boid: true,
        bankName: true,
        accountNo: true,
        appliedUnits: true,
        allottedUnits: true,
        refundUnits: true,
        refundAmount: true,
        entryStatus: true,
      },
    });
  }

  async reportByType(
    ipoId: number,
    type: 'refund' | 'allotted' | 'not-allotted' | 'unmatched',
  ) {
    if (type === 'unmatched') {
      return this.prisma.allotment.findMany({
        where: { ipoId, matchStatus: { in: ['UNMATCHED', 'AMBIGUOUS', 'BOID_MISMATCH', 'INVALID'] } },
        orderBy: { id: 'asc' },
      });
    }

    const whereByType: Record<'refund' | 'allotted' | 'not-allotted', Prisma.IpoEntryWhereInput> = {
      refund: { ipoId, refundAmount: { gt: 0 }, entryStatus: { in: ['ALLOTTED', 'NOT_ALLOTTED'] } },
      allotted: { ipoId, allottedUnits: { gt: 0 }, entryStatus: 'ALLOTTED' },
      'not-allotted': { ipoId, allottedUnits: 0, entryStatus: 'NOT_ALLOTTED' },
    };

    return this.prisma.ipoEntry.findMany({
      where: whereByType[type],
      orderBy: { id: 'asc' },
    });
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

    const entries = await this.prisma.ipoEntry.findMany({ where: { ipoId, allottedUnits: { gt: 0 } } });

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
              <li><strong>Allotted Units:</strong> ${entry.allottedUnits}</li>
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
