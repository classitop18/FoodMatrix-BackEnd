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

  // Address fields
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  formattedAddress?: string;
  latitude?: string;
  longitude?: string;
  placeId?: string;
}
