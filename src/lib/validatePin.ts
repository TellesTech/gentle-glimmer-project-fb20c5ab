import { supabase } from '@/integrations/supabase/client';

export interface ValidatePinSuccess {
  success: true;
  token_hash: string;
  email: string;
}

export interface ValidatePinFailure {
  success: false;
  error: string;
  retryable?: boolean;
}

export type ValidatePinResult = ValidatePinSuccess | ValidatePinFailure;

export function isValidatePinFailure(result: ValidatePinResult): result is ValidatePinFailure {
  return result.success === false;
}

export function isValidatePinSuccess(result: ValidatePinResult): result is ValidatePinSuccess {
  return result.success === true;
}

const retryDelays = [500, 1200, 2500];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getErrorMessage(error: unknown) {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  return String(error);
}

function isRetryableFailure(error: unknown, data: Partial<ValidatePinFailure> | null) {
  const message = `${data?.error ?? ''} ${getErrorMessage(error)}`.toLowerCase();

  return Boolean(data?.retryable) || message.includes('temporariamente indisponível') || message.includes('503');
}

export async function validatePinWithRetry(
  payload: { userId?: string; email?: string; pin: string },
  attempts = retryDelays.length,
): Promise<ValidatePinResult> {
  let lastFailure: ValidatePinFailure = {
    success: false,
    error: 'Não foi possível validar o PIN.',
  };

  for (let attempt = 0; attempt < attempts; attempt++) {
    const { data, error } = await supabase.functions.invoke('validate-pin', {
      body: payload,
    });

    const response = (data ?? null) as Partial<ValidatePinResult> | null;

    if (!error && response?.success && typeof response.token_hash === 'string' && typeof response.email === 'string') {
      return {
        success: true,
        token_hash: response.token_hash,
        email: response.email,
      };
    }

    const failureData = response && response.success === false ? response : null;
    lastFailure = {
      success: false,
      error: failureData?.error || getErrorMessage(error) || 'Não foi possível validar o PIN.',
      retryable: isRetryableFailure(error, failureData),
    };

    if (!lastFailure.retryable || attempt === attempts - 1) {
      return lastFailure;
    }

    await wait(retryDelays[attempt]);
  }

  return lastFailure;
}