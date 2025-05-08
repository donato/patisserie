# Discord bot invite link

https://discord.com/api/oauth2/authorize?client_id=957473918887792700&permissions=75776&scope=bot%20applications.commands

# How to build docker

1. Build it

    ```sh
    # Connect to unraid terminal
    cd /mnt/user/development/patisserie
    docker build . --tag donato/patisserie
    docker build sandbox-executor/ --tag donato/sandbox-executor
    ```

2. In the Unraid UI, go to Docker > (scroll down) > Add Container
  + There will be no template, so skip that box
  + Repository: donato/sandbox-executor:latest 
    + do same thing for patisserie
  + Network Type: MyNet
  + Set environment variables (patisserie)
    + CLIENT_TOKEN= from discord
    + REDIS_HOST=redis://my-redis (based on container settings)
  + Mount folders
      ```sh
      /app/src = /mnt/user/development/patisserie/src/
      /app/db = /mnt/user/appdata/patisserie/
      /app = /mnt/user/development/patisserie/sandbox-executor
      ```
4. In Unraid, Docker, click "Advanced" and click "Force update"

# How to add new JS Library
Rebuilding the container is overkill if adding a new js dependency.

```sh
# Connect to docker terminal
cd /app/src/
npm install <xyz>
```


# Todo

- x - add last_update to data objects (and avoid re-loading)
- x - store data-objects unmodified instead of filtered
- re-enqueue failed tasks
- queue to store ratelimit info and backoff for api fail
- rewrite queue model to match redis streams https://redis.io/docs/data-types/streams/
- add prioritization to queue
- create api cache that encapsulates tornDb and ApiQueue
  + move non cache items (like api keys) out of tornDb
- make list of tornapi keys 
  + remove them if failing/revoked
  + Store key access level
- add helper/timeout for listeners to the updateEmitter
- x - after faction list, put members onto queue for updating
- x - create roles
  - x - assign roles to users
- create channels
  - assign roles to channels
- add queue for discord roles