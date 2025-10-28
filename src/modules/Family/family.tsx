import { DashboardHeader } from "@/components/headerPage";
import TableFamily from "./table/data-table";
import { Button } from "@/components/ui/button";
import { PlusCircle, RotateCcw } from "lucide-react";
import { userFamilyStore } from "./data/family.store";
import type { Family } from "./family.interface";
import { useState } from "react";
import FamilyFormModal from "./modal-form";

export default function FamilyPage() {
  const [selectedUser, setSelectedUser] = useState<Family | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { fetchFull } = userFamilyStore();

  const openForCreate = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const openForEdit = (user: Family) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };
  return (
    <>
      <div className="space-y-6">
        <DashboardHeader
          title="Familiares"
          description="Lista de familiares"
          actions={
            <>
              <Button onClick={openForCreate}>
                <PlusCircle />
                Crear
              </Button>
              <Button
                size={"icon"}
                variant="outline"
                onClick={fetchFull}
                title="Recargar"
              >
                <RotateCcw />
              </Button>
            </>
          }
        ></DashboardHeader>
      </div>

      <div className="p-6 space-y-6">
        <TableFamily onEdit={openForEdit} />
      </div>

      <FamilyFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        user={selectedUser}
      />
    </>
  );
}
