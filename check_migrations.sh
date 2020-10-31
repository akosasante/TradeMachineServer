#!/bin/bash

if [ "$(ls -A src/db/migrations)" ]; then
    echo "Not Empty" && exit 1
else
    echo "Empty" && exit 0
fi
