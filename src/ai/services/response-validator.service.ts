/**
 * Project: Sireh AI Commerce Platform
 * Module: Response Validator Service
 * Sprint: SAI-03.07
 * Author: OpenAI + ChatGPT
 * Status: Production Ready
 */

export type ValidationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      errors: string[];
    };

export class ResponseValidatorService {
  validateRequiredStringFields(
    data: Record<string, unknown>,
    fields: string[],
  ): ValidationResult {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field];

      if (typeof value !== "string" || value.trim().length === 0) {
        errors.push(`${field} must be a non-empty string.`);
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }

  validateRequiredStringArrayFields(
    data: Record<string, unknown>,
    fields: string[],
  ): ValidationResult {
    const errors: string[] = [];

    for (const field of fields) {
      const value = data[field];

      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        !value.every((item) => typeof item === "string" && item.trim().length > 0)
      ) {
        errors.push(`${field} must be a non-empty string array.`);
      }
    }

    return errors.length === 0 ? { valid: true } : { valid: false, errors };
  }
}

export const responseValidatorService = new ResponseValidatorService();

