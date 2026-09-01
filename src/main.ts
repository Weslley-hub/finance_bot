/* Copyright (c) 2026 Weslley Fernando Teixeira Chaves. Licensed under MIT. */
import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Finlar Bot API')
    .setDescription(
      'API do assistente financeiro Finlar via Telegram. Copyright (c) 2026 Weslley Fernando Teixeira Chaves. MIT.',
    )
    .setVersion('0.1.0')
    .setLicense('MIT', 'https://github.com/Weslley-hub/finance_bot/blob/main/LICENSE')
    .setContact(
      'Weslley Fernando Teixeira Chaves',
      'https://github.com/Weslley-hub',
      undefined,
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT') ?? 3000;

  await app.listen(port);
}

bootstrap();
