import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import conversationsRouter from "./conversations";
import groupsRouter from "./groups";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(conversationsRouter);
router.use(groupsRouter);
router.use(adminRouter);

export default router;
