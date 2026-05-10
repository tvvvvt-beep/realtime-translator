FROM node:20-alpine

WORKDIR /app

# 依存関係をコピー
COPY package*.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド
RUN npm run build

# ポート3000を公開
EXPOSE 3000

# サーバーを起動
CMD ["npm", "start"]
