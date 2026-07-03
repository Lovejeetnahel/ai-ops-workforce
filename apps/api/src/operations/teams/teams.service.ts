import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** Teams/crews — group staff for assignment, calendars, and reporting. */
@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.db.team.create({ data: { name } as any });
  }

  list() {
    return this.prisma.db.team.findMany({
      orderBy: { name: 'asc' },
      include: { members: { select: { id: true, name: true, role: true } } },
    });
  }

  rename(id: string, name: string) {
    return this.prisma.db.team.update({ where: { id }, data: { name } });
  }

  /** Assign staff to a team (sets each user's teamId). */
  async setMembers(teamId: string, userIds: string[]) {
    await this.prisma.db.user.updateMany({ where: { id: { in: userIds } }, data: { teamId } });
    return this.prisma.db.team.findUniqueOrThrow({
      where: { id: teamId },
      include: { members: { select: { id: true, name: true } } },
    });
  }
}
