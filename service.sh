#!/bin/bash

SCRIPT_NAME=$(basename $0)

device=$(route|grep default|awk '{print$8}'|uniq)
info=$(ip addr show $device)
local_ip=$(echo $info|sed "s/.*\ inet\ \(.*\)\/.* brd.*\ .*/\1/")

grep '\bSERVER_IP\b'
    -r . --exclude-dir=.git \
    --exclude-dir=certs \
    | awk -F ':' '{print$1}' \
    | grep -v $SCRIPT_NAME \
    |xargs -I {} sed -i "s/SERVER_IP/$local_ip/g" {}

docker compose down
docker compose up -d