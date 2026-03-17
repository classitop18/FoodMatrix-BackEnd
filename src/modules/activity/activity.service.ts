import { IActivityRepository } from "./activity.repository.js";
import { CreateActivityDTO, IActivity } from "./types/activity.types.js";

export class ActivityService {
  constructor(private activityRepo: IActivityRepository) {}

  async createActivity(data: CreateActivityDTO): Promise<IActivity> {
    return this.activityRepo.create(data);
  }

  async getAccountActivities(accountId: string) {
    return this.activityRepo.findByAccount(accountId);
  }

  async getMemberActivities(memberId: string) {
    return this.activityRepo.findByMember(memberId);
  }

  async getRecentActivities(accountId: string) {
    return this.activityRepo.getRecent(accountId);
  }
}
