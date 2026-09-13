import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Dashboard, DashboardSkeleton } from "@/components/intel/dashboard";
import { fetchIntel } from "@/lib/intel/functions";

export const Route = createFileRoute("/")({
  loader: () => fetchIntel({ data: {} }),
  pendingComponent: DashboardSkeleton,
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <Dashboard initial={initial} />
    </QueryClientProvider>
  );
}
