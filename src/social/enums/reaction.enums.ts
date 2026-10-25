export enum ReactionType {
  LIKE = 'LIKE',
  LOVE = 'LOVE',
  INSIGHTFUL = 'INSIGHTFUL',
}

/** Qué recurso recibe la reacción; se usa como segmento de la URL. */
export enum ReactionTargetType {
  ARTICLE = 'article',
  POST = 'post',
  COMMENT = 'comment',
}