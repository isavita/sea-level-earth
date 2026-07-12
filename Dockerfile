# --- build stage: install deps and produce the static bundle ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- run stage: serve ./dist with the zero-dependency Node server ---
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY server.js ./
# Railway injects $PORT; the server falls back to 3000 locally.
EXPOSE 3000
CMD ["node", "server.js"]
