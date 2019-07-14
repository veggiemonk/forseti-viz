#!/usr/bin/env bash


docker build -t gcr.io/forseti-238006/forseti-viz:latest . && \
docker push gcr.io/forseti-238006/forseti-viz && \
gcloud beta run deploy forseti-viz \
  --image gcr.io/forseti-238006/forseti-viz:latest \
  --region us-central1 \
  --platform managed
