namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_VERCEL_URL: string;
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    CIRCLE_API_KEY: string;
    NEXT_PUBLIC_CIRCLE_CLIENT_URL: string;
    NEXT_PUBLIC_CIRCLE_CLIENT_KEY: string;
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    STRIPE_SECRET_KEY: string;
  }
}
