import { Input } from "@/components/ui/input";
import { userFamilyStore } from "../data/family.store";

export default function FamilyFilter() {
  const { search, applySearch } = userFamilyStore();
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
      <Input
        placeholder="Buscar por nombre"
        defaultValue={search}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            applySearch((e.target as HTMLInputElement).value);
          }
        }}
        className="w-2xs"
      />
    </div>
  );
}
