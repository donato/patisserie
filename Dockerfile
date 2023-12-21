# docker build . --tag donato/patisserie
# Set environment variables for:
#     CLIENT_TOKEN= from discord
#     REDIS_HOST
# Mount
#     /usr/src/app/src = /mnt/user/development/patisserie/src/
#     /usr/src/app/db = /mnt/user/appdata/patisserie/

FROM node:latest

# ENV NODE_ENV=production
RUN mkdir -p /usr/src/app

# install nodemon globally
RUN npm install nodemon -g

# ENV NODE_PATH='/usr/src/node_modules'
WORKDIR /usr/src/app
COPY "package*.json" ./
RUN npm install


EXPOSE 3000

CMD ["npm", "start"]