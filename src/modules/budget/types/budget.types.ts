export interface SetupBudgetInput {
  accountId: string;
  date: string; // ISO date string – the specific date to set budget for
  amount: number; // allocated amount for that date
  userId: string;
}

export interface UpdateBudgetInput {
  accountId: string;
  mode?: "daily" | "weekly";
  dailyAmount?: number;
  weeklyAmount?: number;
  changeReason?: string;
  userId: string;
}

export interface LogExpenseInput {
  accountId: string;
  date: string; // ISO date string
  amountSpent: number;
  notes?: string;
  userId: string;
}

export interface BudgetHistoryQuery {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AnalyticsQuery {
  period: "weekly" | "monthly";
}

export interface DailyBudgetWithExpense {
  id: string;
  date: string;
  allocatedAmount: string;
  amountSpent: string | null;
  balance: number;
  notes: string | null;
  expenseId: string | null;
}

export interface TodayBudgetSummary {
  date: string;
  allocatedAmount: number;
  amountSpent: number;
  balance: number;
  hasExpenseLogged: boolean;
  isFallback: boolean; // true if using previous date's budget
  fallbackFromDate: string | null; // the date the fallback budget came from
  configId: string | null;
}

export interface WeeklySummary {
  weekStart: string; // Sunday
  weekEnd: string; // Saturday
  totalBudget: number;
  totalSpent: number;
  totalBalance: number;
  days: {
    date: string;
    dayName: string;
    allocatedAmount: number;
    amountSpent: number;
    balance: number;
    hasBudget: boolean;
    hasExpense: boolean;
    isFallback: boolean;
  }[];
}

export interface BudgetAnalytics {
  period: "weekly" | "monthly";
  totalBudget: number;
  totalSpent: number;
  totalBalance: number;
  daysOverBudget: number;
  daysUnderBudget: number;
  averageDailySpending: number;
  dailyData: {
    date: string;
    budget: number;
    spent: number;
    balance: number;
  }[];
}

export interface PendingUpdate {
  date: string;
  allocatedAmount: number;
  dailyBudgetId: string;
}
