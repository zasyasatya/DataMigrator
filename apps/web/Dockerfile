FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/widget/package.json packages/widget/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY apps/web ./apps/web
RUN npm run build --workspace @sapa/web

FROM node:22-alpine AS run
WORKDIR /repo/apps/web
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next ./.next
COPY --from=build /repo/apps/web/package.json ./package.json
COPY --from=build /repo/node_modules ../node_modules
COPY --from=build /repo/apps/web/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
