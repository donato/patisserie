


# TODO
-- add last_update to data objects
 (and avoid re-loading)
-- store data-objects unmodified instead of filtered
re-enqueue failed tasks
make list of tornapi keys 
 - remove them if failing/revoked
 backoff for api fail
after faction list, put members onto queue for updating
create channels
create roles

assign roles to channels and users

think about
  discord info as a separate field of 'user'
  "source of truth" vs embedded data. user->faction will live with user, and faction->members will be derived. same with "total_users" and "total_faction" values (re-compute when?)

 