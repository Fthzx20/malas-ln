# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Local environment variables

Copy `.env.example` to `.env.local` and fill in the values for your Supabase and database instances. Example:

```bash
cp .env.example .env.local
# edit .env.local and set DATABASE_URL, SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY
```

Then start the dev server:

```bash
# npm
npm run dev
```

If port 3000 is in use, Nuxt will pick another available port and print it in the console.

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
