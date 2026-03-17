import { Request, Response } from "express";
import { ActivityService } from "./activity.service.js";
import { sendError } from "@/utils/response.utils.js";

export class ActivityController {
  constructor(private activityService: ActivityService) {}

  createActivity = async (req: Request, res: Response) => {
    try {
      const activity = await this.activityService.createActivity(req.body);

      return res.status(201).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      return sendError(res, "Failed to create activity", error);
    }
  };

  getAccountActivities = async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;

      const activities =
        await this.activityService.getAccountActivities(accountId);

      res.json(activities);
    } catch (error) {
      return sendError(res, "Failed to fetch account activities", error);
    }
  };

  getRecentActivities = async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;

      const activities =
        await this.activityService.getRecentActivities(accountId);

      res.json(activities);
    } catch (error) {
      return sendError(res, "Failed to fetch recent activities", error);
    }
  };
}
