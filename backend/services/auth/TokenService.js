import { generateToken, generateRefreshToken } from "../../utils/login/generate_token.js";

export default class TokenService {
  createAccessToken(userId) {
    return generateToken(userId);
  }

  attachRefreshToken(userId, res) {
    return generateRefreshToken(userId, res);
  }

  get accessTokenTTL() {
    return 60 * 60 * 2;
  }
}

