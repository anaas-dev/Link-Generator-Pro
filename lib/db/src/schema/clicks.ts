import { pgTable, serial, timestamp, integer, text } from "drizzle-orm/pg-core";
import { linksTable } from "./links";

export const clicksTable = pgTable("clicks", {
  id: serial("id").primaryKey(),
  linkId: integer("link_id").notNull().references(() => linksTable.id, { onDelete: "cascade" }),
  clickedAt: timestamp("clicked_at", { withTimezone: true }).notNull().defaultNow(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  visitorId: text("visitor_id"),
});

export type Click = typeof clicksTable.$inferSelect;
