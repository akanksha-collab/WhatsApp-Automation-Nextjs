import { getAuthCookie, verifyToken } from './jwt';

export interface Session {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export async function getSession(): Promise<Session | null> {
  const token = await getAuthCookie();
  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload) return null;

  return {
    user: {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
    },
  };
}

