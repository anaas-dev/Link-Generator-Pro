import { Router, type IRouter } from "express";
import healthRouter from "./health";
import campaignsRouter from "./campaigns";
import linksRouter from "./links";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(campaignsRouter);
router.use(linksRouter);
router.use(analyticsRouter);

export default router;
