import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { BoidService } from '../boid/boid.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';

type UploadFailure = {
  row: number;
  reason: string;
  payload: Record<string, unknown>;
};

@Injectable()
export class EntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly boidService: BoidService,
  ) {}

  private toDecimal(value: number) {
    return new Prisma.Decimal(value.toFixed(2));
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

  private normalizeBsDate(value: string) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,4})$/);
    if (!match) return trimmed;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const yearRaw = Number(match[3]);
    const year = match[3].length <= 2 ? 2000 + yearRaw : yearRaw;
    return `${day}/${month}/${year}`;
  }

  private validateBusiness(ipo: { minUnits: number; maxUnits: number; pricePerUnit: Prisma.Decimal }, dto: CreateEntryDto | UpdateEntryDto, appliedUnits: number) {
    if (appliedUnits < ipo.minUnits || appliedUnits > ipo.maxUnits) {
      throw new BadRequestException(`Applied units must be between ${ipo.minUnits} and ${ipo.maxUnits}`);
    }

    const expectedDeposit = Number(ipo.pricePerUnit) * appliedUnits;
    return this.toDecimal(expectedDeposit);
  }

  async findByIpo(ipoId: number) {
    return this.prisma.ipoEntry.findMany({
      where: { ipoId },
      orderBy: { id: 'desc' },
    });
  }

  async create(ipoId: number, dto: CreateEntryDto, userId: number) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id: ipoId } });
    if (!ipo) throw new NotFoundException('IPO not found');

    const duplicate = await this.prisma.ipoEntry.findUnique({
      where: {
        ipoId_formNo: {
          ipoId,
          formNo: dto.formNo,
        },
      },
    });

    if (duplicate) {
      throw new ConflictException('Form No already exists for this IPO');
    }

    const depositAmount = this.validateBusiness(ipo, dto, dto.appliedUnits);
    const boidVerification = await this.boidService.verify(dto.boid);

    return this.prisma.ipoEntry.create({
      data: {
        ipoId,
        formNo: dto.formNo,
        dateBs: dto.dateBs,
        boid: dto.boid,
        name: dto.name,
        fatherName: dto.fatherName,
        grandfatherName: dto.grandfatherName,
        citizenshipNo: dto.citizenshipNo,
        bankName: dto.bankName,
        accountNo: dto.accountNo,
        mobileNo: dto.mobileNo,
        appliedUnits: dto.appliedUnits,
        depositAmount,
        remarks: dto.remarks,
        panNo: dto.panNo,
        district: ipo.district,
        createdById: userId,
        updatedById: userId,
        boidVerified: boidVerification.verified,
      },
    });
  }

  async update(entryId: number, dto: UpdateEntryDto, userId: number) {
    const existing = await this.prisma.ipoEntry.findUnique({ where: { id: entryId }, include: { ipo: true } });
    if (!existing) throw new NotFoundException('Entry not found');

    if (dto.formNo && dto.formNo !== existing.formNo) {
      const duplicate = await this.prisma.ipoEntry.findUnique({
        where: {
          ipoId_formNo: {
            ipoId: existing.ipoId,
            formNo: dto.formNo,
          },
        },
      });
      if (duplicate) {
        throw new ConflictException('Form No already exists for this IPO');
      }
    }

    const appliedUnits = dto.appliedUnits ?? existing.appliedUnits;
    const depositAmount = this.validateBusiness(existing.ipo, dto, appliedUnits);

    const boid = dto.boid ?? existing.boid;
    const boidVerification = boid !== existing.boid ? await this.boidService.verify(boid) : null;

    return this.prisma.ipoEntry.update({
      where: { id: entryId },
      data: {
        ...dto,
        appliedUnits,
        depositAmount,
        updatedById: userId,
        boidVerified: boidVerification?.verified ?? existing.boidVerified,
      },
    });
  }

  async bulkUpload(ipoId: number, fileBuffer: Buffer, userId: number) {
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

    const failures: UploadFailure[] = [];
    let successCount = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNumber = i + 2;

      try {
        const appliedUnitsRaw = this.getValueByAliases(row, ['Units Applied', 'Kitta Applied', ' Kitta Applied ']);
        const depositRaw = this.getValueByAliases(row, ['Deposit Amount', ' Deposit Amount ']);
        const panRaw = this.getValueByAliases(row, ['PAN No', 'pan no.', 'Pan No']);

        const dto: CreateEntryDto = {
          formNo: this.getValueByAliases(row, ['Form No', 'FormNo']),
          dateBs: this.normalizeBsDate(this.getValueByAliases(row, ['DATE', 'Date'])),
          boid: this.getValueByAliases(row, ['BOID', 'Boid']),
          name: this.getValueByAliases(row, ['Name']),
          fatherName: this.getValueByAliases(row, ["Father's Name", 'Father Name']),
          grandfatherName: this.getValueByAliases(row, ["Grandfather's/Spouse Name", 'Grandfather/Spouse Name']),
          citizenshipNo: this.getValueByAliases(row, ['Citizenship No', 'CitizenshipNo']),
          bankName: this.getValueByAliases(row, ['Bank Name(FORM)', 'Bank Name']),
          accountNo: this.getValueByAliases(row, ['Account No', 'AccountNo']),
          mobileNo: this.getValueByAliases(row, ['Mobile No', 'MobileNo']),
          appliedUnits: this.parseNumber(appliedUnitsRaw),
          remarks: this.getValueByAliases(row, ['Remarks']),
          panNo: panRaw === '-' ? '' : panRaw,
        };

        if (!dto.formNo || !dto.name || !dto.boid || !dto.mobileNo || Number.isNaN(dto.appliedUnits)) {
          throw new BadRequestException('Required fields are missing or invalid');
        }

        const providedDeposit = this.parseNumber(depositRaw);
        if (!Number.isNaN(providedDeposit)) {
          const expectedDeposit = Number(ipo.pricePerUnit) * dto.appliedUnits;
          if (Number(providedDeposit.toFixed(2)) !== Number(expectedDeposit.toFixed(2))) {
            throw new BadRequestException(
              `Deposit mismatch. Expected ${expectedDeposit.toFixed(2)} for units ${dto.appliedUnits}`,
            );
          }
        }

        await this.create(ipoId, dto, userId);
        successCount += 1;
      } catch (error) {
        failures.push({
          row: rowNumber,
          reason: error instanceof Error ? error.message : 'Unknown error',
          payload: row,
        });
      }
    }

    return {
      successCount,
      failedCount: failures.length,
      failures,
    };
  }

  async exportExcel(ipoId?: number) {
    const rows = await this.prisma.ipoEntry.findMany({
      where: ipoId ? { ipoId } : undefined,
      include: { ipo: true },
      orderBy: [{ ipoId: 'asc' }, { id: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('IPO Entries');

    ws.columns = [
      { header: 'IPO', key: 'ipo', width: 24 },
      { header: 'Form No', key: 'formNo', width: 16 },
      { header: 'DATE', key: 'dateBs', width: 14 },
      { header: 'BOID', key: 'boid', width: 20 },
      { header: 'Name', key: 'name', width: 24 },
      { header: "Father's Name", key: 'fatherName', width: 24 },
      { header: "Grandfather's/Spouse Name", key: 'grandfatherName', width: 24 },
      { header: 'Citizenship No', key: 'citizenshipNo', width: 18 },
      { header: 'Bank Name(FORM)', key: 'bankName', width: 24 },
      { header: 'Account No', key: 'accountNo', width: 20 },
      { header: 'Mobile No', key: 'mobileNo', width: 16 },
      { header: 'Units Applied', key: 'appliedUnits', width: 14 },
      { header: 'Deposit Amount', key: 'depositAmount', width: 16 },
      { header: 'Remarks', key: 'remarks', width: 22 },
      { header: 'PAN No', key: 'panNo', width: 16 },
      { header: 'District', key: 'district', width: 18 },
    ];

    rows.forEach((item) => {
      ws.addRow({
        ipo: item.ipo.companyCode,
        formNo: item.formNo,
        dateBs: item.dateBs,
        boid: item.boid,
        name: item.name,
        fatherName: item.fatherName,
        grandfatherName: item.grandfatherName,
        citizenshipNo: item.citizenshipNo,
        bankName: item.bankName,
        accountNo: item.accountNo,
        mobileNo: item.mobileNo,
        appliedUnits: item.appliedUnits,
        depositAmount: Number(item.depositAmount),
        remarks: item.remarks || '',
        panNo: item.panNo || '',
        district: item.district,
      });
    });

    return workbook.xlsx.writeBuffer();
  }
}
