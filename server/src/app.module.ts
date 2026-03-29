import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IpoModule } from './ipo/ipo.module';
import { EntriesModule } from './entries/entries.module';
import { BoidModule } from './boid/boid.module';
import { AllotmentModule } from './allotment/allotment.module';
import { PublicDataModule } from './public-data/public-data.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    IpoModule,
    EntriesModule,
    BoidModule,
    AllotmentModule,
    PublicDataModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
