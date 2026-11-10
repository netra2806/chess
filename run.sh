#!/usr/bin/env bash
# Quick launcher for Chess Website

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "================================================="
echo "♟️  Starting Chess Website..."
echo "================================================="

if command -v python3 &>/dev/null; then
    exec python3 server.py
elif command -v python &>/dev/null; then
    exec python server.py
else
    echo "Error: Python 3 was not found. Please install Python 3 to run the server."
    exit 1
fi

