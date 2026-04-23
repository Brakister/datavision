FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package.json .
RUN npm install

# Copiar codigo
COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
