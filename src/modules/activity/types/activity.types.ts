export interface IActivity {
  id: string;
  accountId: string;
  memberId: string;
  action: string;
  details?: Record<string, any>;
  createdAt: Date;
}

export interface CreateActivityDTO {
  accountId: string;
  memberId: string;
  action: string;
  details?: Record<string, any>;
}
