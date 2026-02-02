import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { Session } from "@/modules/Session/session.interface";
import { SessionReport } from "./session-report";
import { exportElementToPdf } from "@/lib/exportPdf";

export function SessionReportModal({
  open,
  onOpenChange,
  session,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
}) {
  const ref = React.useRef<HTMLDivElement | null>(null);

  if (!session) return null;

  const filename = `reporte_sesion_${session.id.slice(0, 8)}.pdf`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[90vw] sm:max-w-[1240px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between gap-2">
          <DialogTitle>Reporte en PDF</DialogTitle>

          <Button
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={async () => {
              if (!ref.current) return;
              await exportElementToPdf(ref.current, { filename, scale: 2 });
            }}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar PDF
          </Button>
        </DialogHeader>

        {/* OJO: este contenedor es el que se convierte a PDF */}
        <div
          ref={ref}
          className="p-4"
          style={{
            background: "#fff",
            color: "#111827",
          }}
        >
          <SessionReport session={session} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
