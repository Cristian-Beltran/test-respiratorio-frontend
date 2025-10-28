import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pen, RefreshCwIcon, XCircle } from "lucide-react";
import type { Family } from "../family.interface";
import { userFamilyStore } from "../data/family.store";

interface Props {
  item: Family;
  onEditUser: (user: Family) => void;
}

export const FamilyRowActions = ({ item, onEditUser }: Props) => {
  const { changeStatus, remove } = userFamilyStore();

  const handleUpdate = () => {
    onEditUser(item); // Abre el modal de edición
  };

  const handleDelete = () => {
    remove(item.user.id);
  };

  const handleStatus = () => {
    const status = item.user.status;
    changeStatus(item.user.id, status === "ACTIVE" ? "INACTIVE" : "ACTIVE");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDelete}>
            <XCircle /> Eliminar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleStatus}>
            <RefreshCwIcon /> Cambiar estado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUpdate}>
            <Pen /> Editar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
