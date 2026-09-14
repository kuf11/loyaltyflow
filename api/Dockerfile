FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY server.js security.js loyalty.js registration-security.js test-mode-setup.js bot-menu-sync.js admin-broadcast-server.js security-preload.js ./
EXPOSE 3000 3001
USER node
CMD ["sh","-c","node test-mode-setup.js && npm start"]
