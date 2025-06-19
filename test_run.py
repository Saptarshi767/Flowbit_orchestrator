import subprocess

flow_path = "flows/Email.json"
input_data = '{"email_text": "Can you schedule a meeting tomorrow?"}'

subprocess.run(["python", "run_flow.py", flow_path, input_data])