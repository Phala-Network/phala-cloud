import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";
import { z } from "zod";
import { createPublicClient, createWalletClient, parseEventLogs, parseEther, type PublicClient, type WalletClient, type Hash, type TransactionReceipt } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import {
  addComposeHash,
  safeAddComposeHash,
  type AddComposeHashRequest,
  AddComposeHashSchema,
} from "./add_compose_hash";

// Mock external libraries
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(),
    createWalletClient: vi.fn(),
    parseEventLogs: vi.fn(),
  };
});

// Mock utility functions
vi.mock("../../utils", async () => {
  const actual = await vi.importActual("../../utils");
  return {
    ...actual,
    validateNetworkPrerequisites: vi.fn(),
    createTransactionTracker: vi.fn(),
    executeTransactionWithRetry: vi.fn(),
    asHex: vi.fn((value: string, length?: number) => {
      // Simple mock implementation
      const hex = value.startsWith("0x") ? value.slice(2) : value;
      const padded = hex.padEnd((length || 32) * 2, "0");
      return `0x${padded}`;
    }),
  };
});

// Import mocked utilities
import { 
  validateNetworkPrerequisites, 
  createTransactionTracker, 
  executeTransactionWithRetry 
} from "../../utils";

// Type-safe mocks
const mockCreatePublicClient = createPublicClient as MockedFunction<typeof createPublicClient>;
const mockCreateWalletClient = createWalletClient as MockedFunction<typeof createWalletClient>;
const mockParseEventLogs = parseEventLogs as MockedFunction<typeof parseEventLogs>;
const mockValidateNetworkPrerequisites = validateNetworkPrerequisites as MockedFunction<typeof validateNetworkPrerequisites>;
const mockCreateTransactionTracker = createTransactionTracker as MockedFunction<typeof createTransactionTracker>;
const mockExecuteTransactionWithRetry = executeTransactionWithRetry as MockedFunction<typeof executeTransactionWithRetry>;

// Address derived from validRequest.privateKey via privateKeyToAccount; the
// addComposeHash owner pre-check compares this against the contract's owner()
// return value, so the readContract mock below must return the same address.
const TEST_SENDER_ADDRESS = "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb" as `0x${string}`;

