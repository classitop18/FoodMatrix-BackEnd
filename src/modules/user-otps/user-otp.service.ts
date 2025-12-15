import { CreateOtpDTO, UserOtp, VerifyOtpDTO } from "./types/user-otp.types";
import { IUserOtpRepository } from "./user-otp.repository";

export interface IUserOtpService {
    createOtp(data: CreateOtpDTO): Promise<UserOtp>;
    verifyOtp(data: VerifyOtpDTO): Promise<UserOtp | null>;
    markOtpUsed(id: string): Promise<UserOtp | null>;
}


export class UserOtpService implements IUserOtpService {
    constructor(private otpRepo: IUserOtpRepository) { }

    async createOtp(data: CreateOtpDTO): Promise<UserOtp> {
        return this.otpRepo.createOtp({
            userId: data.userId,
            otp: data.otp,
            purpose: data.purpose,
            tempSessionToken: data.tempSessionToken ?? null,
            expiresAt: data.expiresAt,
        });
    }

    async verifyOtp(data: VerifyOtpDTO): Promise<UserOtp | null> {
        const record = await this.otpRepo.verifyOtp(
            data.userId,
            data.otp,
            data.purpose
        );

        return record;
    }

    async markOtpUsed(id: string): Promise<UserOtp | null> {
        return this.otpRepo.markOtpUsed(id);
    }
}
