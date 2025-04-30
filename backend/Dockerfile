FROM --platform=linux/arm64 node:23-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .



CMD ["sh", "-c", "npm run start"]