import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";
import { useEffect } from "react";
import type { Family } from "../family.interface";
import { userFamilyStore } from "../data/family.store";
import { FamilyRowActions } from "./row-actions";
import FamilyFilter from "./filters";

interface Props {
  onEdit: (family: Family) => void;
}
export default function TableFamily({ onEdit }: Props) {
  const { fetchFull, filteredData, isLoading } = userFamilyStore();
  useEffect(() => {
    fetchFull();
  }, [fetchFull]);
  return (
    <DataTable
      columns={[
        ...columns,
        {
          accessorKey: "actions",
          header: "Opciones",
          enableSorting: false,
          enableColumnFilter: false,
          cell: ({ row }) => (
            <FamilyRowActions item={row.original} onEditUser={onEdit} />
          ),
        },
      ]}
      manualPagination={false}
      data={filteredData}
      isLoading={isLoading}
      toolbarContent={<FamilyFilter />}
    />
  );
}
