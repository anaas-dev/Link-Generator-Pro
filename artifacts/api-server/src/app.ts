import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool, db, linksTable, clicksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import router from "./routes";

const PgSession = ConnectPgSimple(session);

const app: Express = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionSecret = process.env.SESSION_SECRET || "yas-links-secret-key-change-in-production";

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    name: "yaslinks.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    },
  })
);

// Short link redirect — accessible at /r/:slug (clean path, no /api prefix)
app.get("/r/:slug", async (req, res): Promise<void> => {
  const rawSlug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

  const [link] = await db.select().from(linksTable).where(eq(linksTable.slug, rawSlug));
  if (!link) {
    res.status(404).send("Link not found");
    return;
  }
  if (!link.isActive) {
    res.status(410).send("Link is inactive");
    return;
  }
  if (link.expiresAt && new Date() > link.expiresAt) {
    res.status(410).send("Link has expired");
    return;
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
  const ua = req.get("user-agent") || "unknown";
  const visitorId = `${ip}::${ua}`;

  const [existingClick] = await db
    .select({ id: clicksTable.id })
    .from(clicksTable)
    .where(and(eq(clicksTable.linkId, link.id), eq(clicksTable.visitorId, visitorId)));

  const isNewVisitor = !existingClick;

  await db.insert(clicksTable).values({
    linkId: link.id,
    referrer: req.get("referer") ?? null,
    userAgent: ua,
    visitorId,
  });

  if (isNewVisitor) {
    await db.update(linksTable).set({ clickCount: link.clickCount + 1 }).where(eq(linksTable.id, link.id));
  }

  const url = new URL(link.destinationUrl);
  if (link.utmSource) url.searchParams.set("utm_source", link.utmSource);
  if (link.utmMedium) url.searchParams.set("utm_medium", link.utmMedium);
  if (link.utmCampaign) url.searchParams.set("utm_campaign", link.utmCampaign);
  if (link.utmTerm) url.searchParams.set("utm_term", link.utmTerm);
  if (link.utmContent) url.searchParams.set("utm_content", link.utmContent);

  res.redirect(302, url.toString());
});

app.use("/api", router);

export default app;
