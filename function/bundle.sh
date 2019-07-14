#!/usr/bin/env bash

rm -f test.zip && \
zip -r test.zip . && \
gsutil cp test.zip gs://forseti-client-b4bd587/test.zip && \
rm -f test.zip
