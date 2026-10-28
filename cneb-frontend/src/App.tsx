import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionPlannerPage } from "@/features/sessions/presentation/pages/SessionPlannerPage";
import { LoginForm } from "@/features/auth/presentation/components/LoginForm";
import { authRepository } from "@/features/auth/infrastructure/http-auth.repository";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() =>
    authRepository.isAuthenticated(),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <LoginForm onSuccess={() => setIsAuthenticated(true)} />
      ) : (
        <SessionPlannerPage />
      )}
    </QueryClientProvider>
  );
}

export default App;
