import AuthenticationError from "../../errors/AuthenticationError.js";
import UserRepository from "./UserRepository.js";
import PasswordService from "./PasswordService.js";
import TokenService from "./TokenService.js";
import RbacService from "./RbacService.js";

export default class AuthService {
  constructor({
    userRepository = new UserRepository(),
    passwordService = new PasswordService(),
    tokenService = new TokenService(),
    rbacService = new RbacService()
  } = {}) {
    this.userRepository = userRepository;
    this.passwordService = passwordService;
    this.tokenService = tokenService;
    this.rbacService = rbacService;
  }

  async login(credentials = {}, res) {
    // SÓLO CORREO desde el 2026-08-29. El número de documento entraba aquí y no debía: su unicidad
    // es (tipo, país, número), así que buscarlo suelto podía emparejar a la persona equivocada. Y
    // aunque se acotara, un pasaporte se renueva CON NÚMERO NUEVO — quien entrara con él perdería
    // su acceso al renovarlo. El correo lo controla la persona y no caduca.
    const { email, password } = credentials;

    if (!password || !email) {
      throw new AuthenticationError("Nombre de usuario o contraseña incorrectos");
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AuthenticationError("El usuario no existe");
    }

    const storedHash = user.password_hash ?? user.password;
    const isPasswordValid = await this.passwordService.verifyPassword(password, storedHash);

    if (!isPasswordValid) {
      throw new AuthenticationError("La contraseña es incorrecta");
    }

    const userId = (user.id ?? user._id)?.toString();

    this.tokenService.attachRefreshToken(userId, res);
    const { token, expiresIn } = this.tokenService.createAccessToken(userId);
    const access = await this.rbacService.getUserAccess(userId);

    return {
      token,
      expiresIn,
      user: this.userRepository.toPublicUser(user, access)
    };
  }
}

