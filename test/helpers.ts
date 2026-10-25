import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

export const PASSWORD = 'Password123';

async function ensureTestDatabase() {
  const admin = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await admin.initialize();
  const found = await admin.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [process.env.DB_NAME],
  );
  if (found.length === 0) {
    await admin.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
  }
  await admin.destroy();
}

export async function bootstrapApp(): Promise<INestApplication<App>> {
  await ensureTestDatabase();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  const dataSource = app.get(DataSource);
  await dataSource.synchronize(true);
  await dataSource.query(
    readFileSync(join(__dirname, '../db/seed-auth.sql'), 'utf8'),
  );
  return app;
}

export async function registerAndLogin(http: App, email: string) {
  await request(http)
    .post('/users')
    .send({ email, password: PASSWORD, roleIds: [2] })
    .expect(201);
  const res = await request(http)
    .post('/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return res.body.access_token as string;
}

export async function createProfile(
  http: App,
  token: string,
  username: string,
) {
  const res = await request(http)
    .post('/profiles')
    .set('Authorization', `Bearer ${token}`)
    .send({ username, name: username })
    .expect(201);
  return res.body.id as number;
}

export async function createUserWithProfile(
  http: App,
  email: string,
  username: string,
) {
  const token = await registerAndLogin(http, email);
  const profileId = await createProfile(http, token, username);
  return { token, profileId };
}
