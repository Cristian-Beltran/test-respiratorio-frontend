import { createBrowserRouter } from "react-router-dom";
import DashboardLayout from "./layouts/dashboard";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import DashboardPage from "./modules/Dashboard/dashboard-page";
import LoginPage from "./pages/login";
import NotFoundPage from "./pages/not-found";
import MonitoringPage from "./modules/Monitoring/monitoring";
import DoctorsPage from "./modules/Doctors/doctors";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "monitoring", element: <MonitoringPage /> },
      { path: "doctor", element: <DoctorsPage /> },

      // routes
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
