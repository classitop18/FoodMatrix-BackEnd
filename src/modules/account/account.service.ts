
import { HealthCalculatorService } from "../health-profile/health-calculate.service.js";
import {
  AccountMemberRepository,
  IAccountMemberRepository,
} from "../shared/account-member/account-member.respository.js";
import {
  AccountMemberService,
  IAccountMemberService,
} from "../shared/account-member/account-member.service.js";
import { CreateAccountMemberPayload } from "../shared/account-member/dto/account-member.dto.js";
import { AccountRepository } from "./account.repository.js";
import { AccountInsert, Account } from "./account.repository.js";
import { AccountCreationInput } from "./types/account.types.js";

export class AccountService {
  private readonly accountMemberService: IAccountMemberService;

  constructor(private readonly accountRepo = new AccountRepository()) {
    this.accountMemberService = new AccountMemberService(new AccountMemberRepository(), new HealthCalculatorService());
  }

  private async mapAccountCreationToPayload(
    input: AccountCreationInput,
  ): Promise<CreateAccountMemberPayload> {
    const data = input;

    return {
      account: {
        accountNumber: await this.generateAccountNumber(),
        accountName: data.accountName,
        accountType: data.accountType || "family",
        primaryAdminId: data.primaryAdminId,

        dailyBudget: data.dailyBudget ? Number(data.dailyBudget) : undefined,

        weeklyBudget: Number(data.weeklyBudget),

        monthlyBudget: data.monthlyBudget
          ? Number(data.monthlyBudget)
          : undefined,

        annualBudget: data.annualBudget ? Number(data.annualBudget) : undefined,

        groceriesPercentage: data.groceriesPercentage,
        diningPercentage: data.diningPercentage,
        emergencyPercentage: data.emergencyPercentage,
      },

      member: {
        userId: data.primaryAdminId,
        role: "super_admin",
      },

      healthProfile: data.healthProfile
        ? {
          height: data.healthProfile.height || undefined,
          weight: data.healthProfile.weight || undefined,
          activityLevel: data.healthProfile.activityLevel,

          conditions: data.healthProfile.conditions,
          allergies: data.healthProfile.allergies,

          dietaryRestrictions: data.healthProfile.dietaryRestrictions,
          organicPreference: data.healthProfile.organicPreference,

          goals: data.healthProfile.goals,

          cookingSkill: data.healthProfile.cookingSkill,
          cookingFrequency: data.healthProfile.cookingFrequency,
          preferredCuisines: data.healthProfile.preferredCuisines,

          budgetFlexibility: data.healthProfile.budgetFlexibility,

          excludedFoods: data.healthProfile.excludedFoods,
          includedFoods: data.healthProfile.includedFoods,
          customExclusions: data.healthProfile.customExclusions,
          customInclusions: data.healthProfile.customInclusions,
          preferenceSets: data.healthProfile.preferenceSets,

          privacyLevel: data.healthProfile.isPrivate ? "private" : "shared",

          dailyCalorieTarget: data.healthProfile.dailyCalorieTarget,
          dailySodiumLimitMg: data.healthProfile.dailySodiumLimitMg,
        }
        : undefined,
    };
  }

  private async generateAccountNumber(): Promise<string> {
    const maxAttempts = 5;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // Generate 6-digit number and pad with zeros
      const randomNum = Math.floor(Math.random() * 999999) + 1;
      const accountNumber = `FM${randomNum.toString().padStart(6, "0")}`;

      //   Check If AccountNumber is Already exist
      const isExist = await this.accountRepo.getAccountData({
        accountNumber: accountNumber,
      });

      if (!isExist) {
        return accountNumber;
      }
      // Log collision for monitoring
      console.log(
        `Account number collision on attempt ${attempt}: ${accountNumber}`,
      );
    }

    throw new Error(
      `Failed to generate unique account number after ${maxAttempts} attempts`,
    );
  }

  async getAccount(payload: {
    id?: string;
    accountNumber?: string;
    primaryAdminId?: string;
  }): Promise<Account | null> {
    return await this.accountRepo.getAccountData(payload);
  }

  async createAccount(data: AccountCreationInput): Promise<any> {
    return this.accountMemberService.createAccount(
      await this.mapAccountCreationToPayload(data),
      data?.primaryAdminId,
    );
  }

  getAccountById(
    accountId: string,
    primaryAdminId: string,
  ): Promise<Account | null> {
    return this.accountRepo.getAccountById(accountId, primaryAdminId);
  }

  getAccountsForUser(userId: string): Promise<any[]> {
    console.log({ userId });
    return this.accountRepo.getAccountsByUserId(userId);
  }

  updateAccount(
    accountId: string,
    data: Partial<Account>,
  ): Promise<Account | null> {
    return this.accountRepo.updateAccount(accountId, data);
  }

  deleteAccount(accountId: string): Promise<void> {
    return this.accountRepo.deleteAccount(accountId);
  }

  async ensureUserIsMember(userId: string, accountId: string) {
    const isMember = await this.accountRepo.isUserMemberOfAccount(
      userId,
      accountId,
    );

    if (!isMember) {
      throw new Error("User is not a member of this account");
    }
  }
}
