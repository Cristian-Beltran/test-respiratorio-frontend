import { Badge } from "@/components/ui/badge";
import type { ColumnDef } from "@tanstack/react-table";
import type { Family } from "../family.interface";
import type { Patient } from "@/modules/Patient/patient.interface";

export const columns: ColumnDef<Family>[] = [
  {
    accessorKey: "user.fullname",
    header: () => "Nombre",
  },
  {
    accessorKey: "user.email",
    header: () => "Correo",
  },
  {
    accessorKey: "user.address",
    header: () => "Dirreción",
  },
  {
    accessorKey: "patients",
    header: () => "Pacientes registrados",
    cell: ({ row }) => {
      const patients = row.getValue("patients") as Patient[];
      return (
        <div>
          {patients?.map((patient) => (
            <Badge variant="secondary" key={patient.id}>
              {patient.user.fullname}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "user.createdAt",
    id: "createdAt",
    header: () => "Registrado",
    cell: ({ row }) => {
      const date = new Date(row.getValue("createdAt"));
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    },
  },
  {
    accessorKey: "user.status",
    id: "status",
    header: () => "Estado",
    cell: ({ row }) => {
      const status = row.getValue("status");
      return (
        <Badge variant={status === "ACTIVE" ? "default" : "destructive"}>
          {status === "ACTIVE" ? "Habilitado" : "Deshabilitado"}
        </Badge>
      );
    },
  },
];
