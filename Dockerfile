FROM node:22-alpine AS build
WORKDIR /app
COPY tools ./tools
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY js ./js
COPY vendor ./vendor
COPY index.html ./
RUN node tools/build.js

FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY assets ./assets
COPY --from=build /app/dist ./dist
COPY --from=build /app/index.html ./index.html
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
