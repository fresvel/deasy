import { createApp } from "./src/http/create-app.js";
import { logCompilerEvent } from "./src/services/observability.js";

const app = createApp();
const PORT = Number(process.env.COMPILER_PORT || 4100);
const SERVICE_NAME = "document-compiler";

app.listen(PORT, () => {
  logCompilerEvent("service.started", {
    service: SERVICE_NAME,
    port: PORT,
  });
});
