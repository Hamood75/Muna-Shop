# Muna Shop

Staff-facing web app for **Muna Shop**: products, stock, sales, **installments**, **pay-later (IOU)** balances, inventory movements, and reports. Built with **Next.js** and **InstantDB**.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` / `.env.local` and set `NEXT_PUBLIC_INSTANT_APP_ID` and `INSTANT_APP_ADMIN_TOKEN` as documented there.

## InstantDB schema & permissions

After changing `src/instant.schema.ts` or `src/instant.perms.ts`:

```bash
npx instant-cli login   # once, if needed
npm run instant:push    # schema + perms (perms step retries on flaky networks)
```

See [.env.example](./.env.example) for troubleshooting CLI transport errors.

## Links

- [InstantDB docs](https://www.instantdb.com/docs)
- [Next.js docs](https://nextjs.org/docs)
