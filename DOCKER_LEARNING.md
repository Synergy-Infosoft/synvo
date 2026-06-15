# Docker Learning Guide For This Project

This guide explains Docker using our current Next.js/Supabase CRM project.
The goal is not only to run Docker, but to understand how to create a
Dockerfile yourself next time.

## 1. What Docker Does

Docker packages an app with the runtime it needs.

For this project, that means:

- Node.js version
- installed npm packages
- built Next.js app
- command to start the server
- environment variables passed when the container runs

Important words:

- **Dockerfile**: the recipe for building the app image.
- **Image**: the packaged app created from the Dockerfile.
- **Container**: a running copy of an image.
- **Build time**: when Docker creates the image.
- **Runtime**: when the container is actually running.
- **Port mapping**: connecting a port on your computer to a port inside the container.

Example:

```powershell
docker build -t synvo-crm:local .
docker run -p 3001:3000 synvo-crm:local
```

Meaning:

- build an image called `synvo-crm:local`
- run it
- open container port `3000` on your computer as `localhost:3001`

## 2. Why Docker Is Useful Here

This app is a Next.js 16 project with Supabase and WhatsApp APIs.

Docker is useful because:

- everyone runs the same Node.js version
- hosting can run the same production build we tested locally
- the app starts the same way every time
- local machine differences matter less
- we can test production behavior without touching Hostinger first

For daily coding on Windows, `npm run dev` is still faster.
For production-like testing, Docker is better.

## 3. The Next.js Requirement

In `next.config.ts`, we added:

```ts
output: "standalone",
```

Why?

Next.js can create a minimal production server in:

```text
.next/standalone
```

That folder contains only the files needed to run the app.
This is better for Docker because the final image becomes smaller and cleaner.

Without `output: "standalone"`, we usually need to copy more files and run:

```powershell
npm run start
```

With standalone output, we can run:

```powershell
node server.js
```

That `server.js` is created by Next.js inside `.next/standalone`.

## 4. Our Dockerfile

Current Dockerfile:

```dockerfile
# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

## 5. Dockerfile Line By Line

### `# syntax=docker/dockerfile:1`

This tells Docker which Dockerfile syntax version to use.

Use it when:

- you want modern Dockerfile features
- you want builds to behave consistently

It is not app code. It is an instruction for Docker itself.

### `FROM node:20-alpine AS base`

This starts a build stage.

`node:20-alpine` means:

- Node.js 20 is installed
- Alpine Linux is used
- Alpine is small, so image size is smaller

`AS base` gives this stage a name.

Use Node 20 because `package.json` says:

```json
"engines": {
  "node": ">=20.0.0"
}
```

### `WORKDIR /app`

This sets the working folder inside the image.

After this line, commands run inside:

```text
/app
```

So this:

```dockerfile
COPY package.json ./
```

means copy into:

```text
/app/package.json
```

### `ENV NEXT_TELEMETRY_DISABLED=1`

This disables Next.js telemetry.

Use `ENV` when you want an environment variable available inside the image/container.

This one is safe because it is not secret.

### `FROM base AS deps`

This creates a new stage called `deps`.

Purpose:

- install npm dependencies
- cache them separately

Why separate?

Docker caches each layer.
If only app code changes but `package-lock.json` does not change, Docker can reuse the npm install layer.

### `RUN apk add --no-cache libc6-compat`

`RUN` executes a command while building the image.

`apk` is Alpine Linux package manager.

`libc6-compat` adds compatibility for some Node/native packages that expect glibc-like behavior.

Use it commonly in Node Alpine images when packages may need native compatibility.

### `COPY package.json package-lock.json ./`

Copies only dependency definition files first.

Why not copy the whole project first?

Because this improves Docker cache.

If we copy everything before `npm ci`, then every code change can force npm install again.

Better pattern:

```dockerfile
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
```

### `RUN npm ci`

Installs dependencies exactly from `package-lock.json`.

Use `npm ci` in Docker/CI.

Use `npm install` mostly when developing locally and changing dependencies.

Difference:

- `npm ci`: clean, strict, reproducible
- `npm install`: can update lockfile/package state

### `FROM base AS builder`

Creates the build stage.

Purpose:

- receive dependencies from `deps`
- copy source code
- build the Next.js app

This stage can contain dev dependencies because building needs TypeScript, ESLint types, etc.

### `ARG NEXT_PUBLIC_SUPABASE_URL`

`ARG` means build-time variable.

It exists only while building the image unless we also turn it into `ENV`.

Use `ARG` for values needed during build.

For Next.js, variables starting with `NEXT_PUBLIC_` can be embedded into browser JavaScript during build.
So these public values must be available before:

```dockerfile
RUN npm run build
```

### `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`

This is also a build-time public value.

Even though it says "key", Supabase anon key is designed to be public.
The private one is:

