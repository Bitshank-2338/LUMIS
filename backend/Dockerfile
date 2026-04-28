FROM python:3.11.9-slim

WORKDIR /app

# Install system dependencies including gfortran for scipy compilation
RUN apt-get update && apt-get install -y \
    gcc \
    gfortran \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run with gunicorn
CMD ["gunicorn", "run:app", "--bind", "0.0.0.0:8000", "--workers", "2", "--threads", "4", "--timeout", "120"]