describe("addComposeHash", () => {
  let mockPublicClient: Partial<PublicClient>;
  let mockWalletClient: Partial<WalletClient>;
  let mockTransactionTracker: {
    status: { state: string };
    isComplete: boolean;
    execute: MockedFunction<(operation: any, clients: any, args: any[], options: any) => Promise<{ hash: Hash; receipt: TransactionReceipt; success: boolean }>>;
  };
  let validRequest: AddComposeHashRequest;

  const mockReceipt: TransactionReceipt = {
    transactionHash: "0x123...abc" as `0x${string}`,
    blockNumber: BigInt(1234567),
    gasUsed: BigInt(21000),
    logs: [],
    status: "success",
    blockHash: "0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd" as `0x${string}`,
    contractAddress: null,
    cumulativeGasUsed: BigInt(21000),
    effectiveGasPrice: BigInt(1000000000),
    from: TEST_SENDER_ADDRESS,
    logsBloom: "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    to: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
    transactionIndex: 0,
    type: "eip1559" as const,
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock PublicClient
    // Pre-check reads owner() and compares to sender; all other readContract
    // calls keep their historical tuple shape.
    mockPublicClient = {
      readContract: vi.fn().mockImplementation(async (args: any) => {
        if (args?.functionName === "owner") {
          return TEST_SENDER_ADDRESS;
        }
        return [true, "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`];
      }),
    };

    // Mock WalletClient
    mockWalletClient = {
      account: {
        address: TEST_SENDER_ADDRESS,
      },
      chain: base,
      writeContract: vi.fn().mockResolvedValue("0x123...abc" as `0x${string}`),
      getChainId: vi.fn().mockResolvedValue(base.id),
    };

    // Mock TransactionTracker
    mockTransactionTracker = {
      status: { state: "idle" },
      isComplete: false,
      execute: vi.fn().mockResolvedValue({
        hash: "0x123...abc" as `0x${string}`,
        receipt: mockReceipt,
        success: true,
      }),
    };

    // Setup mock returns
    mockCreatePublicClient.mockReturnValue(mockPublicClient as PublicClient);
    mockCreateWalletClient.mockReturnValue(mockWalletClient as WalletClient);
    mockCreateTransactionTracker.mockReturnValue(mockTransactionTracker);

    // Mock network validation
    mockValidateNetworkPrerequisites.mockResolvedValue({
      networkValid: true,
      balanceValid: true,
      addressValid: true,
      details: {
        currentChainId: base.id,
        balance: parseEther("1.0"),
        address: TEST_SENDER_ADDRESS,
      },
    });

    // Mock executeTransactionWithRetry
    mockExecuteTransactionWithRetry.mockResolvedValue({
      hash: "0x123...abc" as `0x${string}`,
      receipt: mockReceipt,
      success: true,
    });

    // Mock event parsing (optional event)
    mockParseEventLogs.mockReturnValue([]);

    // Valid request template
    validRequest = {
      chain: base,
      kmsContractAddress: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
      appId: "0xabcdef1234567890abcdef1234567890abcdef12" as `0x${string}`,
      composeHash: "deadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      privateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" as `0x${string}`,
    };
  });

  describe("Standard Version", () => {
    it("should add compose hash successfully with default parameters", async () => {
      // Set up the execution spy to capture the operation and call it
      let capturedOperation: any;
      mockTransactionTracker.execute.mockImplementation(async (operation: any, clients: any, args: any[], options: any) => {
        capturedOperation = operation;
        // Call the operation to test the actual logic
        await operation(clients);
        return {
          hash: "0x123...abc" as `0x${string}`,
          receipt: mockReceipt,
          success: true,
        };
      });

      const result = await addComposeHash(validRequest);

      expect(result).toEqual({
        composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        appAuthAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        appId: "0xabcdef1234567890abcdef1234567890abcdef12",
        transactionHash: "0x123...abc",
        blockNumber: BigInt(1234567),
        gasUsed: BigInt(21000),
      });

      // Verify App Auth contract was called via the captured operation
      expect(capturedOperation).toBeDefined();
      expect(mockWalletClient.writeContract).toHaveBeenCalledWith({
        address: "0xabcdef1234567890abcdef1234567890abcdef12",
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: "addComposeHash",
            type: "function",
          }),
        ]),
        functionName: "addComposeHash",
        args: ["0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"],
        account: expect.any(Object),
        chain: base,
      });
    });

    it("should handle custom timeout", async () => {
      const request = {
        ...validRequest,
        timeout: 180000, // 3 minutes
      };

      await addComposeHash(request);

      expect(mockTransactionTracker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
        [],
        expect.objectContaining({
          timeout: 180000,
        }),
      );
    });

    it("should handle abort signal", async () => {
      const abortController = new AbortController();
      const request = {
        ...validRequest,
        signal: abortController.signal,
      };

      // Mock transaction tracker to simulate abort
      mockTransactionTracker.execute.mockImplementation(async () => {
        abortController.abort();
        throw new Error("AbortError");
      });

      await expect(addComposeHash(request)).rejects.toThrow("AbortError");
    });

    it("should handle minBalance parameter", async () => {
      const request = {
        ...validRequest,
        minBalance: "0.5", // Require 0.5 ETH
      };

      // Mock balance check to fail
      mockValidateNetworkPrerequisites.mockResolvedValueOnce({
        networkValid: true,
        balanceValid: false,
        addressValid: true,
        details: {
          currentChainId: base.id,
          balance: parseEther("0.1"), // Only 0.1 ETH
          address: TEST_SENDER_ADDRESS,
        },
      });

      await expect(addComposeHash(request)).rejects.toThrow("Insufficient balance");
    });

    it("should use custom schema when provided", async () => {
      const customSchema = z.object({
        composeHash: z.string(),
        transactionHash: z.string(),
      });

      const result = await addComposeHash(validRequest, { schema: customSchema });

      expect(result).toEqual({
        composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        transactionHash: "0x123...abc",
      });
    });

    it("should return raw data when schema is false", async () => {
      const result = await addComposeHash(validRequest, { schema: false });

      expect(result).toEqual({
        composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        appAuthAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        appId: "0xabcdef1234567890abcdef1234567890abcdef12",
        transactionHash: "0x123...abc",
        blockNumber: BigInt(1234567),
        gasUsed: BigInt(21000),
      });
    });

    it("should throw when custom schema validation fails", async () => {
      const invalidSchema = z.object({
        invalidField: z.string(),
      });

      await expect(
        addComposeHash(validRequest, { schema: invalidSchema }),
      ).rejects.toThrow();
    });

    it("should work with wallet client authentication", async () => {
      const walletRequest = {
        ...validRequest,
        privateKey: undefined,
        walletClient: mockWalletClient as WalletClient,
      };

      const result = await addComposeHash(walletRequest);

      expect(result).toEqual({
        composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        appAuthAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
        appId: "0xabcdef1234567890abcdef1234567890abcdef12",
        transactionHash: "0x123...abc",
        blockNumber: BigInt(1234567),
        gasUsed: BigInt(21000),
      });
    });

    it("should work with both clients provided", async () => {
      const clientsRequest = {
        ...validRequest,
        privateKey: undefined,
        walletClient: mockWalletClient as WalletClient,
        publicClient: mockPublicClient as PublicClient,
        chain: undefined, // Chain is optional when both clients provided
      };

      const result = await addComposeHash(clientsRequest);

      expect(result).toBeDefined();
      expect(mockCreatePublicClient).not.toHaveBeenCalled();
      expect(mockCreateWalletClient).not.toHaveBeenCalled();
    });

    it("should throw when transaction fails", async () => {
      // Mock the transaction tracker to simulate a failed transaction
      mockTransactionTracker.execute.mockRejectedValue(
        new Error("Transaction failed: contract call reverted")
      );

      await expect(addComposeHash(validRequest)).rejects.toThrow(
        "Transaction failed: contract call reverted",
      );
    });

    it("should throw when wallet client throws error", async () => {
      // Mock the wallet client to throw an error during contract write
      mockWalletClient.writeContract?.mockRejectedValue(
        new Error("Insufficient funds for transaction")
      );

      // Mock the transaction tracker to propagate the error
      mockTransactionTracker.execute.mockImplementation(async (operation: any, clients: any) => {
        try {
          await operation(clients);
        } catch (error) {
          throw error;
        }
      });

      await expect(addComposeHash(validRequest)).rejects.toThrow(
        "Insufficient funds for transaction",
      );
    });

    it("should handle validation errors", async () => {
      const error = new Error("Validation error");
      (error as any).status = 422;
      mockTransactionTracker.execute.mockRejectedValue(error);

      await expect(addComposeHash(validRequest)).rejects.toEqual(error);
    });

    it("should handle prerequisite check failures", async () => {
      mockValidateNetworkPrerequisites.mockResolvedValue({
        networkValid: false,
        balanceValid: true,
        addressValid: true,
        details: {
          currentChainId: 999,
          balance: parseEther("1.0"),
          address: TEST_SENDER_ADDRESS,
        },
      });

      await expect(addComposeHash(validRequest)).rejects.toThrow("Network mismatch");
    });

    it("should handle insufficient balance", async () => {
      mockValidateNetworkPrerequisites.mockResolvedValue({
        networkValid: true,
        balanceValid: false,
        addressValid: true,
        details: {
          currentChainId: base.id,
          balance: parseEther("0.0001"),
          address: TEST_SENDER_ADDRESS,
        },
      });

      await expect(addComposeHash(validRequest)).rejects.toThrow("Insufficient balance");
    });

    it("should skip prerequisite checks when configured", async () => {
      const skipRequest = {
        ...validRequest,
        skipPrerequisiteChecks: true,
      };

      await addComposeHash(skipRequest);

      expect(mockValidateNetworkPrerequisites).not.toHaveBeenCalled();
    });

    it("should use retry mechanism when enabled", async () => {
      const retryRequest = {
        ...validRequest,
        retryOptions: { maxRetries: 3, initialDelay: 1000 },
      };

      await addComposeHash(retryRequest);

      expect(mockExecuteTransactionWithRetry).toHaveBeenCalledWith(
        expect.any(Function), // operation
        expect.any(Object),   // networkClients
        [],                   // args
        expect.objectContaining({
          timeout: 120000,
          confirmations: 1,
        }),
        expect.objectContaining({
          maxRetries: 3,
          initialDelay: 1000,
        }),
      );
    });

    it("should handle progress callbacks", async () => {
      const onStateChange = vi.fn();
      const onSubmitted = vi.fn();
      const onConfirmed = vi.fn();

      await addComposeHash({
        ...validRequest,
        onTransactionStateChange: onStateChange,
        onTransactionSubmitted: onSubmitted,
        onTransactionConfirmed: onConfirmed,
      });

      expect(mockTransactionTracker.execute).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
        [],
        expect.objectContaining({
          timeout: 120000,
          confirmations: 1,
          onSubmitted: expect.any(Function),
          onConfirmed: expect.any(Function),
        }),
      );
    });

    it("should validate required parameters", async () => {
      // Missing privateKey and walletClient
      const invalidRequest = {
        ...validRequest,
        privateKey: undefined,
      };

      await expect(addComposeHash(invalidRequest)).rejects.toThrow(
        "Either 'privateKey' or 'walletClient' must be provided",
      );
    });

    it("should reject both privateKey and walletClient", async () => {
      const invalidRequest = {
        ...validRequest,
        walletClient: mockWalletClient as WalletClient,
      };

      await expect(addComposeHash(invalidRequest)).rejects.toThrow(
        "Either 'privateKey' or 'walletClient' must be provided, but not both",
      );
    });

    it("should require chain when clients missing", async () => {
      const invalidRequest = {
        ...validRequest,
        chain: undefined,
      };

      await expect(addComposeHash(invalidRequest)).rejects.toThrow(
        "Chain is required when publicClient or walletClient is not provided",
      );
    });
  });

  describe("Safe Version", () => {
    it("should return success result when operation succeeds", async () => {
      const result = await safeAddComposeHash(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          appAuthAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
          appId: "0xabcdef1234567890abcdef1234567890abcdef12",
          transactionHash: "0x123...abc",
          blockNumber: BigInt(1234567),
          gasUsed: BigInt(21000),
        });
      }
    });

    it("should return error result when operation fails", async () => {
      mockValidateNetworkPrerequisites.mockRejectedValue(new Error("Network error"));

      const result = await safeAddComposeHash(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("isRequestError" in result.error).toBe(true);
        expect(result.error.status).toBe(500);
        expect(result.error.message).toBe("Network error");
      }
    });

    it("should return error result for validation failures", async () => {
      const invalidRequest = {
        ...validRequest,
        privateKey: undefined,
      };

      const result = await safeAddComposeHash(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect("isRequestError" in result.error).toBe(true);
        expect(result.error.message).toContain("Either 'privateKey' or 'walletClient'");
      }
    });

    it("should work with custom schema", async () => {
      const customSchema = z.object({
        composeHash: z.string(),
        transactionHash: z.string(),
      });

      const result = await safeAddComposeHash(validRequest, { schema: customSchema });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          transactionHash: "0x123...abc",
        });
      }
    });

    it("should return raw data when schema is false", async () => {
      const result = await safeAddComposeHash(validRequest, { schema: false });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          appAuthAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
          appId: "0xabcdef1234567890abcdef1234567890abcdef12",
          transactionHash: "0x123...abc",
          blockNumber: BigInt(1234567),
          gasUsed: BigInt(21000),
        });
      }
    });

    it("should work without parameters", async () => {
      const result = await safeAddComposeHash(validRequest);

      expect(result.success).toBe(true);
    });

    it("should work with empty parameters object", async () => {
      const result = await safeAddComposeHash(validRequest, {});

      expect(result.success).toBe(true);
    });
  });

  describe("Schema Flexibility", () => {
    it("should allow extra fields in transaction receipt for forward compatibility", async () => {
      // Mock receipt with extra fields
      const receiptWithExtra = {
        ...mockReceipt,
        // Extra fields that might be added in future versions
        extraField1: "future-value",
        extraField2: { nested: "data" },
      };

      mockTransactionTracker.execute.mockResolvedValue({
        hash: "0x123...abc" as `0x${string}`,
        receipt: receiptWithExtra,
        success: true,
      });

      const result = await addComposeHash(validRequest);

      expect(result).toBeDefined();
      expect(result.composeHash).toBe("0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
    });

    it("should handle ComposeHashAdded event when present", async () => {
      mockParseEventLogs.mockReturnValue([
        {
          address: "0x1234567890abcdef1234567890abcdef12345678" as `0x${string}`,
          blockHash: "0xabcd1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd" as `0x${string}`,
          blockNumber: BigInt(1234567),
          data: "0x" as `0x${string}`,
          logIndex: 0,
          transactionHash: "0x123...abc" as `0x${string}`,
          transactionIndex: 0,
          removed: false,
          args: {
            composeHash: "0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          },
          eventName: "ComposeHashAdded",
          topics: [] as const,
        },
      ]);

      const result = await addComposeHash(validRequest);

      expect(result).toBeDefined();
      expect(mockParseEventLogs).toHaveBeenCalledWith({
        abi: expect.arrayContaining([
          expect.objectContaining({
            name: "ComposeHashAdded",
            type: "event",
          }),
        ]),
        eventName: "ComposeHashAdded",
        logs: [],
        strict: false,
      });
    });
  });

  describe("Type Inference", () => {
    it("should infer correct types for default schema", async () => {
      const result = await addComposeHash(validRequest);

      // Type-level assertion
      type ResultType = typeof result;
      type ExpectedType = {
        composeHash: string;
        appAuthAddress: string;
        appId: string;
        transactionHash: string;
        blockNumber?: bigint;
        gasUsed?: bigint;
      };
      const isExpected: ResultType extends ExpectedType ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct types for custom schema", async () => {
      const customSchema = z.object({ composeHash: z.string() });
      const result = await addComposeHash(validRequest, { schema: customSchema });

      // Type-level assertion
      type ResultType = typeof result;
      type ExpectedType = { composeHash: string };
      const isExpected: ResultType extends ExpectedType ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer unknown type when schema is false", async () => {
      const result = await addComposeHash(validRequest, { schema: false });

      // Type-level assertion  
      type ResultType = typeof result;
      type ExpectedType = unknown;
      const isExpected: ResultType extends ExpectedType ? true : false = true;
      expect(isExpected).toBe(true);
    });
  });

  describe("Safe Version Type Inference", () => {
    it("should infer correct SafeResult types for default schema", async () => {
      const result = await safeAddComposeHash(validRequest);

      // Type-level assertion
      type ResultType = typeof result;
      type ExpectedSuccessType = {
        success: true;
        data: {
          composeHash: string;
          appAuthAddress: string;
          appId: string;
          transactionHash: string;
          blockNumber?: bigint;
          gasUsed?: bigint;
        };
      };
      type ExpectedErrorType = {
        success: false;
        error: { isRequestError: true; message: string; status: number; detail: string };
      };
      type ExpectedType = ExpectedSuccessType | ExpectedErrorType;
      const isExpected: ResultType extends ExpectedType ? true : false = true;
      expect(isExpected).toBe(true);
    });

    it("should infer correct SafeResult types for custom schema", async () => {
      const customSchema = z.object({ composeHash: z.string() });
      const result = await safeAddComposeHash(validRequest, { schema: customSchema });

      // Type-level assertion
      type ResultType = typeof result;
      type ExpectedSuccessType = {
        success: true;
        data: { composeHash: string };
      };
      type ExpectedErrorType = {
        success: false;
        error: { isRequestError: true; message: string; status: number; detail: string };
      };
      type ExpectedType = ExpectedSuccessType | ExpectedErrorType;
      const isExpected: ResultType extends ExpectedType ? true : false = true;
      expect(isExpected).toBe(true);
    });
  });
}); 