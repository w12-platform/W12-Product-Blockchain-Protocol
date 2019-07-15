#!/bin/bash +B

TOKEN=$TELEGRAM_NOTIFICATION_BOT_TOKEN
CHAT_ID=-1001362262646
URL="https://api.telegram.org/bot$TOKEN/sendMessage"

curl -s -X POST $URL -d chat_id=$CHAT_ID -d text="$1"

