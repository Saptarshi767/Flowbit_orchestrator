FROM python:3.10-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir -r requirements.txt

CMD ["python", "run_flow.py", "flows/Email.json", "{\"email_text\": \"Can you schedule a meeting tomorrow?\"}"]