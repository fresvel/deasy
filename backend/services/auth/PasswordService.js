import bcrypt from "bcrypt";

export default class PasswordService {
  async verifyPassword(plainPassword, hashedPassword) {
    if (!plainPassword || !hashedPassword) {
      return false;
    }

    return bcrypt.compare(plainPassword, hashedPassword);
  }
}

