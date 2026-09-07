import { describe, expect, it } from "vitest";
import { GetAvailableOSImagesResponseSchema } from "./get_available_os_images";

describe("GetAvailableOSImagesResponseSchema", () => {
  it("preserves the slug and global enablement of each variant", () => {
    const result = GetAvailableOSImagesResponseSchema.parse([
      {
        version: [0, 6, 0],
        release: "0.6.0-rc1",
        published_at: "2026-09-07T12:00:00Z",
        prod: {
          name: "dstack-0.5.8",
          slug: "dstack-0.5.8-target",
          os_image_hash: "0x1234",
          requires_gpu: false,
          supports_cpu: true,
          supports_gpu: true,
          is_current: false,
          enabled: false,
        },
        dev: null,
      },
    ]);

    expect(result[0]?.prod?.slug).toBe("dstack-0.5.8-target");
    expect(result[0]?.prod?.enabled).toBe(false);
    expect(result[0]?.release).toBe("0.6.0-rc1");
    expect(result[0]?.published_at).toBe("2026-09-07T12:00:00Z");
    expect(result[0]?.prod?.requires_gpu).toBe(false);
    expect(result[0]?.prod?.supports_cpu).toBe(true);
    expect(result[0]?.prod?.supports_gpu).toBe(true);
  });
});
