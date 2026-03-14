import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt, inArray } from "drizzle-orm";
import { db, linksTable, campaignsTable, clicksTable } from "@workspace/db";
import {
  GetClicksOverTimeQueryParams,
  GetTopLinksQueryParams,
  GetAnalyticsSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function buildDateRange(days?: number | null, startDate?: string | null, endDate?: string | null): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  if (startDate) {
    return { start: new Date(startDate), end };
  }
  const d = days ?? 30;
  const start = new Date(end.getTime() - d * 24 * 60 * 60 * 1000);
  return { start, end };
}

router.get("/analytics/summary", async (req, res): Promise<void> => {
  const params = GetAnalyticsSummaryQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { days, startDate, endDate } = params.data;
  const { start: periodStart, end: periodEnd } = buildDateRange(days, startDate, endDate);
  const periodLength = periodEnd.getTime() - periodStart.getTime();
  const prevPeriodEnd = new Date(periodStart.getTime());
  const prevPeriodStart = new Date(periodStart.getTime() - periodLength);

  const [linkCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(linksTable);
  const [campaignCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable);
  const [totalClicksRow] = await db.select({ total: sql<number>`coalesce(sum(click_count), 0)::int` }).from(linksTable);

  // Unique clicks total (distinct visitor_id across all links)
  const [uniqueClicksRow] = await db
    .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
    .from(clicksTable);

  // Unique clicks this period
  const [uniqueThisPeriodRow] = await db
    .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
    .from(clicksTable)
    .where(and(gte(clicksTable.clickedAt, periodStart), lt(clicksTable.clickedAt, periodEnd)));

  // Unique clicks previous period
  const [uniquePrevPeriodRow] = await db
    .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
    .from(clicksTable)
    .where(and(gte(clicksTable.clickedAt, prevPeriodStart), lt(clicksTable.clickedAt, prevPeriodEnd)));

  // All clicks this period (for comparison bar chart)
  const [clicksThisPeriodRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(and(gte(clicksTable.clickedAt, periodStart), lt(clicksTable.clickedAt, periodEnd)));

  // All clicks prev period
  const [clicksPrevPeriodRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(and(gte(clicksTable.clickedAt, prevPeriodStart), lt(clicksTable.clickedAt, prevPeriodEnd)));

  // Top campaign by click count
  const allCampaigns = await db.select().from(campaignsTable);
  let topCampaign: string | null = null;
  if (allCampaigns.length > 0) {
    const campaignClicks = await Promise.all(
      allCampaigns.map(async (c) => {
        const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, c.id));
        const total = links.reduce((sum, l) => sum + l.clickCount, 0);
        return { name: c.name, clicks: total };
      })
    );
    const sorted = campaignClicks.sort((a, b) => b.clicks - a.clicks);
    topCampaign = sorted[0]?.clicks > 0 ? sorted[0].name : null;
  }

  res.json({
    totalLinks: linkCountRow?.count ?? 0,
    totalClicks: totalClicksRow?.total ?? 0,
    uniqueClicks: uniqueClicksRow?.count ?? 0,
    totalCampaigns: campaignCountRow?.count ?? 0,
    clicksThisMonth: clicksThisPeriodRow?.count ?? 0,
    clicksLastMonth: clicksPrevPeriodRow?.count ?? 0,
    uniqueClicksThisPeriod: uniqueThisPeriodRow?.count ?? 0,
    uniqueClicksLastPeriod: uniquePrevPeriodRow?.count ?? 0,
    topCampaign,
  });
});

router.get("/analytics/clicks", async (req, res): Promise<void> => {
  const params = GetClicksOverTimeQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { days, startDate, endDate } = params.data as any;
  const { start, end } = buildDateRange(days, startDate, endDate);

  const dateFilter = and(gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end));

  if (params.data.linkId) {
    const results = await db
      .select({
        date: sql<string>`date_trunc('day', ${clicksTable.clickedAt})::date::text`,
        clicks: sql<number>`count(distinct ${clicksTable.visitorId})::int`,
      })
      .from(clicksTable)
      .where(and(dateFilter, eq(clicksTable.linkId, params.data.linkId)))
      .groupBy(sql`date_trunc('day', ${clicksTable.clickedAt})`)
      .orderBy(sql`date_trunc('day', ${clicksTable.clickedAt})`);
    res.json(results);
    return;
  }

  if (params.data.campaignId) {
    const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, params.data.campaignId));
    const linkIds = links.map((l) => l.id);

    if (linkIds.length === 0) {
      res.json([]);
      return;
    }

    const results = await db
      .select({
        date: sql<string>`date_trunc('day', ${clicksTable.clickedAt})::date::text`,
        clicks: sql<number>`count(distinct ${clicksTable.visitorId})::int`,
      })
      .from(clicksTable)
      .where(and(dateFilter, inArray(clicksTable.linkId, linkIds)))
      .groupBy(sql`date_trunc('day', ${clicksTable.clickedAt})`)
      .orderBy(sql`date_trunc('day', ${clicksTable.clickedAt})`);

    res.json(results);
    return;
  }

  const results = await db
    .select({
      date: sql<string>`date_trunc('day', ${clicksTable.clickedAt})::date::text`,
      clicks: sql<number>`count(distinct ${clicksTable.visitorId})::int`,
    })
    .from(clicksTable)
    .where(dateFilter)
    .groupBy(sql`date_trunc('day', ${clicksTable.clickedAt})`)
    .orderBy(sql`date_trunc('day', ${clicksTable.clickedAt})`);

  res.json(results);
});

router.get("/analytics/top-links", async (req, res): Promise<void> => {
  const params = GetTopLinksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const limit = params.data.limit ?? 10;
  const links = await db
    .select()
    .from(linksTable)
    .orderBy(sql`${linksTable.clickCount} desc`)
    .limit(limit);

  const enriched = await Promise.all(
    links.map(async (l) => {
      let campaignName: string | null = null;
      if (l.campaignId) {
        const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, l.campaignId));
        campaignName = c?.name ?? null;
      }
      return {
        id: l.id,
        title: l.title,
        slug: l.slug,
        destinationUrl: l.destinationUrl,
        clickCount: l.clickCount,
        campaignName,
      };
    })
  );

  res.json(enriched);
});

export default router;
