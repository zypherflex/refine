#!/usr/bin/env bash
# Lays each narration WAV (from narrate.py) over the recorded video at the time in timeline.json (from record.cjs).
# Usage: walkthrough/mix.sh <video.webm> <timeline.json> <audioDir> <out.mp4>
set -euo pipefail
video=$1 timeline=$2 audio=$3 out=$4

args=(-i "$video")
filter=""
labels=""
n=1
while read -r id at; do
  args+=(-i "$audio/$id.wav")
  filter+="[$n:a]adelay=${at}|${at}[a$n];"
  labels+="[a$n]"
  n=$((n + 1))
done < <(node -e 'for (const l of require(require("path").resolve(process.argv[1]))) console.log(l.id, l.at)' "$timeline")

filter+="${labels}amix=inputs=$((n - 1)):normalize=0,apad[voice]"
ffmpeg -loglevel error -y "${args[@]}" -filter_complex "$filter" -map 0:v -map "[voice]" -shortest \
  -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -movflags +faststart "$out"
