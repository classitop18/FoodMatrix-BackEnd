export interface AccountCreationInput {
  accountType: "family" | "individual";
  accountName: string;
  dailyBudget?: number | string;
  weeklyBudget: number | string;
  monthlyBudget?: number | string;
  annualBudget?: number | string;
  currentAllocation: "daily" | "weekly" | "monthly" | "annual";
  groceriesPercentage?: number;
  diningPercentage?: number;
  emergencyPercentage?: number;
  healthProfile?: any;
  primaryAdminId: string;
}
