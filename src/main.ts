import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Wallet Service API')
    .setDescription(
      'Backend wallet service with Paystack integration, JWT authentication, and API key management',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token from Google sign-in',
      },
      'access-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'API key for service-to-service access',
      },
      'api-key',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
  console.log(
    `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
  );
  console.log(
    `Swagger docs available at: http://localhost:${process.env.PORT ?? 3000}/api/docs`,
  );
}
bootstrap();
