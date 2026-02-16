FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY web ./web
RUN mkdir -p /app/data && echo '[]' > /app/data/weeks.json

EXPOSE 8080

CMD ["node", "server.js"]
