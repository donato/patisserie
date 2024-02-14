
# Tasks

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