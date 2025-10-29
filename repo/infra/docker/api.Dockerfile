FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy everything else
COPY . .

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

CMD ["npm", "run", "dev"]
