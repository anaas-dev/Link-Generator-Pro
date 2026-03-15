import { Router, type IRouter } from "express";
import { eq, sql, and, gte, lt } from "drizzle-orm";
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

function escape(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))];
  return lines.join("\n");
}

async function getLinkStats(linkId: number, start: Date, end: Date): Promise<{ total: number; unique: number }> {
  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(and(eq(clicksTable.linkId, linkId), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

  const [uniqueRow] = await db
    .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
    .from(clicksTable)
    .where(and(eq(clicksTable.linkId, linkId), gte(clicksTable.clickedAt, start), lt(clicksTable.clickedAt, end)));

  return { total: totalRow?.total ?? 0, unique: uniqueRow?.count ?? 0 };
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

  let campaignTotalClicks = 0;
  let campaignUniqueClicks = 0;

  const linkRows: (string | number | null)[][] = [];

  for (const link of links) {
    const stats = await getLinkStats(link.id, start, end);
    campaignTotalClicks += stats.total;
    campaignUniqueClicks += stats.unique;

    const shortUrl = `${req.protocol}://${req.get("host")}/api/r/${link.slug}`;

    linkRows.push([
      link.title,
      shortUrl,
      link.destinationUrl,
      link.isActive ? "Active" : "Paused",
      link.utmSource ?? "",
      link.utmMedium ?? "",
      link.utmCampaign ?? "",
      stats.total,
      stats.unique,
      link.createdAt ? link.createdAt.toISOString().split("T")[0] : "",
    ]);
  }

  const periodLabel = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;

  const summaryRows: (string | number | null)[][] = [
    ["Campaign Name", campaign.name],
    ["Campaign Status", "Active"],
    ["Report Period", periodLabel],
    ["Number of Links", links.length],
    ["Total Clicks", campaignTotalClicks],
    ["Unique Clicks", campaignUniqueClicks],
    ["Created At", campaign.createdAt ? campaign.createdAt.toISOString().split("T")[0] : ""],
    [],
    ["--- LINK DETAILS ---"],
  ];

  const linkHeaders = [
    "Link Name", "Short URL", "Destination URL", "Status",
    "UTM Source", "UTM Medium", "UTM Campaign",
    "Total Clicks", "Unique Clicks", "Created At"
  ];

  const csvParts: string[] = [];
  csvParts.push("CAMPAIGN SUMMARY");
  csvParts.push(summaryRows.map(r => r.map(escape).join(",")).join("\n"));
  csvParts.push("");
  csvParts.push("LINK DETAILS");
  csvParts.push(rowsToCsv(linkHeaders, linkRows));

  const filename = `yas-links-campaign-${campaign.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csvParts.join("\n"));
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
  const campaignMap = new Map(allCampaigns.map((c) => [c.id, c]));

  const periodLabel = `${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}`;

  let grandTotal = 0;
  let grandUnique = 0;
  const rows: (string | number | null)[][] = [];

  for (const link of allLinks) {
    const stats = await getLinkStats(link.id, start, end);
    grandTotal += stats.total;
    grandUnique += stats.unique;

    const campaign = link.campaignId ? campaignMap.get(link.campaignId) : null;
    const shortUrl = `${req.protocol}://${req.get("host")}/api/r/${link.slug}`;

    rows.push([
      link.title,
      shortUrl,
      link.destinationUrl,
      campaign?.name ?? "No Campaign",
      link.isActive ? "Active" : "Paused",
      link.utmSource ?? "",
      link.utmMedium ?? "",
      link.utmCampaign ?? "",
      stats.total,
      stats.unique,
      link.createdAt ? link.createdAt.toISOString().split("T")[0] : "",
    ]);
  }

  const summaryRows: (string | number | null)[][] = [
    ["Report Name", "Yas-Links Full Report"],
    ["Report Period", periodLabel],
    ["Total Links", allLinks.length],
    ["Total Campaigns", allCampaigns.length],
    ["Grand Total Clicks", grandTotal],
    ["Grand Unique Clicks", grandUnique],
    [],
    ["--- LINK DETAILS ---"],
  ];

  const linkHeaders = [
    "Link Name", "Short URL", "Destination URL", "Campaign",
    "Status", "UTM Source", "UTM Medium", "UTM Campaign",
    "Total Clicks", "Unique Clicks", "Created At"
  ];

  const csvParts: string[] = [];
  csvParts.push("YAS-LINKS FULL REPORT");
  csvParts.push(summaryRows.map(r => r.map(escape).join(",")).join("\n"));
  csvParts.push("");
  csvParts.push("LINK DETAILS");
  csvParts.push(rowsToCsv(linkHeaders, rows));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="yas-links-full-report.csv"`);
  res.send(csvParts.join("\n"));
});

export default router;
