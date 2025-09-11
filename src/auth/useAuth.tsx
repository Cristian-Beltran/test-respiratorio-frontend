import { create } from "zustand";
import { getCookie, setCookie, deleteCookie } from "./cookies";
import {
  ROLE_PERMISSIONS,
  type Role,
  type Permission,
} from "./role-permissions";

export type User = {
  id: string;
  name: string;
  roles: Role[];
};

type AuthState = {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // acciones
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // RBAC
  hasRole: (r: Role) => boolean;
  can: (p: Permission) => boolean;
};

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  // Lee cookie y obtiene /me (si aplica)
  restore: async () => {
    const token = getCookie("auth_token");
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      // Si tienes endpoint real:
      // const me = await http.get('/auth/me').then(r => r.data as User);
      // Mock local (quítalo cuando conectes backend):
      const me: User = { id: "u1", name: "Dr. Demo", roles: ["doctor"] };
      set({ user: me });
    } catch (e) {
      console.error(e);
      set({ user: null, error: "No se pudo restaurar la sesión" });
      deleteCookie("auth_token");
    } finally {
      set({ isLoading: false });
    }
  },

  // Login: simula petición y setea cookie
  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // Ejemplo real:
      // const { data } = await http.post('/auth/login', { email, password });
      // const { token, user } = data as { token: string; user: User };
      // setCookie('auth_token', token, 7);
      // set({ user });
      console.log("Login", email, password);
      // Mock local (reemplaza por lo de arriba):
      await new Promise((r) => setTimeout(r, 600));
      // decide rol por email para probar
      const role: Role = email.includes("admin") ? "admin" : "doctor";
      setCookie("auth_token", "mock-token", 7);
      set({ user: { id: "u1", name: "Usuario", roles: [role] } });
    } catch (e) {
      set({ error: "Credenciales inválidas" });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      // await http.post('/auth/logout'); // si tu backend invalida cookie
    } finally {
      deleteCookie("auth_token");
      set({ user: null });
    }
  },

  hasRole: (r) => !!get().user?.roles.includes(r),

  can: (perm) => {
    const roles = get().user?.roles ?? [];
    // union de permisos por cada rol
    const perms = new Set<Permission>();
    roles.forEach((r) => ROLE_PERMISSIONS[r].forEach((p) => perms.add(p)));
    return perms.has(perm);
  },
}));
