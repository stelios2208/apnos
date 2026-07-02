import { createServer } from "./src/.output/server/index.mjs";

const port = process.env.PORT || 10000;

const server = createServer();

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
