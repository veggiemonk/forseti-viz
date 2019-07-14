gcloud functions deploy forseti-http \
  --runtime go111 \
  --entry-point HelloHTTP \
  --trigger-http \
  --source gs://forseti-client-b4bd587/test.zip
