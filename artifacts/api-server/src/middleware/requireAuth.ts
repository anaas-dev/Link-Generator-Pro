import { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for the /api/r/:slug redirect
  if (req.path.startsWith("/r/")) {
    next();
    return;
  }
  // Skip auth for auth routes
  if (req.path.startsWith("/auth/")) {
    next();
    return;
  }
  if (!req.session?.userId) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  next();
}
