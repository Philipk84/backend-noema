import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { bootstrapApp, createUserWithProfile } from './helpers';

describe('Integración de módulos (supertest)', () => {
  let app: INestApplication<App>;
  let http: App;
  let tokenA: string;
  let tokenB: string;
  let profileBId: number;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await bootstrapApp();
    http = app.getHttpServer();
    tokenA = (await createUserWithProfile(http, 'a@noema.test', 'perfil_a'))
      .token;
    const b = await createUserWithProfile(http, 'b@noema.test', 'perfil_b');
    tokenB = b.token;
    profileBId = b.profileId;
  });

  afterAll(async () => {
    await app.close();
  });

  async function publishArticle(title: string) {
    const created = await request(http)
      .post('/articles')
      .set(auth(tokenA))
      .send({ title, content: 'Contenido' })
      .expect(201);
    const id = created.body.id as number;
    await request(http).get(`/articles/${id}`).expect(404);
    await request(http)
      .patch(`/articles/${id}/status`)
      .set(auth(tokenA))
      .send({ status: 'PUBLISHED' })
      .expect(200);
    return id;
  }

  it('articles: el borrador no es público y se publica; no se reseña el propio', async () => {
    const id = await publishArticle('Artículo de prueba');
    await request(http).get(`/articles/${id}`).expect(200);
    await request(http)
      .post('/reviews')
      .set(auth(tokenA))
      .send({ articleId: id, rating: 5 })
      .expect(400);
  });

  it('social: una respuesta incrementa commentCount y una reacción se contabiliza', async () => {
    const post = await request(http)
      .post('/posts')
      .set(auth(tokenA))
      .send({ content: 'Mi primer post' })
      .expect(201);
    await request(http)
      .post('/posts')
      .set(auth(tokenA))
      .send({
        postType: 'REPLY',
        parentPostId: post.body.id,
        content: 'Una respuesta',
      })
      .expect(201);
    const detail = await request(http)
      .get(`/posts/${post.body.id}`)
      .expect(200);
    expect(detail.body.commentCount).toBe(1);

    await request(http)
      .put(`/reactions/post/${post.body.id}`)
      .set(auth(tokenB))
      .send({ type: 'LIKE' })
      .expect(200);
    const reactions = await request(http)
      .get(`/reactions/post/${post.body.id}`)
      .expect(200);
    expect(reactions.body.total).toBe(1);
  });

  it('communities: otro usuario se une como ACTIVE pero no puede editar', async () => {
    const community = await request(http)
      .post('/communities')
      .set(auth(tokenA))
      .send({ name: 'Club de prueba', topic: 'Pruebas', tags: ['NestJS'] })
      .expect(201);
    const join = await request(http)
      .post(`/communities/${community.body.id}/members`)
      .set(auth(tokenB))
      .expect(201);
    expect(join.body.status).toBe('ACTIVE');
    await request(http)
      .patch(`/communities/${community.body.id}`)
      .set(auth(tokenB))
      .send({ description: 'X' })
      .expect(403);
  });

  it('monetization: el pago rechazado da 402 y no se puede suscribir dos veces', async () => {
    const plan = await request(http)
      .post('/plans')
      .set(auth(tokenA))
      .send({
        name: 'Plan de prueba',
        price: 5.5,
        currency: 'usd',
        billingPeriod: 'MONTHLY',
      })
      .expect(201);
    await request(http)
      .post('/subscriptions')
      .set(auth(tokenB))
      .send({
        planId: plan.body.id,
        paymentMethod: 'CARD',
        paymentToken: 'tok_declined',
      })
      .expect(402);
    await request(http)
      .post('/subscriptions')
      .set(auth(tokenB))
      .send({ planId: plan.body.id, paymentMethod: 'CARD' })
      .expect(201);
    await request(http)
      .post('/subscriptions')
      .set(auth(tokenB))
      .send({ planId: plan.body.id, paymentMethod: 'CARD' })
      .expect(409);
  });

  it('reading: favorito, progreso completado y lista privada oculta a anónimos', async () => {
    const articleId = await publishArticle('Artículo para leer');
    await request(http)
      .post(`/favorites/${articleId}`)
      .set(auth(tokenA))
      .expect(201);
    const progress = await request(http)
      .put(`/progress/${articleId}`)
      .set(auth(tokenA))
      .send({ percentage: 100 })
      .expect(200);
    expect(progress.body.isCompleted).toBe(true);

    const list = await request(http)
      .post('/reading-lists')
      .set(auth(tokenA))
      .send({ name: 'Pendientes' })
      .expect(201);
    await request(http)
      .post(`/reading-lists/${list.body.id}/items`)
      .set(auth(tokenA))
      .send({ articleId })
      .expect(201);
    await request(http).get(`/reading-lists/${list.body.id}`).expect(404);
  });

  it('articles: las etiquetas se normalizan y permiten filtrar el listado', async () => {
    const id = await publishArticle('Artículo con etiquetas');
    await request(http)
      .put(`/article-tags/article/${id}`)
      .set(auth(tokenA))
      .send({ tags: ['NestJS', ' nestjs ', 'TypeORM'] })
      .expect(200);
    const list = await request(http)
      .get('/articles?tag=nestjs&limit=100')
      .expect(200);
    expect(list.body.data.map((a: { id: number }) => a.id)).toContain(id);
  });

  it('social: se puede comentar un post y el autor lo borra', async () => {
    const post = await request(http)
      .post('/posts')
      .set(auth(tokenA))
      .send({ content: 'Post a borrar' })
      .expect(201);
    await request(http)
      .post('/comments')
      .set(auth(tokenB))
      .send({ postId: post.body.id, content: 'Un comentario' })
      .expect(201);
    await request(http)
      .delete(`/posts/${post.body.id}`)
      .set(auth(tokenA))
      .expect(204);
    await request(http).get(`/posts/${post.body.id}`).expect(404);
  });

  it('communities: un miembro vetado no puede volver a unirse', async () => {
    const community = await request(http)
      .post('/communities')
      .set(auth(tokenA))
      .send({ name: 'Club con veto', topic: 'Pruebas', tags: ['NestJS'] })
      .expect(201);
    await request(http)
      .post(`/communities/${community.body.id}/members`)
      .set(auth(tokenB))
      .expect(201);
    await request(http)
      .patch(`/communities/${community.body.id}/members/${profileBId}`)
      .set(auth(tokenA))
      .send({ status: 'BANNED' })
      .expect(200);
    await request(http)
      .post(`/communities/${community.body.id}/members`)
      .set(auth(tokenB))
      .expect(403);
  });

  it('monetization: el cobro queda PAID y la suscripción se puede cancelar', async () => {
    const plan = await request(http)
      .post('/plans')
      .set(auth(tokenA))
      .send({
        name: 'Plan para cancelar',
        price: 9,
        currency: 'usd',
        billingPeriod: 'MONTHLY',
      })
      .expect(201);
    const subscription = await request(http)
      .post('/subscriptions')
      .set(auth(tokenB))
      .send({ planId: plan.body.id, paymentMethod: 'CARD' })
      .expect(201);

    const payments = await request(http)
      .get('/payments')
      .set(auth(tokenB))
      .expect(200);
    expect(payments.body.data[0].status).toBe('PAID');

    const cancelled = await request(http)
      .post(`/subscriptions/${subscription.body.id}/cancel`)
      .set(auth(tokenB))
      .expect(200);
    expect(cancelled.body.status).toBe('CANCELLED');
  });

  it('reading: se puede crear un marcador sobre un artículo publicado', async () => {
    const articleId = await publishArticle('Artículo con marcador');
    await request(http)
      .post('/bookmarks')
      .set(auth(tokenA))
      .send({
        articleId,
        highlightedText: 'fragmento',
        startPosition: 0,
        endPosition: 9,
      })
      .expect(201);
  });
});
