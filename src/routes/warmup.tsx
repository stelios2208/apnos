import { createFileRoute, redirect } from "@tanstack/react-router";

// The warm-up now lives inside the unified Static Trainer hub — keep the old
// URL working for bookmarks and existing links.
export const Route = createFileRoute("/warmup")({
  beforeLoad: () => {
    throw redirect({ to: "/sta-trainer", search: { tool: "warmup" } });
  },
  component: () => null,
});
