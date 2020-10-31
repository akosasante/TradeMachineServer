#!/bin/bash

if [ "$(ls -A dist/db/migrations | grep $1)" ]; then
    echo "Not Empty" && exit 1
else
    echo "Empty" && exit 0
fi
