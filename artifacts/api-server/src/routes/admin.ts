import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq, ne } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

const router: IRouter = Router();

async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

router.get("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const users = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isAdmin: usersTable.isAdmin, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const { email, password, name, isAdmin } = req.body as {
    email?: string; password?: string; name?: string; isAdmin?: boolean;
  };

  if (!email || !password || !name) {
    res.status(400).json({ error: "Name, email and password are required." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters." });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    res.status(400).json({ error: "An account with this email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    isAdmin: isAdmin === true,
  }).returning({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isAdmin: usersTable.isAdmin, createdAt: usersTable.createdAt });

  res.status(201).json(user);
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid user id." });
    return;
  }

  if (id === req.session.userId) {
    res.status(400).json({ error: "You cannot delete your own account." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ ok: true });
});

export default router;
