export interface JwtPayload {
  sub: number;
  email: string;
  roles: string[];
  permissions: string[];
  jti: string;
  iat?: number;
  exp?: number;
}
