#!/bin/sh

# Log environment variables
env > /app/logs/runner_env.log 2>&1

# Execute the python script, redirecting stdout and stderr
python /app/run_flow.py /app/flows/$1.json /app/temp_input.json > /app/logs/runner_stdout.log 2>&1

# Exit with the same code as the python script
exit $? 