import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getPrisma } from './prisma';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  cafeId: string;
}

interface AuthToken {
  role?: string;
  id?: string;
  cafeId?: string;
  name?: string;
  email?: string;
  sub?: string;
  iat?: number;
  exp?: number;
  jti?: string;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours — forces re-login daily
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const prisma = getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          cafeId: user.cafeId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as unknown as AuthUser;
        token.role = authUser.role;
        token.id = authUser.id;
        token.cafeId = authUser.cafeId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const authToken = token as unknown as AuthToken;
        (session.user as unknown as AuthUser).role = authToken.role || '';
        (session.user as unknown as AuthUser).id = authToken.id || '';
        (session.user as unknown as AuthUser).cafeId = authToken.cafeId || '';
      }
      return session;
    },
  },
  pages: {
    signIn: '/staff/login',
  },
};