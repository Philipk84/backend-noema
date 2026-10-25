export const NotificationEvents = {
  PROFILE_FOLLOWED: 'profile.followed',
  COMMENT_CREATED: 'comment.created',
  REACTION_CREATED: 'reaction.created',
  POST_CREATED: 'post.created',
  MEMBERSHIP_REQUESTED: 'membership.requested',
  MEMBERSHIP_APPROVED: 'membership.approved',
} as const;

export interface ProfileFollowedEvent {
  followerId: number;
  followedId: number;
}

export interface CommentCreatedEvent {
  commentId: number;
  actorId: number;
  /** Autor del artículo o propietario del post comentado. */
  ownerId: number;
  /** Autor del comentario al que se responde, si es una respuesta. */
  parentAuthorId: number | null;
}

export interface ReactionCreatedEvent {
  actorId: number;
  /** Dueño del recurso que recibió la reacción. */
  ownerId: number;
  targetType: 'article' | 'post' | 'comment';
  targetId: number;
}

export interface PostCreatedEvent {
  postId: number;
  actorId: number;
  postType: 'ORIGINAL' | 'REPLY' | 'REPOST' | 'QUOTE';
  communityId: number | null;
  /** Propietario del post al que se responde, cuando es una respuesta. */
  parentOwnerId: number | null;
}

export interface MembershipRequestedEvent {
  communityId: number;
  actorId: number;
  /** Propietario de la comunidad, quien debe aprobar la solicitud. */
  ownerId: number;
}

export interface MembershipApprovedEvent {
  communityId: number;
  /** Propietario o moderador que aprobó. */
  actorId: number;
  /** Perfil cuya solicitud fue aprobada. */
  recipientId: number;
}