FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
