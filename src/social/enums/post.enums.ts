export enum PostType {
  ORIGINAL = 'ORIGINAL',
  REPLY = 'REPLY',
  REPOST = 'REPOST',
  QUOTE = 'QUOTE',
}

export enum PostVisibility {
  PUBLIC = 'PUBLIC',
  FOLLOWERS = 'FOLLOWERS',
  // Solo miembros activos de la comunidad del post
  COMMUNITY = 'COMMUNITY',
}