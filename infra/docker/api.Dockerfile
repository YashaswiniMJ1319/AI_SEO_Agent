# File: infra/docker/api.Dockerfile
FROM node:18-alpine

WORKDIR /usr/src/app

# Copy only package.json first
COPY package*.json ./

RUN npm install

# Copy the rest of the API source code
COPY . .

EXPOSE 4000

CMD ["npm", "run", "dev"]
