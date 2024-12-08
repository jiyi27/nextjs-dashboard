import type { NextAuthConfig } from 'next-auth';

// The authorized callback is used to verify if the request is authorized to access a page via Next.js Middleware.
// It is called before a request is completed, and it receives an object with the auth and request properties.
// The auth property contains the user's session, and the request property contains the incoming request.
export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                return isLoggedIn;
            } else if (isLoggedIn) {
                // Redirect unauthenticated users to login page
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
    },
    providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;