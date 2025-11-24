import AuthenticationError from "../../errors/AuthenticationError.js";
import UserRepository from "./UserRepository.js";
import PasswordService from "./PasswordService.js";
import TokenService from "./TokenService.js";

export default class AuthService {
  constructor({
    userRepository = new UserRepository(),
    passwordService = new PasswordService(),
    tokenService = new TokenService()
  } = {}) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
  }

  async login(credentials = {}, res) {
    const { cedula, email, password } = credentials;

    if (!password || (!cedula && !email)) {
      throw new AuthenticationError("Nombre de usuario o contraseña incorrectos");
    }

    const user = await this.userRepository.findByCedulaOrEmail({ cedula, email });

    if (!user) {
      throw new AuthenticationError("Nombre de usuario o contraseña incorrectos");
    }

    const storedHash = user.password_hash ?? user.password;
    const isPasswordValid = await this.passwordService.verifyPassword(password, storedHash);

    if (!isPasswordValid) {
      throw new AuthenticationError("Nombre de usuario o contraseña incorrectos");
    }

    const userId = (user.id ?? user._id)?.toString();

    this.tokenService.attachRefreshToken(userId, res);
    const { token, expiresIn } = this.tokenService.createAccessToken(userId);

    return {
      token,
      expiresIn,
      user: this.userRepository.toPublicUser(user)
    };
  }
}

