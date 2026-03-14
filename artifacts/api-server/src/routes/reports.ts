import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt, inArray } from "drizzle-orm";
import { db, linksTable, campaignsTable, clicksTable } from "@workspace/db";

const router: IRouter = Router();

function buildDateRange(days?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  const end = endDate ? new Date(endDate) : new Date();
  if (startDate) {
    return { start: new Date(startDate), end };
  }
  const d = parseInt(days ?? "30", 10);
  const start = new Date(end.getTime() - d * 24 * 60 * 60 * 1000);
  return { start, end };
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}

// Report for a single campaign
router.get("/reports/campaign/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid campaign id" });
    return;
  }

  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }

  const { start, end } = buildDateRange(
    req.query.days as string,
    req.query.startDate as string,
    req.query.endDate as string
  );

  const links = await db.select().from(linksTable).where(eq(linksTable.campaignId, id));

  const rows: (string | number | null)[][] = [];

  for (const link of links) {
    const [totalRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

    const [uniqueRow] = await db
      .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

    rows.push([
      link.id,
      link.title,
      link.slug,
      link.destinationUrl,
      link.isActive ? "Active" : "Paused",
      link.utmSource ?? "",
      link.utmMedium ?? "",
      link.utmCampaign ?? "",
      totalRow?.total ?? 0,
      uniqueRow?.count ?? 0,
      link.createdAt ? link.createdAt.toISOString().split("T")[0] : "",
    ]);
  }

  const headers = [
    "Link ID", "Title", "Slug", "Destination URL", "Status",
    "UTM Source", "UTM Medium", "UTM Campaign",
    "Total Clicks", "Unique Clicks", "Created At"
  ];
  const csv = rowsToCsv(headers, rows);
  const filename = `yas-links-campaign-${campaign.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-report.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

// Global report for all campaigns and uncategorized links
router.get("/reports/all", async (req, res): Promise<void> => {
  const { start, end } = buildDateRange(
    req.query.days as string,
    req.query.startDate as string,
    req.query.endDate as string
  );

  const allLinks = await db.select().from(linksTable).orderBy(linksTable.campaignId, linksTable.createdAt);
  const allCampaigns = await db.select().from(campaignsTable);
  const campaignMap = new Map(allCampaigns.map((c) => [c.id, c.name]));

  const rows: (string | number | null)[][] = [];

  for (const link of allLinks) {
    const [totalRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

    const [uniqueRow] = await db
      .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
      .from(clicksTable)
      .where(and(eq(clicksTable.linkId, link.id), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

    rows.push([
      link.id,
      link.campaignId ? campaignMap.get(link.campaignId) ?? "Unknown" : "No Campaign",
      link.title,
      link.slug,
      link.destinationUrl,
      link.isActive ? "Active" : "Paused",
      link.utmSource ?? "",
      link.utmMedium ?? "",
      link.utmCampaign ?? "",
      totalRow?.total ?? 0,
      uniqueRow?.count ?? 0,
      link.createdAt ? link.createdAt.toISOString().split("T")[0] : "",
    ]);
  }

  const headers = [
    "Link ID", "Campaign", "Title", "Slug", "Destination URL", "Status",
    "UTM Source", "UTM Medium", "UTM Campaign",
    "Total Clicks", "Unique Clicks", "Created At"
  ];
  const csv = rowsToCsv(headers, rows);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="yas-links-full-report.csv"`);
  res.send(csv);
});

export default router;
