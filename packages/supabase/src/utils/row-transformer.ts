/**
 * Utility for transforming database rows to domain entities.
 *
 * This module provides a type-safe way to convert snake_case database columns
 * to camelCase TypeScript properties, handling optional fields and type coercion.
 */

/**
 * Transforms a value that may be null/undefined to undefined.
 * Used for optional fields where DB returns null but TypeScript expects undefined.
 */
export function nullToUndefined<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

/**
 * Transforms metadata JSON to the expected Record type.
 * Handles the case where metadata is stored as Json but expected as Record<string, unknown>.
 */
export function transformMetadata(
  metadata: unknown
): Record<string, unknown> | undefined {
  if (metadata === null || metadata === undefined) {
    return undefined;
  }
  return metadata as Record<string, unknown>;
}

/**
 * Common timestamp fields present on all entities.
 */
export interface TimestampFields {
  createdAt: string;
  updatedAt?: string;
}

/**
 * Extracts common timestamp fields from a database row.
 */
export function extractTimestamps(row: {
  created_at: string;
  updated_at?: string;
}): TimestampFields {
  return {
    createdAt: row.created_at,
    ...(row.updated_at !== undefined && { updatedAt: row.updated_at }),
  };
}
