import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { createServerClient } from '@ai-life-os/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-life-os/supabase';

export type ApiErrorType = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'INTERNAL_ERROR';

export interface ApiError {
  error: string;
  code: ApiErrorType;
  details?: unknown;
  requestId?: string;
}

export interface HandlerContext<TInput = unknown> {
  input: TInput;
  client: SupabaseClient<Database>;
  request: NextRequest;
}

type RouteHandler<TInput, TOutput> = (
  context: HandlerContext<TInput>
) => Promise<TOutput>;

interface CreateApiHandlerOptions<TInput, TOutput> {
  schema?: ZodSchema<TInput>;
  handler: RouteHandler<TInput, TOutput>;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

function createErrorResponse(
  type: ApiErrorType,
  message: string,
  status: number,
  details?: unknown,
  requestId?: string
): NextResponse<ApiError> {
  const body: ApiError = {
    error: message,
    code: type,
  };
  if (details !== undefined) {
    body.details = details;
  }
  if (requestId) {
    body.requestId = requestId;
  }
  return NextResponse.json(body, { status });
}

export function createApiHandler<TInput, TOutput>(
  options: CreateApiHandlerOptions<TInput, TOutput>
): (request: NextRequest) => Promise<NextResponse<TOutput | ApiError>> {
  const { schema, handler } = options;

  return async (request: NextRequest): Promise<NextResponse<TOutput | ApiError>> => {
    const requestId = generateRequestId();

    try {
      let input: TInput = undefined as TInput;

      if (schema) {
        const body = await request.json();
        const validation = schema.safeParse(body);
        if (!validation.success) {
          return createErrorResponse(
            'VALIDATION_ERROR',
            'Invalid request body',
            400,
            validation.error.flatten(),
            requestId
          );
        }
        input = validation.data;
      }

      const client = await createServerClient();

      const result = await handler({ input, client, request });

      return NextResponse.json(result);
    } catch (error) {
      // Handle Zod validation errors (for inline validation)
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.flatten(),
          requestId
        );
      }

      // Handle custom validation errors
      if (error instanceof ValidationError) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          error.message,
          400,
          undefined,
          requestId
        );
      }

      // Handle not found errors
      if (error instanceof NotFoundError) {
        return createErrorResponse(
          'NOT_FOUND',
          error.message,
          404,
          undefined,
          requestId
        );
      }

      // Log server errors for debugging
      console.error(`[${requestId}] API Error:`, error);

      return createErrorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        500,
        undefined,
        requestId
      );
    }
  };
}

// For GET requests that use query params instead of body
interface CreateGetHandlerOptions<TOutput> {
  handler: (context: Omit<HandlerContext<undefined>, 'input'> & { searchParams: URLSearchParams }) => Promise<TOutput>;
}

export function createGetHandler<TOutput>(
  options: CreateGetHandlerOptions<TOutput>
): (request: NextRequest) => Promise<NextResponse<TOutput | ApiError>> {
  const { handler } = options;

  return async (request: NextRequest): Promise<NextResponse<TOutput | ApiError>> => {
    const requestId = generateRequestId();

    try {
      const client = await createServerClient();
      const { searchParams } = new URL(request.url);

      const result = await handler({ client, request, searchParams });

      return NextResponse.json(result);
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid request data',
          400,
          error.flatten(),
          requestId
        );
      }

      // Handle custom validation errors
      if (error instanceof ValidationError) {
        return createErrorResponse(
          'VALIDATION_ERROR',
          error.message,
          400,
          undefined,
          requestId
        );
      }

      // Handle not found errors
      if (error instanceof NotFoundError) {
        return createErrorResponse(
          'NOT_FOUND',
          error.message,
          404,
          undefined,
          requestId
        );
      }

      console.error(`[${requestId}] API Error:`, error);

      return createErrorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        500,
        undefined,
        requestId
      );
    }
  };
}

// Helper for required query params
export function requireParam(
  searchParams: URLSearchParams,
  name: string
): string {
  const value = searchParams.get(name);
  if (!value) {
    throw new ValidationError(`${name} is required`);
  }
  return value;
}

// Custom error class for validation in handlers
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Custom error class for not found
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
