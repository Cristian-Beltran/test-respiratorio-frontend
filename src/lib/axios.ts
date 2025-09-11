import axios from "axios";
import { getCookie } from "@/auth/cookies";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:3000/api",
  withCredentials: true, // si usas cookie HttpOnly en el backend
});

// Si NO usas HttpOnly y debes mandar Bearer desde el cliente:
http.interceptors.request.use((config) => {
  const token = getCookie("auth_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
