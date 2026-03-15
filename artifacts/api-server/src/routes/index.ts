import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import linksRouter from "./links";
import analyticsRouter from "./analytics";
import reportsRouter from "./reports";
import authRouter from "./auth";
import { requireAuth } from "../middleware/requireAuth";

const router: IRouter = Router();

router.use(authRouter);
router.use(requireAuth);
router.use(healthRouter);
router.use(campaignsRouter);
router.use(linksRouter);
router.use(analyticsRouter);
router.use(reportsRouter);

export default router;
