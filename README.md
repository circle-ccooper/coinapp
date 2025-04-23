# 💸 CirclePay P2P

Seamless, Gasless Transactions with Passkey Security and Instant Top-ups

## Get started

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```
2. Create Supabase Project (https://supabase.com/)
3. Create a Twilio Account and set up Twilio Verify for Phone Auth (https://console.twilio.com/us1/develop/verify/overview)
4. In Supabase go to Authentication -> Sign In/Up. Under Auth Providers disable Email and enable Phone and set up Twilio Verify settings. Set up a Test Phone Number and OTP.
5. Create a Stripe account and obtain secret and publishable keys
6. Go to Circle Modular Wallets Configurator (https://console.circle.com/wallets/modular/configurator) to get Client URL and setup Client Keys (API and Client) and Passkey Domain Name
7. Create a `.env` using `.env.example` as an example and add keys:

   ```ini
   # Deployment URL (e.g., https://your-app.vercel.app)
   VERCEL_URL=
   NEXT_PUBLIC_VERCEL_URL=

   # Supabase configuration (https://app.supabase.com/project/_/settings/api)
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=

   # Circle API configuration (https://console.circle.com/apikeys)
   CIRCLE_API_KEY=
   NEXT_PUBLIC_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl
   NEXT_PUBLIC_CIRCLE_CLIENT_KEY=

   # Stripe
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
   STRIPE_SECRET_KEY=
   ```

8. Link your local project to your Supabase cloud project and push the database schema:
   ```bash
   # Install Supabase CLI if you haven't already
   npm install supabase --save-dev

   # Link to your remote project - you'll need your project ID and database password
   npx supabase link --project-ref <project-id>

   # Push the database schema
   npx supabase db push
   ```
   > Note: You can find your project ID in your Supabase project settings under Project Settings > General

9. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The project should now be running on [localhost:3000](http://localhost:3000/).

10. With the project up and running, open an ngrok tunnel on the same port as of the local development server:

    ```bash
    ngrok http 3000
    ```

11. Configure the Circle webhook:
    1. Go to [Circle Webhooks Dashboard](https://console.circle.com/webhooks)
    2. Click "Add Webhook"
    3. Configure the following settings:
       - URL: Your ngrok URL + `/api/webhooks/circle` (e.g., `https://9940-170-239-106-57.ngrok-free.app/api/webhooks/circle`)
       - Limit to specific events: Disabled
    4. Save the webhook configuration

    Note: The webhook is essential for processing transaction status updates. Ensure it's properly configured before testing transactions.
