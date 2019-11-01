#!/usr/bin/env bash

rm -f test.zip && \
zip -r test.zip . && \
gsutil cp test.zip gs://$BUCKET_NAME/test.zip && \
rm -f test.zip
