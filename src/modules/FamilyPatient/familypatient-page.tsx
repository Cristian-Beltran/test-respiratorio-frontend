// modules/Family/pages/FamilyPatientsPage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardHeader } from "@/components/headerPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Loader2, Users, Mail, Activity, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/auth/useAuth";
import { FamilyService } from "@/modules/Family/data/family.service";
import type { Family } from "@/modules/Family/family.interface";

function getInitials(name?: string) {
  if (!name) return "—";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

function matchesQuery(text: string, q: string) {
  return text.toLowerCase().includes(q.trim().toLowerCase());
}

function PatientTile({
  id,
  fullname,
  email,
  deviceSerial,
  comfy,
}: {
  id: string;
  fullname: string;
  email: string;
  deviceSerial?: string;
  comfy: boolean;
}) {
  return (
    <Card
      className={`flex flex-col focus-within:ring-2 focus-within:ring-emerald-400 ${comfy ? "p-2" : ""}`}
    >
      <CardHeader className={comfy ? "pb-2" : ""}>
        <div className="flex items-center gap-4">
          <div
            aria-hidden
            className={`flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 ${
              comfy ? "h-14 w-14 text-xl" : "h-10 w-10 text-base"
            }`}
          >
            {getInitials(fullname)}
          </div>
          <div className="min-w-0">
            <CardTitle className={comfy ? "text-lg" : "text-base"}>
              <span className="truncate">{fullname}</span>
            </CardTitle>
            <div className="mt-1 flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className={comfy ? "text-base" : "text-sm"}>{email}</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex items-end justify-between gap-4">
        <div className="text-muted-foreground">
          {deviceSerial ? (
            <Badge
              variant="secondary"
              className={comfy ? "text-base px-3 py-1.5" : ""}
            >
              <Activity className="h-4 w-4 mr-1" />
              Dispositivo: {deviceSerial}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className={comfy ? "text-base px-3 py-1.5" : ""}
            >
              Sin dispositivo
            </Badge>
          )}
        </div>

        <Link to={`/me/${id}`}>
          <Button
            size={comfy ? "lg" : "default"}
            className="group"
            aria-label={`Ver datos del paciente ${fullname}`}
          >
            Ver datos
            <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-0.5" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function FamilyPatientsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [query, setQuery] = useState("");

  const reload = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await FamilyService.findOne(user.id); // usa el mismo id del auth
      setFamily(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los pacientes",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [user?.id]);

  const filtered = (family?.patients ?? []).filter(
    (p) =>
      matchesQuery(p.user.fullname, query) || matchesQuery(p.user.email, query),
  );

  return (
    <div className="space-y-6" role="main" aria-live="polite">
      <DashboardHeader
        title="Mis pacientes"
        description="Pacientes vinculados a mi familia"
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <Input
                placeholder="Buscar paciente por nombre o correo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-[260px]"
              />
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipContent>
                  <p>Tamaño de texto y botones más grandes</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="outline"
              size="icon"
              onClick={reload}
              title="Recargar"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </Button>
          </div>
        }
      />

      {/* buscador en mobile */}
      <div className="md:hidden">
        <Input
          placeholder="Buscar paciente…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <div className="col-span-full flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando pacientes…
            </div>
          )}

          {!loading && (family?.patients?.length ?? 0) === 0 && (
            <div className="col-span-full text-sm md:text-base text-muted-foreground bg-muted/40 border rounded-xl p-6">
              No hay pacientes vinculados a este familiar.
              <div className="mt-2 text-xs md:text-sm">
                Si esperabas ver pacientes, solicita al médico que confirme el
                vínculo familiar.
              </div>
            </div>
          )}

          {!loading &&
            filtered.map((p) => (
              <PatientTile
                key={p.id}
                id={p.id}
                fullname={p.user.fullname}
                email={p.user.email}
                deviceSerial={p.device?.serialNumber}
                comfy={false}
              />
            ))}

          {!loading &&
            (family?.patients?.length ?? 0) > 0 &&
            filtered.length === 0 && (
              <div className="col-span-full text-sm md:text-base text-muted-foreground">
                No se encontraron resultados para “{query}”.
              </div>
            )}
        </div>
      )}
    </div>
  );
}
