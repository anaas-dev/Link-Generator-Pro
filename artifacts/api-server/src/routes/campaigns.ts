import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, campaignsTable, linksTable, clicksTable } from "@workspace/db";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  GetCampaignParams,
  UpdateCampaignParams,
  DeleteCampaignParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/campaigns", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);

  const results = await Promise.all(
    campaigns.map(async (c) => {
      const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, c.id));
      const linkIds = links.map((l) => l.id);
      let totalClicks = 0;
      if (linkIds.length > 0) {
        const clickResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(clicksTable)
          .where(
            sql`${clicksTable.linkId} = ANY(ARRAY[${sql.raw(linkIds.join(","))}]::int[])`
          );
        totalClicks = clickResult[0]?.count ?? 0;
      }
      return {
        ...c,
        description: c.description ?? null,
        linkCount: links.length,
        totalClicks,
      };
    })
  );

  res.json(results);
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [campaign] = await db.insert(campaignsTable).values(parsed.data).returning();

  res.status(201).json({ ...campaign, description: campaign.description ?? null, linkCount: 0, totalClicks: 0 });
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, campaign.id));
  const linkIds = links.map((l) => l.id);
  let totalClicks = 0;
  if (linkIds.length > 0) {
    const clickResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clicksTable)
      .where(sql`${clicksTable.linkId} = ANY(ARRAY[${sql.raw(linkIds.join(","))}]::int[])`);
    totalClicks = clickResult[0]?.count ?? 0;
  }

  res.json({ ...campaign, description: campaign.description ?? null, linkCount: links.length, totalClicks });
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [campaign] = await db
    .update(campaignsTable)
    .set(parsed.data)
    .where(eq(campaignsTable.id, params.data.id))
    .returning();

  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, campaign.id));
  const linkIds = links.map((l) => l.id);
  let totalClicks = 0;
  if (linkIds.length > 0) {
    const clickResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clicksTable)
      .where(sql`${clicksTable.linkId} = ANY(ARRAY[${sql.raw(linkIds.join(","))}]::int[])`);
    totalClicks = clickResult[0]?.count ?? 0;
  }

  res.json({ ...campaign, description: campaign.description ?? null, linkCount: links.length, totalClicks });
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [campaign] = await db.delete(campaignsTable).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
