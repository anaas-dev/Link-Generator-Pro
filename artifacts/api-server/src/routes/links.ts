import { Router, type IRouter } from "express";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { db, linksTable, campaignsTable, clicksTable } from "@workspace/db";
import QRCode from "qrcode";
import {
  CreateLinkBody,
  UpdateLinkBody,
  GetLinkParams,
  UpdateLinkParams,
  DeleteLinkParams,
  GetLinksQueryParams,
  GetLinkQrParams,
} from "@workspace/api-zod";
import { generateSlug } from "../lib/slugify.js";

const router: IRouter = Router();

async function enrichLink(link: typeof linksTable.$inferSelect) {
  let campaignName: string | null = null;
  if (link.campaignId) {
    const [c] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, link.campaignId));
    campaignName = c?.name ?? null;
  }

  const [totalRow] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(clicksTable)
    .where(eq(clicksTable.linkId, link.id));

  const [uniqueRow] = await db
    .select({ count: sql<number>`count(distinct ${clicksTable.visitorId})::int` })
    .from(clicksTable)
    .where(eq(clicksTable.linkId, link.id));

  const trackedTotal = totalRow?.total ?? 0;
  const trackedUnique = uniqueRow?.count ?? 0;

  return {
    ...link,
    campaignId: link.campaignId ?? null,
    campaignName,
    utmSource: link.utmSource ?? null,
    utmMedium: link.utmMedium ?? null,
    utmCampaign: link.utmCampaign ?? null,
    utmTerm: link.utmTerm ?? null,
    utmContent: link.utmContent ?? null,
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
    totalClicks: trackedTotal,
    uniqueClicks: trackedUnique,
  };
}

router.get("/links", async (req, res): Promise<void> => {
  const params = GetLinksQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(linksTable);
  let links;
  if (params.data.campaignId !== undefined && params.data.campaignId !== null) {
    links = await db.select().from(linksTable).where(eq(linksTable.campaignId, params.data.campaignId)).orderBy(linksTable.createdAt);
  } else {
    links = await db.select().from(linksTable).orderBy(linksTable.createdAt);
  }

  const enriched = await Promise.all(links.map(enrichLink));
  res.json(enriched);
});

router.post("/links", async (req, res): Promise<void> => {
  const parsed = CreateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const slug = parsed.data.slug || generateSlug();

  // Check slug uniqueness
  const [existing] = await db.select().from(linksTable).where(eq(linksTable.slug, slug));
  if (existing) {
    res.status(400).json({ error: "Slug already in use. Please choose a different one." });
    return;
  }

  const [link] = await db
    .insert(linksTable)
    .values({
      campaignId: parsed.data.campaignId ?? null,
      title: parsed.data.title,
      slug,
      destinationUrl: parsed.data.destinationUrl,
      utmSource: parsed.data.utmSource ?? null,
      utmMedium: parsed.data.utmMedium ?? null,
      utmCampaign: parsed.data.utmCampaign ?? null,
      utmTerm: parsed.data.utmTerm ?? null,
      utmContent: parsed.data.utmContent ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    })
    .returning();

  res.status(201).json(await enrichLink(link));
});

router.get("/links/:id", async (req, res): Promise<void> => {
  const params = GetLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [link] = await db.select().from(linksTable).where(eq(linksTable.id, params.data.id));
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.json(await enrichLink(link));
});

router.patch("/links/:id", async (req, res): Promise<void> => {
  const params = UpdateLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateLinkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof linksTable.$inferInsert> = {};
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.destinationUrl !== undefined) updateData.destinationUrl = parsed.data.destinationUrl;
  if (parsed.data.campaignId !== undefined) updateData.campaignId = parsed.data.campaignId;
  if (parsed.data.utmSource !== undefined) updateData.utmSource = parsed.data.utmSource;
  if (parsed.data.utmMedium !== undefined) updateData.utmMedium = parsed.data.utmMedium;
  if (parsed.data.utmCampaign !== undefined) updateData.utmCampaign = parsed.data.utmCampaign;
  if (parsed.data.utmTerm !== undefined) updateData.utmTerm = parsed.data.utmTerm;
  if (parsed.data.utmContent !== undefined) updateData.utmContent = parsed.data.utmContent;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
  if (parsed.data.expiresAt !== undefined) {
    updateData.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }

  const [link] = await db
    .update(linksTable)
    .set(updateData)
    .where(eq(linksTable.id, params.data.id))
    .returning();

  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.json(await enrichLink(link));
});

router.delete("/links/:id", async (req, res): Promise<void> => {
  const params = DeleteLinkParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [link] = await db.delete(linksTable).where(eq(linksTable.id, params.data.id)).returning();
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/links/:id/qr", async (req, res): Promise<void> => {
  const params = GetLinkQrParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [link] = await db.select().from(linksTable).where(eq(linksTable.id, params.data.id));
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  const host = req.get("host") || "localhost";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
  const shortUrl = `${protocol}://${host}/api/r/${link.slug}`;

  const svgDataUrl = await QRCode.toDataURL(shortUrl, {
    type: "image/png",
    width: 300,
    margin: 2,
    color: {
      dark: "#0f2044",
      light: "#ffffff",
    },
  });

  res.json({ svgDataUrl, shortUrl });
});

// Redirect route — must be registered here too so /api/r/:slug works
router.get("/r/:slug", async (req, res): Promise<void> => {
  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [link] = await db.select().from(linksTable).where(eq(linksTable.slug, rawSlug));
  if (!link) {
    res.status(404).json({ error: "Link not found" });
    return;
  }

  if (!link.isActive) {
    res.status(410).json({ error: "Link is inactive" });
    return;
  }

  if (link.expiresAt && new Date() > link.expiresAt) {
    res.status(410).json({ error: "Link has expired" });
    return;
  }

  // Compute visitor fingerprint (IP + user-agent) for unique click tracking
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const ua = req.get("user-agent") || "unknown";
  const visitorId = `${ip}::${ua}`;

  // Check if this visitor has already clicked this link
  const [existingClick] = await db
    .select({ id: clicksTable.id })
    .from(clicksTable)
    .where(and(eq(clicksTable.linkId, link.id), eq(clicksTable.visitorId, visitorId)));

  const isNewVisitor = !existingClick;

  // Always record the click event, but track whether it's unique
  await db.insert(clicksTable).values({
    linkId: link.id,
    referrer: req.get("referer") ?? null,
    userAgent: ua,
    visitorId,
  });

  // Only increment click count for unique visitors
  if (isNewVisitor) {
    await db
      .update(linksTable)
      .set({ clickCount: link.clickCount + 1 })
      .where(eq(linksTable.id, link.id));
  }

  // Build the final URL with UTM params appended
  const url = new URL(link.destinationUrl);
  if (link.utmSource) url.searchParams.set("utm_source", link.utmSource);
  if (link.utmMedium) url.searchParams.set("utm_medium", link.utmMedium);
  if (link.utmCampaign) url.searchParams.set("utm_campaign", link.utmCampaign);
  if (link.utmTerm) url.searchParams.set("utm_term", link.utmTerm);
  if (link.utmContent) url.searchParams.set("utm_content", link.utmContent);

  res.redirect(302, url.toString());
});

export default router;
