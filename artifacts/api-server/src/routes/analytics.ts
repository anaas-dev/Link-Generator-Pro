import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { db, linksTable, campaignsTable, clicksTable } from "@workspace/db";
import {
  GetClicksOverTimeQueryParams,
  GetTopLinksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/analytics/summary", async (_req, res): Promise<void> => {
  const [linkCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(linksTable);
  const [campaignCountRow] = await db.select({ count: sql<number>`count(*)::int` }).from(campaignsTable);
  const [totalClicksRow] = await db.select({ total: sql<number>`coalesce(sum(click_count), 0)::int` }).from(linksTable);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [clicksThisMonthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(gte(clicksTable.clickedAt, startOfMonth));

  const [clicksLastMonthRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(and(gte(clicksTable.clickedAt, startOfLastMonth), lt(clicksTable.clickedAt, startOfMonth)));

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
    totalCampaigns: campaignCountRow?.count ?? 0,
    clicksThisMonth: clicksThisMonthRow?.count ?? 0,
    clicksLastMonth: clicksLastMonthRow?.count ?? 0,
    topCampaign,
  });
});

router.get("/analytics/clicks", async (req, res): Promise<void> => {
  const params = GetClicksOverTimeQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let whereClause = gte(clicksTable.clickedAt, thirtyDaysAgo);

  if (params.data.linkId) {
    const results = await db
      .select({
        date: sql<string>`date_trunc('day', ${clicksTable.clickedAt})::date::text`,
        clicks: sql<number>`count(*)::int`,
      })
      .from(clicksTable)
      .where(and(whereClause, eq(clicksTable.linkId, params.data.linkId)))
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
        clicks: sql<number>`count(*)::int`,
      })
      .from(clicksTable)
      .where(
        and(
          whereClause,
          sql`${clicksTable.linkId} = ANY(ARRAY[${sql.raw(linkIds.join(","))}]::int[])`
        )
      )
      .groupBy(sql`date_trunc('day', ${clicksTable.clickedAt})`)
      .orderBy(sql`date_trunc('day', ${clicksTable.clickedAt})`);

    res.json(results);
    return;
  }

  const results = await db
    .select({
      date: sql<string>`date_trunc('day', ${clicksTable.clickedAt})::date::text`,
      clicks: sql<number>`count(*)::int`,
    })
    .from(clicksTable)
    .where(whereClause)
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
