import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AnalysisProvider } from "./context/AnalysisContext";
import { useAuth } from "./context/AuthContext";

// Lazy load pages for Code Splitting (to reduce Vite initial bundle size)
const AssessmentQuestions = lazy(() => import("./pages/AssessmentQuestions"));
const CompareAnalyses = lazy(() => import("./pages/CompareAnalyses"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const History = lazy(() => import("./pages/History"));
const Loading = lazy(() => import("./pages/Loading"));
const Login = lazy(() => import("./pages/Login"));
const Profile = lazy(() => import("./pages/Profile"));
const Register = lazy(() => import("./pages/Register"));
const Results = lazy(() => import("./pages/Results"));
const ReviewExtractedData = lazy(() => import("./pages/ReviewExtractedData"));
const Settings = lazy(() => import("./pages/Settings"));
const SharedResults = lazy(() => import("./pages/SharedResults"));
const UploadCV = lazy(() => import("./pages/UploadCV"));

function PublicOnlyRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AnalysisProvider>
      <Suspense fallback={<div className="flex h-screen items-center justify-center">جاري التحميل...</div>}>
        <Routes>
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <Register />
            </PublicOnlyRoute>
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        {/* Batch 4.1 (F4.2) — صفحة عامة بدون تسجيل دخول، خارج ProtectedRoute عمداً */}
        <Route path="/shared/:shareToken" element={<SharedResults />} />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/analysis/upload" element={<UploadCV />} />
          <Route path="/analysis/review" element={<ReviewExtractedData />} />
          <Route path="/analysis/assessment" element={<AssessmentQuestions />} />
          <Route path="/analysis/loading" element={<Loading />} />
          <Route path="/results/:analysisId" element={<Results />} />
          <Route path="/compare" element={<CompareAnalyses />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </Suspense>
    </AnalysisProvider>
  );
}
