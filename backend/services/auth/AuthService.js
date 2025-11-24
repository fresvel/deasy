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

    const isPasswordValid = await this.passwordService.verifyPassword(password, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError("Nombre de usuario o contraseña incorrectos");
    }

    this.tokenService.attachRefreshToken(user._id, res);
    const { token, expiresIn } = this.tokenService.createAccessToken(user._id);

    return {
      token,
      expiresIn,
      user: this.userRepository.toPublicUser(user)
    };
  }
}

