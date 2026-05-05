import axios from "axios";

axios.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : "";
  if (!token) {
    return config;
  }

  config.headers = config.headers || {};
  config.headers.Authorization = config.headers.Authorization || `Bearer ${token}`;
  return config;
});

export default axios;
