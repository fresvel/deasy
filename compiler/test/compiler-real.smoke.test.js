import test from "node:test";
import assert from "node:assert/strict";

const COMPILER_BASE_URL = String(process.env.COMPILER_BASE_URL || "").trim();
const COMPILER_SHARED_TOKEN = String(process.env.COMPILER_SHARED_TOKEN || "").trim();
const TEST_COMPILER_DOCUMENT_VERSION_ID = String(
  process.env.TEST_COMPILER_DOCUMENT_VERSION_ID || ""
).trim();

const shouldRun =
  Boolean(COMPILER_BASE_URL) &&
  Boolean(COMPILER_SHARED_TOKEN) &&
  Boolean(TEST_COMPILER_DOCUMENT_VERSION_ID);

test("smoke real de compilación contra servicio levantado", { skip: !shouldRun }, async () => {
  const response = await fetch(
    `${COMPILER_BASE_URL.replace(/\/+$/g, "")}/compile`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${COMPILER_SHARED_TOKEN}`,
      },
      body: JSON.stringify({
        document_version_id: Number(TEST_COMPILER_DOCUMENT_VERSION_ID),
      }),
    }
  );

  assert.ok(
    [200, 202, 400, 422].includes(response.status),
    `status inesperado en smoke real: ${response.status}`
  );
});