```text
SUPABASE_SERVICE_ROLE_KEY
```

Never bake service-role key into an image.

### `ARG NEXT_PUBLIC_SITE_URL`

Public site URL used by the app.

This may be different for:

- local Docker
- staging domain
- production domain

### `ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL`

This copies the build arg into an environment variable.

Why?

Next.js reads `process.env.NEXT_PUBLIC_SUPABASE_URL` during build.

Same idea for:

```dockerfile
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
```

### `COPY --from=deps /app/node_modules ./node_modules`

Copies installed dependencies from the `deps` stage into the `builder` stage.

This is called a multi-stage copy.

Format:

```dockerfile
COPY --from=<stage-name> <source-inside-that-stage> <destination-here>
```

### `COPY . .`

Copies project files into the image.

This uses `.dockerignore`, so ignored files are not copied.

Example ignored files:

- `.env.local`
- `node_modules`
- `.next`
- `.git`

This is important because secrets and huge folders should not go into the image.

### `RUN npm run build`

Builds the Next.js production app.

Because we enabled:

```ts
output: "standalone"
```

this creates:

```text
.next/standalone
.next/static
```

### `FROM node:20-alpine AS runner`

Creates final production image stage.

This is the stage users actually run.

Why not use the `builder` stage directly?

Because builder has source files, dev tools, and full dependencies.
The final runner should be smaller and cleaner.

### `WORKDIR /app`

Same as before: final container works inside `/app`.

### `ENV NODE_ENV=production`

Tells Node/Next this is production.

Use this for deployed apps.

### `ENV PORT=3000`

The app listens inside the container on port `3000`.

This does not expose it to your computer by itself.
It only tells the app what port to bind to.

### `ENV HOSTNAME=0.0.0.0`

This is important in Docker.

If the app listens only on `localhost` inside the container, your host machine may not reach it.

`0.0.0.0` means:

```text
listen on all network interfaces inside the container
```

### `RUN addgroup ... && adduser ...`

Creates a non-root Linux user.

Why?

Security best practice.

If the app is compromised, running as non-root reduces damage.

### `COPY --from=builder /app/public ./public`

Copies public assets.

Examples:

- logos
- images
- static files

Next standalone does not automatically copy `public`, so we copy it manually.

### `COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./`

Copies the minimal standalone production server into the final image.

`--chown=nextjs:nodejs` means:

- owner user: `nextjs`
- owner group: `nodejs`

This matches the non-root user we created.

### `COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static`

Copies static build assets.

Examples:

- JavaScript chunks
- CSS files
- font chunks

Without this, the page may load HTML but fail to load JS/CSS.

### `USER nextjs`

Switches from root user to the safer `nextjs` user.

Commands after this run as `nextjs`.

### `EXPOSE 3000`

Documents that the container listens on port `3000`.

Important:

This does not publish the port automatically.
You still need:

```powershell
-p 3001:3000
```

### `CMD ["node", "server.js"]`

Default command when the container starts.

This runs the standalone Next server.

Use JSON array form because it avoids shell parsing issues.

Good:

```dockerfile
CMD ["node", "server.js"]
```

Less ideal:

```dockerfile
CMD node server.js
```

## 6. Our `.dockerignore`

Current `.dockerignore`:

```dockerignore
.git
.github
.next
node_modules
coverage
out
build

.env
.env.*
!.env.local.example
!.env.example

npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

*.tsbuildinfo
Dockerfile
.dockerignore
README.md
LOCAL_CONTRIBUTING_UPSTREAM.md
```

`.dockerignore` controls what goes into Docker build context.

Important examples:

### `node_modules`

Do not copy local Windows `node_modules`.
The image should install Linux-compatible dependencies itself.

### `.next`

Do not copy old local build output.
The image creates its own fresh build.

### `.env.*`

Do not bake secrets into the image.

We pass secrets at runtime:

```powershell
docker run --env-file .env.local ...
```

### `!.env.local.example`

This means:

```text
do not ignore .env.local.example
```

We keep example env files because they are documentation, not secrets.

### `Dockerfile`

This looks strange, but it is okay.

Docker reads the Dockerfile before sending build context.
Ignoring it only means `COPY . .` will not copy Dockerfile into the image.

## 7. Build The Image

Basic command:

```powershell
docker build -t synvo-crm:local .
```

Meaning:

- `docker build`: build image from Dockerfile
- `-t synvo-crm:local`: tag/name the image
- `.`: use current folder as build context

But our app needs public Next.js env vars at build time.

So for this project use:

```powershell
docker build `
  -t synvo-crm:local `
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" `
  --build-arg NEXT_PUBLIC_SITE_URL="http://localhost:3001" `
  .
```

Meaning:

- `--build-arg`: sends a value to `ARG` in Dockerfile
- these are public values used by the browser/client bundle

Do not pass these as build args:

