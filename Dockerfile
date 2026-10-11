FROM node:24.19.0-alpine AS build
WORKDIR /app
COPY build.mjs ./
COPY src ./src
COPY nginx/snippets/language.conf ./nginx/snippets/language.conf
RUN node build.mjs

FROM nginx:1.30.4-alpine3.24-slim AS base
COPY nginx/snippets /etc/nginx/snippets
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80 443

FROM base AS dev
COPY nginx/dev.conf /etc/nginx/nginx.conf

FROM base AS prod
COPY nginx/prod.conf /etc/nginx/nginx.conf
