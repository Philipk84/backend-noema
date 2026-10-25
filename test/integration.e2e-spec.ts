import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  bootstrapApp,
  createUserWithProfile,
  PASSWORD,
  registerAndLogin,
} from './helpers';

describe('Integración (supertest)', () => {
  let app: INestApplication<App>;
  let http: App;
  let tokenA: string;
  let tokenB: string;
  let profileAId: number;

  beforeAll(async () => {
    app = await bootstrapApp();
    http = app.getHttpServer();

    const a = await createUserWithProfile(http, 'a@noema.test', 'perfil_a');
    const b = await createUserWithProfile(http, 'b@noema.test', 'perfil_b');
    tokenA = a.token;
    tokenB = b.token;
    profileAId = a.profileId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('login del admin devuelve un JWT y una contraseña errónea da 401', async () => {
    const ok = await request(http)
      .post('/auth/login')
      .send({ email: 'admin@noema.com', password: 'Admin12345' })
      .expect(200);
    expect(ok.body.access_token).toEqual(expect.any(String));

    await request(http)
      .post('/auth/login')
      .send({ email: 'admin@noema.com', password: 'incorrecta' })
      .expect(401);
  });

  it('el registro valida el cuerpo y las rutas protegidas exigen token', async () => {
    await request(http)
      .post('/users')
      .send({ email: 'no-es-correo', password: PASSWORD, roleIds: [2] })
      .expect(400);
    await request(http).get('/users').expect(401);
    await request(http)
      .get('/users')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);
  });

  it('seguir a un perfil incrementa su contador y rechaza el duplicado', async () => {
    await request(http)
      .post(`/follows/${profileAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);
    await request(http)
      .post(`/follows/${profileAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(409);

    const profile = await request(http)
      .get(`/profiles/${profileAId}`)
      .expect(200);
    expect(profile.body.followersCount).toBe(1);
  });

  it('el seguimiento genera una notificación que se puede marcar como leída', async () => {
    const list = await request(http)
      .get('/notifications?type=FOLLOW')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(list.body.total).toBe(1);
    const notificationId = list.body.data[0].id as number;

    const unread = await request(http)
      .get('/notifications/unread-count')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(unread.body.unread).toBe(1);

    await request(http)
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
    await request(http)
      .patch(`/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
  });

  it('dejar de seguir baja el contador y no se puede seguir a uno mismo', async () => {
    await request(http)
      .post(`/follows/${profileAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(400);
    await request(http)
      .delete(`/follows/${profileAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(204);

    const profile = await request(http)
      .get(`/profiles/${profileAId}`)
      .expect(200);
    expect(profile.body.followersCount).toBe(0);
  });

  it('read-all marca las notificaciones como leídas y una se puede borrar', async () => {
    await request(http)
      .post(`/follows/${profileAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);

    const readAll = await request(http)
      .post('/notifications/read-all')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(readAll.body.updated).toBe(1);

    const list = await request(http)
      .get('/notifications')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(http)
      .delete(`/notifications/${list.body.data[0].id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(204);
  });

  it('logout invalida el JWT', async () => {
    const token = await registerAndLogin(http, 'logout@noema.test');
    await request(http)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(http)
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(http)
      .get('/notifications')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('el admin crea permiso, rol y usuario, y el nombre repetido da 409', async () => {
    const admin = await request(http)
      .post('/auth/login')
      .send({ email: 'admin@noema.com', password: 'Admin12345' })
      .expect(200);
    const adminAuth = { Authorization: `Bearer ${admin.body.access_token}` };

    const permission = await request(http)
      .post('/permissions')
      .set(adminAuth)
      .send({ permissionName: 'permiso_prueba' })
      .expect(201);
    await request(http)
      .post('/permissions')
      .set(adminAuth)
      .send({ permissionName: 'permiso_prueba' })
      .expect(409);

    const role = await request(http)
      .post('/roles')
      .set(adminAuth)
      .send({ roleName: 'ROL_PRUEBA', permissionIds: [permission.body.id] })
      .expect(201);
    await request(http)
      .post('/users')
      .send({
        email: 'rol@noema.test',
        password: PASSWORD,
        roleIds: [role.body.id],
      })
      .expect(201);
  });

  it('el username de un perfil es único y /profiles/me devuelve el propio', async () => {
    const token = await registerAndLogin(http, 'dup@noema.test');
    await request(http)
      .post('/profiles')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'perfil_a', name: 'Duplicado' })
      .expect(409);

    const me = await request(http)
      .get('/profiles/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(me.body.username).toBe('perfil_a');
  });

  it('las preferencias se normalizan y se pueden leer', async () => {
    await request(http)
      .put('/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ tags: ['NestJS', ' nestjs ', 'TypeORM'] })
      .expect(200);
    const res = await request(http)
      .get('/preferences')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body).toEqual(['nestjs', 'typeorm']);
  });
});
