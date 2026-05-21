import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "../../client";
import {
  getPreLaunchScriptUpgradeStatus,
  type PreLaunchScriptUpgradeStatus,
} from "./get_prelaunch_script_upgrade_status";

const mockUpgradable: PreLaunchScriptUpgradeStatus = {
  current_hash: "0e289ab44fa756e02a3e850d60c22ab1cbf90cade311f98f555fad74a1c40d0a",
  latest_official_hash: "bf12939bc82c9bdd103b6b1226913e6da58ed7cfcfc7c7ae808ac0813715b9a8",
  is_official: true,
  is_latest: false,
  can_upgrade: true,
};

const mockCustom: PreLaunchScriptUpgradeStatus = {
  current_hash: "deadbeef".repeat(8),
  latest_official_hash: "bf12939bc82c9bdd103b6b1226913e6da58ed7cfcfc7c7ae808ac0813715b9a8",
  is_official: false,
  is_latest: false,
  can_upgrade: false,
};

describe("getPreLaunchScriptUpgradeStatus", () => {
  let client: ReturnType<typeof createClient>;
  let mockGet: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = createClient({ apiKey: "test-api-key", baseURL: "https://api.test.com" });
    mockGet = vi.spyOn(client, "get");
  });

  it("calls the upgrade-status endpoint and parses the response", async () => {
    mockGet.mockResolvedValue(mockUpgradable);

    const result = await getPreLaunchScriptUpgradeStatus(client, { id: "cvm-1" });

    expect(mockGet).toHaveBeenCalledWith("/cvms/cvm-1/pre-launch-script/upgrade-status");
    expect(result).toEqual(mockUpgradable);
  });

  it("passes through can_upgrade=false for custom scripts", async () => {
    mockGet.mockResolvedValue(mockCustom);

    const result = await getPreLaunchScriptUpgradeStatus(client, { id: "cvm-2" });

    expect(result.is_official).toBe(false);
    expect(result.can_upgrade).toBe(false);
  });

  it("accepts a null current_hash (CVM with no recorded hash)", async () => {
    mockGet.mockResolvedValue({
      current_hash: null,
      latest_official_hash: "bf12939bc82c9bdd103b6b1226913e6da58ed7cfcfc7c7ae808ac0813715b9a8",
      is_official: false,
      is_latest: false,
      can_upgrade: false,
    });

    const result = await getPreLaunchScriptUpgradeStatus(client, { id: "cvm-3" });

    expect(result.current_hash).toBeNull();
    expect(result.can_upgrade).toBe(false);
  });
});
