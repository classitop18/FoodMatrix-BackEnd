import { AccountRepository } from "./account.repository.ts";
import { AccountInsert, Account } from "./account.repository.ts";

export class AccountService {
    constructor(
        private readonly accountRepo = new AccountRepository(),
    ) { }



    private async generateAccountNumber(): Promise<string> {
        const maxAttempts = 5;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Generate 6-digit number and pad with zeros
            const randomNum = Math.floor(Math.random() * 999999) + 1;
            const accountNumber = `FM${randomNum.toString().padStart(6, '0')}`;

            //   Check If AccountNumber is Already exist
            const isExist = await this.accountRepo.getAccountData({ accountNumber: accountNumber });

            if (!isExist) {
                return accountNumber;
            }
            // Log collision for monitoring
            console.log(`Account number collision on attempt ${attempt}: ${accountNumber}`);
        }

        throw new Error(`Failed to generate unique account number after ${maxAttempts} attempts`);
    }

    async getAccount(payload: {
        id?: string;
        accountNumber?: string;
        primaryAdminId?: string;
    }): Promise<Account | null> {
        return await this.accountRepo.getAccountData(payload);
    }

    async createAccount(data: AccountInsert): Promise<Account> {
        const accountData = { ...data, accountNumber: await this.generateAccountNumber() }


        return this.accountRepo.createAccount(accountData);
    }

    getAccountById(accountId: string, primaryAdminId: string): Promise<Account | null> {
        return this.accountRepo.getAccountById(accountId, primaryAdminId);
    }

    getAccountsForUser(userId: string): Promise<any[]> {

        console.log({ userId })
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
