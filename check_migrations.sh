#!/bin/bash

[ "$(ls -A src/db/migrations)" ] && (echo "Not Empty" && exit 1) || (echo "Empty" && exit 0)
