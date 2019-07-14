#!/usr/bin/env bash

url="{$URL:-https://forseti-viz-7w7yryh64q-uc.a.run.app/data}"

token=$(gcloud config config-helper --format='value(credential.id_token)') && \
  curl "$url" -H "Authorization: Bearer $token"