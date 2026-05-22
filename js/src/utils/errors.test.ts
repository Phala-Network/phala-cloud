import { describe, it, expect } from "vitest";
import {
  parseApiError,
  PhalaCloudError,
  RequestError,
  ResourceError,
  ValidationError,
  AuthError,
  BusinessError,
  ServerError,
  UnknownError,
  getValidationFields,
  formatValidationErrors,
  formatErrorMessage,
  formatStructuredError,
} from "./errors";

describe("parseApiError", () => {
  describe("422 Validation Errors", () => {
    it("should return ValidationError instance", () => {
      const requestError = new RequestError("Validation error", {
        status: 422,
        statusText: "Unprocessable Entity",
        detail: [
          {
            loc: ["body", "name"],
            msg: "String should have at least 4 characters",
            type: "string_too_short",
            ctx: { min_length: 4 },
          },
        ],
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(ValidationError);
      expect(parsed).toBeInstanceOf(PhalaCloudError);
      expect(parsed.status).toBe(422);
      expect(parsed.message).toBe("Validation failed: String should have at least 4 characters");

      if (parsed instanceof ValidationError) {
        expect(parsed.validationErrors).toHaveLength(1);
        expect(parsed.validationErrors[0]).toEqual({
          field: "name",
          message: "String should have at least 4 characters",
          type: "string_too_short",
          context: { min_length: 4 },
        });
      }
    });

    it("should parse multiple validation errors", () => {
      const requestError = new RequestError("Validation error", {
        status: 422,
        detail: [
          {
            loc: ["body", "name"],
            msg: "String should have at least 4 characters",
            type: "string_too_short",
          },
          {
            loc: ["body", "memory"],
            msg: "Input should be greater than or equal to 1024",
            type: "greater_than_equal",
          },
          {
            loc: ["body", "disk_size"],
            msg: "Input should be less than or equal to 10240",
            type: "less_than_equal",
          },
        ],
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(ValidationError);
      expect(parsed.message).toBe("Validation failed (3 issues)");

      if (parsed instanceof ValidationError) {
        expect(parsed.validationErrors).toHaveLength(3);
        expect(parsed.validationErrors[0]!.field).toBe("name");
        expect(parsed.validationErrors[1]!.field).toBe("memory");
        expect(parsed.validationErrors[2]!.field).toBe("disk_size");
      }
    });

    it("should handle nested field paths", () => {
      const requestError = new RequestError("Validation error", {
        status: 422,
        detail: [
          {
            loc: ["body", "resources", "compute", "memory"],
            msg: "Too low",
            type: "value_error",
          },
        ],
      });

      const parsed = parseApiError(requestError);

      if (parsed instanceof ValidationError) {
        expect(parsed.validationErrors[0]!.field).toBe("resources.compute.memory");
      }
    });

    it("should handle query parameter errors", () => {
      const requestError = new RequestError("Validation error", {
        status: 422,
        detail: [
          {
            loc: ["query", "page"],
            msg: "Input should be greater than 0",
            type: "greater_than",
          },
        ],
      });

      const parsed = parseApiError(requestError);

      if (parsed instanceof ValidationError) {
        expect(parsed.validationErrors[0]!.field).toBe("page");
      }
    });
  });

  describe("400 Business Errors", () => {
    it("should return BusinessError instance with string detail", () => {
      const requestError = new RequestError("Bad Request", {
        status: 400,
        statusText: "Bad Request",
        detail: "Insufficient balance. You need at least $1 to launch a CVM.",
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(BusinessError);
      expect(parsed).toBeInstanceOf(PhalaCloudError);
      expect(parsed.status).toBe(400);
      expect(parsed.message).toBe("Insufficient balance. You need at least $1 to launch a CVM.");
    });

    it("should parse object detail with message", () => {
      const requestError = new RequestError("Bad Request", {
        status: 400,
        detail: {
          message: "Node not available",
          code: "NODE_NOT_FOUND",
        },
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(BusinessError);
      expect(parsed.message).toBe("Node not available");
    });
  });

  describe("401/403 Auth Errors", () => {
    it("should return AuthError instance for 401", () => {
      const requestError = new RequestError("Unauthorized", {
        status: 401,
        detail: "Authentication required",
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(AuthError);
      expect(parsed).toBeInstanceOf(PhalaCloudError);
      expect(parsed.message).toBe("Authentication required");
    });

    it("should return AuthError instance for 403", () => {
      const requestError = new RequestError("Forbidden", {
        status: 403,
        detail: "You do not have permission to perform this action",
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(AuthError);
      expect(parsed.message).toBe("You do not have permission to perform this action");
    });
  });

  describe("500 Server Errors", () => {
    it("should return ServerError instance", () => {
      const requestError = new RequestError("Internal Server Error", {
        status: 500,
        detail: "An unexpected error occurred",
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(ServerError);
      expect(parsed).toBeInstanceOf(PhalaCloudError);
      expect(parsed.message).toBe("An unexpected error occurred");
    });
  });

  describe("Unknown Errors", () => {
    it("should return UnknownError instance for missing status", () => {
      const requestError = new RequestError("Network error", {
        detail: "Failed to fetch",
      });

      const parsed = parseApiError(requestError);

      expect(parsed).toBeInstanceOf(UnknownError);
      expect(parsed.status).toBe(0);
    });
  });
});

describe("instanceof type guards", () => {
  it("should allow instanceof checks for ValidationError", () => {
    const requestError = new RequestError("Validation error", {
      status: 422,
      detail: [{ loc: ["body", "name"], msg: "Too short", type: "string_too_short" }],
    });

    const error = parseApiError(requestError);

    if (error instanceof ValidationError) {
      // TypeScript should know validationErrors exists
      expect(error.validationErrors).toBeDefined();
      expect(error.validationErrors[0]!.field).toBe("name");
    } else {
      throw new Error("Expected ValidationError");
    }
  });

  it("should allow instanceof checks for AuthError", () => {
    const requestError = new RequestError("Unauthorized", {
      status: 401,
      detail: "Authentication required",
    });

    const error = parseApiError(requestError);

    if (error instanceof AuthError) {
      expect(error.status).toBe(401);
    } else {
      throw new Error("Expected AuthError");
    }
  });

  it("should allow instanceof checks for BusinessError", () => {
    const requestError = new RequestError("Bad Request", {
      status: 400,
      detail: "Insufficient balance",
    });

    const error = parseApiError(requestError);

    if (error instanceof BusinessError) {
      expect(error.status).toBe(400);
    } else {
      throw new Error("Expected BusinessError");
    }
  });
});

describe("getValidationFields", () => {
  it("should extract field names from ValidationError", () => {
    const requestError = new RequestError("Validation error", {
      status: 422,
      detail: [
        { loc: ["body", "name"], msg: "Too short", type: "string_too_short" },
        { loc: ["body", "memory"], msg: "Too low", type: "greater_than_equal" },
      ],
    });

    const error = parseApiError(requestError);
    const fields = getValidationFields(error);

    expect(fields).toEqual(["name", "memory"]);
  });

  it("should return empty array for non-validation errors", () => {
    const requestError = new RequestError("Bad Request", {
      status: 400,
      detail: "Error",
    });

    const error = parseApiError(requestError);
    const fields = getValidationFields(error);

    expect(fields).toEqual([]);
  });
});

describe("formatValidationErrors", () => {
  const errors = [
    { field: "name", message: "String should have at least 4 characters", type: "string_too_short" },
    { field: "memory", message: "Input should be greater than or equal to 1024", type: "greater_than_equal" },
  ];

  it("should format with numbers and fields", () => {
    const formatted = formatValidationErrors(errors);
    expect(formatted).toBe(
      "  1. name: String should have at least 4 characters\n" +
      "  2. memory: Input should be greater than or equal to 1024"
    );
  });

  it("should format without numbers", () => {
    const formatted = formatValidationErrors(errors, { numbered: false });
    expect(formatted).toBe(
      "  • name: String should have at least 4 characters\n" +
      "  • memory: Input should be greater than or equal to 1024"
    );
  });

  it("should format without field names", () => {
    const formatted = formatValidationErrors(errors, { showFields: false });
    expect(formatted).toBe(
      "  1. String should have at least 4 characters\n" +
      "  2. Input should be greater than or equal to 1024"
    );
  });

  it("should use custom indent", () => {
    const formatted = formatValidationErrors(errors, { indent: 4 });
    expect(formatted).toContain("    1. name:");
  });
});

describe("formatErrorMessage", () => {
  it("should format ValidationError with multiple issues", () => {
    const requestError = new RequestError("Validation error", {
      status: 422,
      detail: [
        { loc: ["body", "name"], msg: "Too short", type: "string_too_short" },
        { loc: ["body", "memory"], msg: "Too low", type: "greater_than_equal" },
      ],
    });

    const error = parseApiError(requestError);
    const formatted = formatErrorMessage(error);

    expect(formatted).toContain("Validation failed (2 issues)");
    expect(formatted).toContain("1. name: Too short");
    expect(formatted).toContain("2. memory: Too low");
  });

  it("should format BusinessError without validation details", () => {
    const requestError = new RequestError("Bad Request", {
      status: 400,
      detail: "Insufficient balance",
    });

    const error = parseApiError(requestError);
    const formatted = formatErrorMessage(error);

    expect(formatted).toBe("Insufficient balance");
  });

  it("should include error class name when showType is true", () => {
    const requestError = new RequestError("Bad Request", {
      status: 400,
      detail: "Insufficient balance",
    });

    const error = parseApiError(requestError);
    const formatted = formatErrorMessage(error, { showType: true });

    expect(formatted).toContain("[BUSINESSERROR]");
  });
});

describe("Error type discriminator properties", () => {
  it("should have isValidationError property", () => {
    const requestError = new RequestError("Validation error", {
      status: 422,
      detail: [{ loc: ["body", "name"], msg: "Too short", type: "string_too_short" }],
    });

    const error = parseApiError(requestError);

    if (error.isValidationError) {
      // TypeScript should know this is ValidationError
      expect(error.validationErrors).toBeDefined();
      expect(error.validationErrors).toHaveLength(1);
    } else {
      throw new Error("Expected ValidationError");
    }
  });

  it("should have isAuthError property", () => {
    const requestError = new RequestError("Unauthorized", {
      status: 401,
      detail: "Authentication required",
    });

    const error = parseApiError(requestError);

    if (error.isAuthError) {
      expect(error.status).toBe(401);
    } else {
      throw new Error("Expected AuthError");
    }
  });

  it("should have isBusinessError property", () => {
    const requestError = new RequestError("Bad Request", {
      status: 400,
      detail: "Insufficient balance",
    });

    const error = parseApiError(requestError);

    if (error.isBusinessError) {
      expect(error.status).toBe(400);
    } else {
      throw new Error("Expected BusinessError");
    }
  });

  it("should have isServerError property", () => {
    const requestError = new RequestError("Internal Server Error", {
      status: 500,
      detail: "Unexpected error",
    });

    const error = parseApiError(requestError);

    if (error.isServerError) {
      expect(error.status).toBe(500);
    } else {
      throw new Error("Expected ServerError");
    }
  });

  it("should have isUnknownError property", () => {
    const requestError = new RequestError("Network error", {
      detail: "Failed to fetch",
    });

    const error = parseApiError(requestError);

    if (error.isUnknownError) {
      expect(error.status).toBe(0);
    } else {
      throw new Error("Expected UnknownError");
    }
  });

  it("should only have one discriminator property set", () => {
    const requestError = new RequestError("Validation error", {
      status: 422,
      detail: [{ loc: ["body", "name"], msg: "Too short", type: "string_too_short" }],
    });

    const error = parseApiError(requestError);

    // Only isValidationError should be true
    expect(error.isValidationError).toBe(true);
    expect(error.isAuthError).toBeUndefined();
    expect(error.isBusinessError).toBeUndefined();
    expect(error.isServerError).toBeUndefined();
    expect(error.isUnknownError).toBeUndefined();
  });
});

describe("RequestError.fromFetchError with StructuredError responses", () => {
  function makeStructuredFetchError(status: number) {
    return {
      message: `[PATCH] "/api/cvms/abc123/envs": ${status} <none>`,
      status,
      statusText: "",
      data: {
        error_code: "ERR-01-005",
        message: "Compose hash registration required on-chain",
        request_id: "rid-body-123",
        details: [
          { field: "compose_hash", value: "0xhash123", message: null },
          { field: "app_id", value: "0xapp456", message: null },
          { field: "device_id", value: "0xdevice789", message: null },
          {
            field: "kms_info",
            value: {
              id: "kms_test",
              slug: "kms-base-prod9",
              url: "https://kms.example.com",
              version: "v0.5.7",
              chain_id: 8453,
              kms_contract_address: "0xkms123",
              gateway_app_id: "0xgateway456",
            },
            message: null,
          },
        ],
        suggestions: ["Register the compose hash on-chain"],
        links: [{ url: "https://docs.example.com", label: "Docs" }],
      },
      request: "/api/cvms/abc123/envs",
      response: {} as Response,
    } as unknown;
  }

  it("should preserve StructuredError data as detail when ApiErrorSchema.detail is undefined", () => {
    const fetchError = makeStructuredFetchError(465);
    const requestError = RequestError.fromFetchError(fetchError as never);

    // detail should be the full StructuredError object, not undefined or a string
    expect(requestError.detail).toBeDefined();
    expect(typeof requestError.detail).toBe("object");

    const detail = requestError.detail as Record<string, unknown>;
    expect(detail.error_code).toBe("ERR-01-005");
    expect(detail.request_id).toBe("rid-body-123");
    expect(detail.details).toBeDefined();
    expect(Array.isArray(detail.details)).toBe(true);
  });

  it("should produce ResourceError when parsed through parseApiError", () => {
    const fetchError = makeStructuredFetchError(465);
    const requestError = RequestError.fromFetchError(fetchError as never);
    const error = parseApiError(requestError);

    expect(error).toBeInstanceOf(ResourceError);
    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toBeInstanceOf(PhalaCloudError);
    expect(error.status).toBe(465);
    expect(error.requestId).toBe("rid-body-123");

    // detail should still contain the StructuredError object
    expect(error.detail).toBeDefined();
    expect(typeof error.detail).toBe("object");
    const detail = error.detail as Record<string, unknown>;
    expect(detail.error_code).toBe("ERR-01-005");
    expect(detail.request_id).toBe("rid-body-123");
    expect(Array.isArray(detail.details)).toBe(true);
  });

  it("should use X-Request-ID header when structured body omits request_id", () => {
    const fetchError = makeStructuredFetchError(465) as Record<string, unknown>;
    const data = fetchError.data as Record<string, unknown>;
    delete data.request_id;
    fetchError.response = {
      headers: new Headers({ "X-Request-ID": "rid-header-456" }),
    } as Response;

    const requestError = RequestError.fromFetchError(fetchError as never);
    const error = parseApiError(requestError);

    expect(error).toBeInstanceOf(ResourceError);
    expect(error.requestId).toBe("rid-header-456");
    expect(formatStructuredError(error as ResourceError)).toContain("Request ID: rid-header-456");
  });
});

describe("RequestError.fromFetchError with timeout/network errors", () => {
  it("should produce a friendly Request Timeout error when ofetch aborts on timeout", () => {
    const timeoutCause = Object.assign(
      new Error("[TimeoutError]: The operation was aborted due to timeout"),
      { name: "TimeoutError", code: 23 },
    );
    const fetchError = {
      message:
        '[POST] "/api/v1/status/batch": <no response> [TimeoutError]: The operation was aborted due to timeout',
      status: undefined,
      statusText: undefined,
      data: undefined,
      request: "/api/v1/status/batch",
      response: undefined,
      cause: timeoutCause,
    } as unknown;

    const requestError = RequestError.fromFetchError(fetchError as never);

    expect(requestError.code).toBe("TIMEOUT");
    expect(requestError.status).toBe(0);
    expect(requestError.statusText).toBe("Request Timeout");
    expect(requestError.message).toBe(
      "Request timed out. The server did not respond in time.",
    );
    expect(requestError.detail).toBe(
      "Request timed out. The server did not respond in time.",
    );
  });

  it("should detect timeout via message prefix when cause is missing", () => {
    const fetchError = {
      message: '[GET] "/api/v1/apps": <no response> [TimeoutError]: aborted',
      status: undefined,
      statusText: undefined,
      data: undefined,
      request: "/api/v1/apps",
      response: undefined,
    } as unknown;

    const requestError = RequestError.fromFetchError(fetchError as never);

    expect(requestError.code).toBe("TIMEOUT");
  });

  it("should expose code on the PhalaCloudError subclass via parseApiError", () => {
    const fetchError = {
      message: '[POST] "/api/v1/status/batch": <no response> [TimeoutError]',
      status: undefined,
      statusText: undefined,
      data: undefined,
      request: "/api/v1/status/batch",
      response: undefined,
      cause: Object.assign(new Error(""), { name: "TimeoutError" }),
    } as unknown;

    const requestError = RequestError.fromFetchError(fetchError as never);
    const error = parseApiError(requestError);

    // parseApiError must forward the code so downstream consumers (CLI, JS apps)
    // can discriminate timeouts without string matching on message/statusText.
    expect(error.code).toBe("TIMEOUT");
    expect(error.statusText).toBe("Request Timeout");
  });

  it("should preserve raw error message for non-timeout failures with no response body", () => {
    const fetchError = {
      message: '[GET] "/api/v1/apps": <no response> connect ECONNREFUSED',
      status: undefined,
      statusText: undefined,
      data: undefined,
      request: "/api/v1/apps",
      response: undefined,
    } as unknown;

    const requestError = RequestError.fromFetchError(fetchError as never);

    expect(requestError.code).toBeUndefined();
    expect(requestError.message).toContain("ECONNREFUSED");
    expect(requestError.detail).toContain("ECONNREFUSED");
    expect(requestError.detail).not.toBe("Unknown API error");
  });
});