```text
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
META_APP_SECRET
```

Those are private runtime secrets.

## 8. Run The Container

Command:

```powershell
docker run --rm --name synvo-crm-local -d --env-file .env.local -p 3001:3000 synvo-crm:local
```

Meaning:

### `docker run`

Start a container from an image.

### `--rm`

Delete the container automatically when it stops.

Good for local testing.

### `--name synvo-crm-local`

Gives the container a readable name.

Then you can run:

```powershell
docker logs synvo-crm-local
docker stop synvo-crm-local
```

### `-d`

Detached mode.

Runs in background.

Without `-d`, logs stay attached to your terminal.

### `--env-file .env.local`

Loads runtime environment variables.

This is where private secrets come from:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ENCRYPTION_KEY`
- `META_APP_SECRET`
- `AUTOMATION_CRON_SECRET`

### `-p 3001:3000`

Maps ports.

Format:

```text
host-port:container-port
```

So:

```text
localhost:3001 -> container:3000
```

### `synvo-crm:local`

The image to run.

## 9. Useful Docker Commands

See running containers:

```powershell
docker ps
```

See all containers, including stopped:

```powershell
docker ps -a
```

See logs:

```powershell
docker logs synvo-crm-local
```

Follow logs live:

```powershell
docker logs -f synvo-crm-local
```

Stop the container:

```powershell
docker stop synvo-crm-local
```

List images:

```powershell
docker images
```

Remove an image:

```powershell
docker rmi synvo-crm:local
```

Open a shell inside a running container:

```powershell
docker exec -it synvo-crm-local sh
```

Check container resource usage:

```powershell
docker stats
```

## 10. How To Think When Creating A Dockerfile

Ask these questions:

### 1. What runtime does my app need?

For us:

```text
Node.js 20
```

So:

```dockerfile
FROM node:20-alpine
```

### 2. How do I install dependencies?

For us:

```text
npm ci
```

Because we have:

```text
package-lock.json
```

### 3. How do I build?

For us:

```text
npm run build
```

### 4. How do I start production?

Because we use Next standalone:

```text
node server.js
```

Without standalone, it would be:

```text
npm run start
```

### 5. What files should not go into the image?

Usually:

- `.env`
- `.git`
- `node_modules`
- build output like `.next`
- logs

That is why `.dockerignore` exists.

### 6. What values are build-time vs runtime?

Build-time:

- public browser variables
- values needed by `next build`

Runtime:

- secrets
- database service keys
- encryption keys
- webhook secrets

For this project:

Build-time:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SITE_URL
```

Runtime:

```text
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
META_APP_SECRET
AUTOMATION_CRON_SECRET
WHATSAPP_TEMPLATES_DRY_RUN
ALLOWED_INVITE_HOSTS
```

## 11. Common Mistakes

### Mistake: Copying `.env.local` into the image

Bad because secrets become part of the image.

Use:

```powershell
docker run --env-file .env.local ...
```

### Mistake: Copying local `node_modules`

Bad because Windows dependencies may not work inside Linux container.

Let Docker install dependencies with:

```dockerfile
RUN npm ci
```

### Mistake: Forgetting port mapping

This:

```powershell
docker run synvo-crm:local
```

may start the app, but you cannot open it from browser unless you map ports:

```powershell
-p 3001:3000
```

### Mistake: Putting private secrets in `ARG`

Build args can end up in build history or build cache.

Do not use `ARG` for:

```text
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_KEY
META_APP_SECRET
```

### Mistake: Not setting `HOSTNAME=0.0.0.0`

Inside Docker, apps should listen on all interfaces.

Use:

```dockerfile
ENV HOSTNAME=0.0.0.0
```

## 12. Local Workflow For This Project

### Normal development

Use:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

### Production Docker test

Build:

```powershell
docker build `
  -t synvo-crm:local `
  --build-arg NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co" `
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key" `
  --build-arg NEXT_PUBLIC_SITE_URL="http://localhost:3001" `
  .
```

Run:

```powershell
docker run --rm --name synvo-crm-local -d --env-file .env.local -p 3001:3000 synvo-crm:local
```

Open:

```text
http://localhost:3001
```

Stop:

```powershell
docker stop synvo-crm-local
```

## 13. Simple Dockerfile Template For Future Next.js Projects

Use this mental pattern:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

Then improve it by adding:

- non-root user
- `.dockerignore`
- build args for public Next env vars
- runtime env file for secrets

## 14. What We Should Use In This Project

For this CRM, the current setup is the correct direction:

- multi-stage Dockerfile
- Node 20 Alpine
- `npm ci`
- Next standalone output
- public values as build args
- secrets only at runtime
- non-root production user
- port `3000` inside container
- map to `3001` locally to avoid conflict with `npm run dev`

This gives us a production-like Docker container without mixing secrets into the image.

