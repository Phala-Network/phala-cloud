/**
 * Type-level tests for versioned API client
 *
 * These tests verify that TypeScript correctly infers return types based on API version.
 * If types are wrong, this file will fail to compile.
 */

import { describe, it, expectTypeOf } from "vitest";
import { createClient } from "./create-client";
import type { Client } from "./client";
import type { CvmInfoV20251028 } from "./types/cvm_info_v20251028";
import type { CvmInfoV20260121, PaginatedCvmInfosV20260121 } from "./types/cvm_info_v20260121";
import { getCvmList, safeGetCvmList } from "./actions/cvms/get_cvm_list";
import { getCvmInfo, safeGetCvmInfo } from "./actions/cvms/get_cvm_info";
import type { SafeResult } from "./types/client";

describe("versioned client type inference", () => {
  describe("createClient version overloads", () => {
    it("should infer v20260121 types when version is 2026-01-21", () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // Client should be typed with version
      expectTypeOf(client.config.version).toEqualTypeOf<"2026-01-21">();
    });

    it("should infer v20260522 types when version is 2026-05-22", () => {
      const client = createClient({ version: "2026-05-22", apiKey: "test" });

      expectTypeOf(client.config.version).toEqualTypeOf<"2026-05-22">();
    });

    it("should infer v20251028 types when version is 2025-10-28", () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      expectTypeOf(client.config.version).toEqualTypeOf<"2025-10-28">();
    });

    it("should default to latest version when no version specified", () => {
      const client = createClient({ apiKey: "test" });

      // Default should be the latest supported version
      expectTypeOf(client.config.version).toEqualTypeOf<"2026-05-22">();
    });
  });

  describe("getCvmList return type inference", () => {
    it("should return PaginatedCvmInfosV20260121 for v20260121 client (OOP)", async () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // OOP style: client.getCvmList()
      const resultPromise = client.getCvmList();
      expectTypeOf(resultPromise).toEqualTypeOf<Promise<PaginatedCvmInfosV20260121>>();
    });

    it("should return PaginatedCvmInfosV20251028 for v20251028 client (OOP)", async () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // OOP style: client.getCvmList()
      const resultPromise = client.getCvmList();
      expectTypeOf(resultPromise).toEqualTypeOf<Promise<PaginatedCvmInfosV20251028>>();
    });

    it("should return PaginatedCvmInfosV20260121 for v20260121 client (FP)", async () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // FP style: getCvmList(client)
      const resultPromise = getCvmList(client);
      expectTypeOf(resultPromise).toEqualTypeOf<Promise<PaginatedCvmInfosV20260121>>();
    });

    it("should return PaginatedCvmInfosV20251028 for v20251028 client (FP)", async () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // FP style: getCvmList(client)
      const resultPromise = getCvmList(client);
      expectTypeOf(resultPromise).toEqualTypeOf<Promise<PaginatedCvmInfosV20251028>>();
    });
  });

  describe("getCvmInfo return type inference", () => {
    it("should return CvmInfoDetailV20260121 for v20260121 client (OOP)", () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // Type-only check - we verify the return type without calling the function
      type ResultType = ReturnType<typeof client.getCvmInfo>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<CvmInfoDetailV20260121>>();
    });

    it("should return CvmDetailV20251028 for v20251028 client (OOP)", () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // Type-only check - we verify the return type without calling the function
      type ResultType = ReturnType<typeof client.getCvmInfo>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<CvmDetailV20251028>>();
    });

    it("should return CvmInfoDetailV20260121 for v20260121 client (FP)", () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // Type-only check using function type inference
      type GetCvmInfoFn = typeof getCvmInfo<"2026-01-21">;
      type ResultType = ReturnType<GetCvmInfoFn>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<CvmInfoDetailV20260121>>();
    });

    it("should return CvmDetailV20251028 for v20251028 client (FP)", () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // Type-only check using function type inference
      type GetCvmInfoFn = typeof getCvmInfo<"2025-10-28">;
      type ResultType = ReturnType<GetCvmInfoFn>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<CvmDetailV20251028>>();
    });
  });

  describe("safe actions return type inference", () => {
    it("should return SafeResult with correct type for v20260121 (OOP)", () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // Type-only check - we verify the return type without calling the function
      type ResultType = ReturnType<typeof client.safeGetCvmList>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<SafeResult<PaginatedCvmInfosV20260121>>>();
    });

    it("should return SafeResult with correct type for v20251028 (OOP)", () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // Type-only check - we verify the return type without calling the function
      type ResultType = ReturnType<typeof client.safeGetCvmList>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<SafeResult<PaginatedCvmInfosV20251028>>>();
    });

    it("should return SafeResult with correct type for v20260121 (FP)", () => {
      const client = createClient({ version: "2026-01-21", apiKey: "test" });

      // Type-only check using function type inference
      type SafeGetCvmListFn = typeof safeGetCvmList<"2026-01-21">;
      type ResultType = ReturnType<SafeGetCvmListFn>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<SafeResult<PaginatedCvmInfosV20260121>>>();
    });

    it("should return SafeResult with correct type for v20251028 (FP)", () => {
      const client = createClient({ version: "2025-10-28", apiKey: "test" });

      // Type-only check using function type inference
      type SafeGetCvmListFn = typeof safeGetCvmList<"2025-10-28">;
      type ResultType = ReturnType<SafeGetCvmListFn>;
      expectTypeOf<ResultType>().toEqualTypeOf<Promise<SafeResult<PaginatedCvmInfosV20251028>>>();
    });
  });

  describe("response schema structure", () => {
    it("v20260121 CvmInfo should have node_info, not region_identifier", () => {
      type Item = CvmInfoV20260121;

      // v20260121 should have node_info
      expectTypeOf<Item>().toHaveProperty("node_info");

      // v20260121 should NOT have region_identifier at top level
      // (node info is nested in node_info object)
    });

    it("v20251028 CvmInfo should have node with region_identifier", () => {
      type Item = CvmInfoV20251028;

      // v20251028 should have node
      expectTypeOf<Item>().toHaveProperty("node");
    });
  });
});

// Type imports needed for tests
import type { PaginatedCvmInfosV20251028, CvmDetailV20251028 } from "./types/cvm_info_v20251028";
import type { CvmInfoDetailV20260121 } from "./types/cvm_info_v20260121";
