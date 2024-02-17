# docker build . --tag donato/patisserie
# Set environment variables for:
#     CLIENT_TOKEN= from discord
#     REDIS_HOST
# Mount
#     /app/src = /mnt/user/development/patisserie/src/
#     /app/db = /mnt/user/appdata/patisserie/
# In Unraid, Docker, set "Advanced" and click "force update"

FROM node:latest

# install nodemon globally
RUN npm install nodemon -g

EXPOSE 3000

RUN mkdir -p /app/
WORKDIR /app
COPY "start.sh" /app

ENTRYPOINT ["/usr/bin/env"]
CMD ["bash", "/app/start.sh"]