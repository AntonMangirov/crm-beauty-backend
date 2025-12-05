import prisma from '../prismaClient';

export class AnalyticsService {
  async getAnalytics(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setUTCHours(0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setUTCHours(23, 59, 59, 999);

    const [
      appointmentsCountResult,
      revenueResult,
      topServicesResult,
      newClientsStatsResult,
    ] = await Promise.all([
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::int as count
        FROM "Appointment"
        WHERE "masterId" = ${userId}
          AND "startAt" >= ${startOfMonth}
          AND "startAt" <= ${endOfMonth}
      `,
      prisma.$queryRaw<Array<{ revenue: number | null }>>`
        SELECT COALESCE(SUM("price"), 0)::decimal as revenue
        FROM "Appointment"
        WHERE "masterId" = ${userId}
          AND "status" = 'COMPLETED'
          AND "startAt" >= ${startOfMonth}
          AND "startAt" <= ${endOfMonth}
      `,
      prisma.$queryRaw<Array<{ id: string; name: string; count: bigint }>>`
        SELECT
          s."id",
          s."name",
          COUNT(a."id")::int as count
        FROM "Service" s
        INNER JOIN "Appointment" a ON s."id" = a."serviceId"
        WHERE s."masterId" = ${userId}
          AND s."isActive" = true
          AND a."masterId" = ${userId}
          AND a."startAt" >= ${startOfMonth}
          AND a."startAt" <= ${endOfMonth}
        GROUP BY s."id", s."name"
        ORDER BY count DESC, s."name" ASC
        LIMIT 5
      `,
      prisma.$queryRaw<Array<{ new_clients: bigint; total_clients: bigint }>>`
        SELECT
          COUNT(CASE WHEN "createdAt" >= ${startOfMonth} AND "createdAt" <= ${endOfMonth} THEN 1 END)::int as new_clients,
          COUNT(*)::int as total_clients
        FROM "Client"
        WHERE "masterId" = ${userId}
          AND "isActive" = true
      `,
    ]);

    const appointmentsCount = appointmentsCountResult[0]?.count ?? BigInt(0);
    const revenueRaw = revenueResult[0]?.revenue ?? 0;
    const newClients = newClientsStatsResult[0]?.new_clients ?? BigInt(0);
    const totalClients = newClientsStatsResult[0]?.total_clients ?? BigInt(0);

    const revenue =
      typeof revenueRaw === 'string'
        ? parseFloat(revenueRaw)
        : typeof revenueRaw === 'bigint'
          ? Number(revenueRaw)
          : Number(revenueRaw) || 0;

    const totalClientsNum = Number(totalClients);
    const newClientsNum = Number(newClients);
    const newClientsPercentage =
      totalClientsNum > 0 ? (newClientsNum * 100) / totalClientsNum : 0;

    const topServices = topServicesResult.map(service => ({
      id: service.id,
      name: service.name,
      count: Number(service.count),
    }));

    return {
      appointmentsCount: Number(appointmentsCount),
      revenue: Number(revenue),
      topServices,
      newClientsPercentage,
    };
  }
}
