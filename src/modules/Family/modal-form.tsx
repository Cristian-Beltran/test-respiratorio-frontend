import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { Family } from "./family.interface";
import { userFamilyStore } from "./data/family.store";
import type { Patient } from "../Patient/patient.interface";
import { MultiSelect } from "@/components/select/multi-select";
import { patientService } from "../Patient/data/patient.service";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: Family | null;
}

export default function FamilyFormModal({ isOpen, onClose, user }: Props) {
  const toPatientOptions = (patients: Patient[]) =>
    patients.map((p) => ({
      value: p.id,
      label: p.user?.fullname ?? "(Sin nombre)",
    }));

  const familySchema = z.object({
    fullname: z.string().min(2, "Nombre requerido"),
    email: z.string().email("Correo Requerido"),
    password: user
      ? z.string().optional() // en edición no valida contraseña
      : z.string().min(6, "Contraseña requerida"), // en creación sí
    address: z.string().optional(),
    patientIds: z.array(z.string()).min(1, "Selecciona al menos un paciente"),
  });
  type FamilyFormValues = z.infer<typeof familySchema>; //

  const { create, update } = userFamilyStore();
  const form = useForm<FamilyFormValues>({
    resolver: zodResolver(familySchema),
    defaultValues: {
      fullname: "",
      email: "",
      address: "",
      patientIds: [],
    },
  });

  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await patientService.findAll();
        if (mounted) setPatients(data ?? []);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (user) {
      const { user: base } = user;
      // Ajusta esta línea según tu shape real: Family -> patients[]
      const preselectedIds = (user.patients ?? []).map((p: Patient) => p.id);
      form.reset({
        fullname: base.fullname,
        email: base.email,
        address: base.address || "",
        patientIds: preselectedIds,
      });
    } else {
      form.reset({ fullname: "", email: "", address: "", patientIds: [] });
    }
  }, [user, form, isOpen]);

  const onSubmit = async (data: FamilyFormValues) => {
    try {
      if (user) {
        await update(user.user.id, {
          fullname: data.fullname,
          address: data.address,
          email: data.email,
          patientsId: data.patientIds, // <—
        });
      } else {
        await create({
          fullname: data.fullname,
          email: data.email,
          password: data.password,
          address: data.address,
          patientsId: data.patientIds,
        });
      }
      onClose();
    } catch (error) {
      if (!axios.isAxiosError(error)) {
        toast.error("Ha ocurrido un error");
        return;
      }
      if (error.response?.status === 400) {
        toast.error("Correo repetido");
        form.setError("email", { type: "server" }, { shouldFocus: true });
        return;
      }
      toast.error(error.response?.data.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {user ? "Editar familiar" : "Crear Familiar"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="fullname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Correo electronico</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!user && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Dirreción</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="patientIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pacientes asignados</FormLabel>
                  <FormControl>
                    <MultiSelect
                      value={field.value}
                      onChange={field.onChange}
                      options={toPatientOptions(patients)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {user ? "Editar" : "Crear"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
