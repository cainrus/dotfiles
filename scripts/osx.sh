#!/usr/bin/env bash

output=$(node ./haigekassa.js 6 16);
email=$(cat ./email.conf 2>/dev/null);
if ! [ -z "$output" ]; then
	echo "write email into ./email.conf"
fi

if ! [ -z "$output" ]; then
  osascript -e 'display notification "Check haigekassa!"'
  mail -s "Check haigekassa!" $email <<< "$output"
fi
