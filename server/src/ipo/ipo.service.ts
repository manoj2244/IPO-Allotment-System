import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIpoDto } from './dto/create-ipo.dto';
import { UpdateIpoDto } from './dto/update-ipo.dto';

@Injectable()
export class IpoService {
  constructor(private readonly prisma: PrismaService) {}

  private validateRanges(minUnits: number, maxUnits: number) {
    if (minUnits > maxUnits) {
      throw new BadRequestException('Min Units must be less than or equal to Max Units');
    }
  }

  async create(dto: CreateIpoDto) {
    this.validateRanges(dto.minUnits, dto.maxUnits);

    const existing = await this.prisma.ipoMaster.findUnique({ where: { companyCode: dto.companyCode } });
    if (existing) {
      throw new ConflictException('Company code must be unique');
    }

    return this.prisma.ipoMaster.create({ data: dto });
  }

  findAll(includeInactive = true) {
    return this.prisma.ipoMaster.findMany({
      where: includeInactive ? undefined : { status: 'ACTIVE' },
      orderBy: { id: 'desc' },
    });
  }

  findActive() {
    return this.findAll(false);
  }

  async update(id: number, dto: UpdateIpoDto) {
    const ipo = await this.prisma.ipoMaster.findUnique({ where: { id } });
    if (!ipo) {
      throw new NotFoundException('IPO not found');
    }

    this.validateRanges(dto.minUnits ?? ipo.minUnits, dto.maxUnits ?? ipo.maxUnits);

    if (dto.companyCode && dto.companyCode !== ipo.companyCode) {
      const duplicate = await this.prisma.ipoMaster.findUnique({ where: { companyCode: dto.companyCode } });
      if (duplicate) {
        throw new ConflictException('Company code must be unique');
      }
    }

    return this.prisma.ipoMaster.update({
      where: { id },
      data: dto,
    });
  }
}
