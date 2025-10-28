import type { User } from "@/types/user.interface";
import type { Patient } from "../Patient/patient.interface";

export interface CreateFamily {
  fullname: string;
  email: string;
  password?: string;
  address?: string;
  patientsId?: string[];
}

export interface Family {
  id: string;
  user: User;
  patients?: Patient[];
}
