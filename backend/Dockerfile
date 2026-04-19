FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./
EXPOSE 8080
CMD ["npm", "start"]
