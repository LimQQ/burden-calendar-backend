# syntax=docker/dockerfile:1

# 빌드 단계: 개발 의존성까지 설치하고 Prisma Client 생성 후 TypeScript를 빌드한다.
# docker compose의 migrate 서비스도 이 단계를 쓴다(prisma CLI가 필요해서).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# 실행 단계: 운영 의존성과 빌드 결과만 담는다.
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
