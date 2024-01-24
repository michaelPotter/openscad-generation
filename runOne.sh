#!/usr/bin/env bash
#
# runOne.sh
#
# Michael Potter
# 2023-10-15

f=${1?Error missing argument}

scadFile=$(basename ${f%.ts})
scadFile=${scadFile%.scad}.scad

fd .ts | entr -cs "ts-node $f | tee build/$scadFile"
