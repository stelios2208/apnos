import { createFileRoute, redirect } from "@tanstack/react-router";

// The CO₂/O₂ tables now live inside the unified Static Trainer hub — keep the
// old URL working for bookmarks and existing links.
export const Route = createFileRoute("/sta-tables")({
  beforeLoad: () => {
    throw redirect({ to: "/sta-trainer", search: { tool: "tables" } });
  },
  component: () => null,
});
