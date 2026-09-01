import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { GoalProgress, toGoalProgress } from './meta-card';

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async upsert(familyId: string, amount: number) {
    return this.prisma.monthlyGoal.upsert({
      where: { familyId },
      create: { familyId, amount: new Prisma.Decimal(amount) },
      update: { amount: new Prisma.Decimal(amount) },
    });
  }

  findByFamily(familyId: string) {
    return this.prisma.monthlyGoal.findUnique({ where: { familyId } });
  }

  async progress(familyId: string, at = new Date()): Promise<GoalProgress | null> {
    const goal = await this.findByFamily(familyId);
    if (!goal) {
      return null;
    }

    const summary = await this.reports.monthSummary(familyId, at);
    return toGoalProgress(summary.balance, Number(goal.amount));
  }
}
