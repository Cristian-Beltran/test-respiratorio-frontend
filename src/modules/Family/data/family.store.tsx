import { toast } from "sonner";
import { create } from "zustand";
import type { CreateFamily, Family } from "../family.interface";
import type { Status } from "@/types/status.interface";
import { FamilyService } from "./family.service";

interface UserClinicStore {
  data: Family[];
  filteredData: Family[];
  search: string;
  isLoading: boolean;
  fetchFull: () => Promise<void>;
  reload: () => Promise<void>;
  total: number;
  applySearch: (term: string) => void;

  create: (payload: CreateFamily) => Promise<void>;
  update: (id: string, payload: Partial<CreateFamily>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  changeStatus: (id: string, status: Status) => Promise<void>;
}

export const userFamilyStore = create<UserClinicStore>((set, get) => ({
  data: [],
  filteredData: [],
  total: 0,
  search: "",
  isLoading: false,
  referrals: [],
  referralsLoading: false,

  async fetchFull() {
    set({ isLoading: true });
    try {
      const data = await FamilyService.findAll();
      set({
        data,
        filteredData: data,
        isLoading: false,
      });
      get().applySearch(get().search);
    } catch (error) {
      console.error("Error fetching full data", error);
      toast.error("Ha ocurrido un error");
      set({ isLoading: false });
    }
  },

  applySearch(term) {
    set({ search: term });
    const { data, search } = get();
    console.log("filtrando");
    const filtered = data.filter((item) => {
      const { fullname, email } = item.user;
      const normalized = search.toLowerCase();

      return (
        fullname?.toLowerCase().includes(normalized) ||
        email?.toLowerCase().includes(normalized)
      );
    });
    set({ filteredData: filtered });
  },

  async create(payload) {
    const created = await FamilyService.create(payload);
    const { data } = get();
    set({
      data: [created, ...data],
      total: data.length + 1,
    });
    get().applySearch(get().search);
    toast.success("Familiar creado");
  },

  async reload() {
    get().applySearch(get().search);
  },

  async update(id, payload) {
    const updated = await FamilyService.update(id, payload);
    console.log(updated);
    const { data } = get();
    data.map((item) => {
      console.log(item.user.id == id);
    });
    const updatedData = data.map((item) =>
      item.user.id == id ? updated : item,
    );
    console.log(updatedData);
    set({ data: updatedData });
    get().reload();
    toast.success("Familiar actualizado");
  },

  async remove(id) {
    try {
      await FamilyService.remove(id);
      const { data } = get();
      const updatedData = data.filter((item) => item.user.id !== id);
      set({
        data: updatedData,
        total: updatedData.length,
      });
      get().reload();
      toast.success("Familiar eliminado");
    } catch (error) {
      console.error(error);
      toast.error("Ha Ocurrido un error");
    }
  },

  async changeStatus(id, status) {
    try {
      const updated = await FamilyService.changeStatus(id, status);
      toast.success("Estado modificiado");
      const { data } = get();
      const updatedData = data.map((item) =>
        item.user.id === id ? updated : item,
      );
      set({ data: updatedData });
      get().reload();
    } catch (error) {
      console.error(error);
      toast.error("Ha ocurrido un error");
    }
  },
}));
