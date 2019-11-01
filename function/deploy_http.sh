gcloud functions deploy forseti-http \
  --runtime go111 \
  --entry-point HelloHTTP \
  --trigger-http \
  --source gs://$BUCKET_NAME/test.zip
