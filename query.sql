SELECT id,
       resource_type,
       category,
       resource_id,
       parent_id,
       IFNULL(resource_data ->> '$.displayName', '') as resource_data_displayname,
       IFNULL(resource_data ->> '$.name', '')        as resource_data_name
FROM gcp_inventory
WHERE inventory_index_id = (SELECT id FROM inventory_index ORDER BY completed_at_datetime DESC LIMIT 1)
  AND (category = 'resource')
  AND (resource_type = 'organization' OR resource_type = 'project' OR resource_type = 'folder' OR
       resource_type = 'appengine_app' OR resource_type = 'kubernetes_cluster' OR resource_type = 'cloudsqlinstance' OR
       resource_type = 'instance' OR resource_type = 'instance_group' OR resource_type = 'instancetemplate' OR
       resource_type = 'disk' OR resource_type = 'bucket'
       );


# select distinct(resource_type) from gcp_inventory;


-- SELECT id,
--        resource_type,
--        category,
--        resource_id,
--        parent_id,
--        IFNULL(resource_data ->> '$.displayName', '') as resource_data_displayname,
--        IFNULL(resource_data ->> '$.name', '')        as resource_data_name
-- FROM gcp_inventory
-- WHERE inventory_index_id = (SELECT id FROM inventory_index ORDER BY completed_at_datetime DESC LIMIT 1)
--   AND (category = 'resource');


SELECT id,
       resource_type,
       category,
       resource_id,
       parent_id,
       IFNULL(resource_data ->> '$.displayName', '') as resource_data_displayname,
       IFNULL(resource_data ->> '$.name', '')        as resource_data_name
FROM gcp_inventory
WHERE inventory_index_id = (SELECT id FROM inventory_index ORDER BY completed_at_datetime DESC LIMIT 1)
  AND (category = 'resource')
  AND (resource_type = 'organization' OR resource_type = 'project' OR resource_type = 'folder');
