#!/usr/bin/env bash

MYSQL_PASSWORD=${MYSQL_PASSWORD:?"is not set. aborting."}
MYSQL_USER="cloudfunction"
MYSQL_INSTANCE_CONNECTION_NAME="forseti-238006:us-central1:forseti-server-db-b4bd587"
gcloud functions deploy forseti-viz-csv-1 \
  --runtime go111 \
  --entry-point ExtractCSV \
  --trigger-http \
  --source gs://forseti-client-b4bd587/test.zip \
  --set-env-vars="MYSQL_PASSWORD=$MYSQL_PASSWORD,MYSQL_USER=$MYSQL_USER,MYSQL_INSTANCE_CONNECTION_NAME=$MYSQL_INSTANCE_CONNECTION_NAME"
