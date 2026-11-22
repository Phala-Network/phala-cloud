import { afterEach, expect, it, vi } from "vitest";
import { createClient } from "../../client";
import { getAppPendingUpdates, safeGetAppPendingUpdates } from "./get_app_pending_updates";

const appId = "9f".repeat(20);
const endpoint = "https://example.test/api/v1";
const item = {
  vm_uuid: "f35c2ed96b3242c197251903aeefca1e",
  compose_hash: "11".repeat(32),
  on_chain: true,
  instance_name: null,
};

afterEach(() => vi.unstubAllGlobals());

it("returns registered hashes and their states without writing to the app", async () => {
  const payload = {
    items: [item],
    registered_unused: [
      { compose_hash: item.compose_hash, state: "pending" },
      { compose_hash: "22".repeat(32), state: "unused" },
    ],
  };
  const fetch = vi.fn(async () => Response.json(payload));
  vi.stubGlobal("fetch", fetch);
  const client = createClient({ baseURL: endpoint, apiKey: "test-key" });

  expect(await getAppPendingUpdates(client, { appId })).toEqual(payload);
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    `${endpoint}/apps/${appId}/pending-updates`,
    expect.objectContaining({ method: "GET" }),
  );
});

it("reports no registered hashes when the older response does not include them", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ items: [item] }));
  const client = createClient({ baseURL: endpoint, apiKey: "test-key" });
  expect(await safeGetAppPendingUpdates(client, { appId })).toEqual({
    success: true,
    data: { items: [item], registered_unused: [] },
  });
});
