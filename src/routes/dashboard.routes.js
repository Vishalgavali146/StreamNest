import { Router } from "express";
import { verify } from "jsonwebtoken";
import { verifyJWT } from "../middlewares/auth.middleware";
import { getChannelStats, getChannelVideos } from "../controllers/dashboard.controller";

const router = Router();

router.route(verifyJWT)

router.route("/stats").get(getChannelStats)
router.route("/videos").get(getChannelVideos)