export const SALT_ROUNDS = 10;

export const hashString = async (plainText: string): Promise<string> => {
  const bcrypt = await import("bcrypt");
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainText, salt);
};

export const compareHash = async (
  plainText: string,
  hash: string,
): Promise<boolean> => {
  const bcrypt = await import("bcrypt");
  return bcrypt.compare(plainText, hash);
};
