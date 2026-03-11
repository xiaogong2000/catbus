FROM python:3.12-slim
WORKDIR /app
RUN pip install --no-cache-dir websockets>=12.0
COPY server.py .
EXPOSE 8765
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8765"]
