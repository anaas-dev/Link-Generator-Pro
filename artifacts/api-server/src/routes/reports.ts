import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt } from "drizzle-orm";
import { db, linksTable, campaignsTable, clicksTable } from "@workspace/db";

const router: IRouter = Router();

function buildDateRange(days?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  if (startDate) return { start: new Date(startDate), end };
  const d = parseInt(days ?? "30", 10);
  return { start: new Date(end.getTime() - d * 24 * 60 * 60 * 1000), end };
}

function escape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

function shortUrl(req: { protocol: string; get(h: string): string | undefined }, slug: string): string {
  return `yas-link.to/${slug}`;
}

async function getCampaignStats(
  links: { id: number; slug: string }[],
  start: Date,
  end: Date
): Promise<{ total: number; unique: number; shortLinks: string }> {
  let total = 0;
  let unique = 0;
  const slugs: string[] = [];

  for (const link of links) {
    slugs.push(`yas-link.to/${link.slug}`);
    const [tr] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));
    const [ur] = await db
      .select({ c: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));
    total += tr?.c ?? 0;
    unique += ur?.c ?? 0;
  }

  return { total, unique, shortLinks: slugs.join(" | ") };
}

// Report for a single campaign
router.get("/reports/campaign/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid campaign id" }); return; }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }

  const { start, end } = buildDateRange(
    req.query.days as string,
    req.query.startDate as string,
    req.query.endDate as string
  );

  const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, id));
  const stats = await getCampaignStats(links, start, end);
  const period = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;
  const startDate = campaign.createdAt ? campaign.createdAt.toISOString().split("T")[0] : "";

  const headers = ["Campaign Name", "Start Date", "Report Period", "Number of Links", "Total Clicks", "Unique Clicks", "Short Links"];
  const rows = [[campaign.name, startDate, period, links.length, stats.total, stats.unique, stats.shortLinks]];

  const filename = `yas-links-campaign-${campaign.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(toCsv(headers, rows));
});

// Global report — one row per campaign
router.get("/reports/all", async (req, res): Promise<void> => {
  const { start, end } = buildDateRange(
    req.query.days as string,
    req.query.startDate as string,
    req.query.endDate as string
  );

  const allCampaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  const allLinks = await db.select().from(linksTable).orderBy(linksTable.campaignId);

  const period = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;
  const headers = ["Campaign Name", "Start Date", "Report Period", "Number of Links", "Total Clicks", "Unique Clicks", "Short Links"];
  const rows: (string | number | null | undefined)[][] = [];

  for (const campaign of allCampaigns) {
    const campLinks = allLinks.filter(l => l.campaignId === campaign.id);
    const stats = await getCampaignStats(campLinks, start, end);
    const startDate = campaign.createdAt ? campaign.createdAt.toISOString().split("T")[0] : "";
    rows.push([campaign.name, startDate, period, campLinks.length, stats.total, stats.unique, stats.shortLinks]);
  }

  // Uncategorized links
  const uncategorized = allLinks.filter(l => !l.campaignId);
  if (uncategorized.length > 0) {
    const stats = await getCampaignStats(uncategorized, start, end);
    rows.push(["(No Campaign)", "", period, uncategorized.length, stats.total, stats.unique, stats.shortLinks]);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="yas-links-full-report.csv"`);
  res.send(toCsv(headers, rows));
});

export default router;
