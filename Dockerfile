FROM node:20-alpine

WORKDIR /app

# 依存関係をコピー
COPY package*.json ./
RUN npm ci

# ソースコードをコピー
COPY . .

# ビルド
RUN npm run build

# ポート8080を公開（Cloud Runのデフォルト）
EXPOSE 8080

# サーバーを起動
CMD ["npm", "start"]
