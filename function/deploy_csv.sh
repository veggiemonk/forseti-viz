#!/usr/bin/env bash

MYSQL_PASSWORD=${MYSQL_PASSWORD:?"is not set. Aborting."}
MYSQL_USER="cloudfunction"
MYSQL_INSTANCE_CONNECTION_NAME=${MYSQL_INSTANCE_CONNECTION_NAME:?"is not set. Aboring"}
gcloud functions deploy forseti-viz-csv \
  --runtime go111 \
  --entry-point ExtractCSV \
  --trigger-http \
  --source gs://$BUCKET_NAME/test.zip \
  --set-env-vars="MYSQL_PASSWORD=$MYSQL_PASSWORD,MYSQL_USER=$MYSQL_USER,MYSQL_INSTANCE_CONNECTION_NAME=$MYSQL_INSTANCE_CONNECTION_NAME"
