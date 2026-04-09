import axios from "axios";
import { API_ROUTES } from "@/core/config/apiConfig";

class UserMenuService {
  async getUserMenu(userId) {
    if (!userId) {
      throw new Error("El userId es requerido para cargar el menú.");
    }
    const url = API_ROUTES.USERS_MENU(userId);
    const { data } = await axios.get(url);
    return data;
  }
}

export default UserMenuService;
