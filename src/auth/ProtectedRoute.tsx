import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import type { Role, Permission } from "./role-permissions";

type Props = {
  children: ReactNode;
  roles?: Role[];
  permissions?: Permission[];
  minDelayMs?: number;
};

export function ProtectedRoute({
  children,
  roles,
  permissions,
  minDelayMs = 350,
}: Props) {
  const { user, isLoading, restore, hasRole, can } = useAuth();
  const loc = useLocation();
  const [delayDone, setDelayDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDelayDone(true), minDelayMs);
    return () => clearTimeout(t);
  }, [minDelayMs]);

  useEffect(() => {
    restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!delayDone || isLoading) {
    return <FullscreenLoader />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }
  if (roles && !roles.some((r) => hasRole(r))) {
    return <DenyBox msg="Acceso denegado (rol)" />;
  }
  if (permissions && !permissions.every((p) => can(p))) {
    return <DenyBox msg="Acceso denegado (permiso)" />;
  }

  return <>{children}</>;
}

function FullscreenLoader() {
  return (
    <div style={loaderWrap}>
      <div style={spinner} />
      <div style={{ marginTop: 12, opacity: 0.8 }}>Cargando…</div>
    </div>
  );
}

function DenyBox({ msg }: { msg: string }) {
  return <div style={{ padding: 24 }}>{msg}</div>;
}
const loaderWrap: React.CSSProperties = {
  height: "100vh",
  display: "grid",
  placeItems: "center",
  color: "#e5e7eb",
  background: "#0f172a",
};

const spinner: React.CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid rgba(255,255,255,0.2)",
  borderTopColor: "#22c55e",
  borderRadius: "50%",
  animation: "spin 0.9s linear infinite",
};
