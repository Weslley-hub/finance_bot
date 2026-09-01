import { plainToInstance } from 'class-transformer';
import { IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsOptional()
  @IsNumber()
  PORT?: number;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  TELEGRAM_BOT_TOKEN?: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  ALLOWED_TELEGRAM_CHAT_IDS?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated;
}

export function isSecretConfigured(value?: string): boolean {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 && !trimmed.includes('CHANGE_ME');
}
