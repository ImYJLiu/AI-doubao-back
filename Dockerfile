FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

# IOPaint builder stage
FROM python:3.10 AS iopaint-builder
WORKDIR /iopaint
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*
RUN pip3 install --upgrade pip && \
    pip3 install torch==2.1.2 torchvision==0.16.2 --index-url https://download.pytorch.org/whl/cpu && \
    pip3 install iopaint

FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy IOPaint from builder stage
COPY --from=iopaint-builder /usr/local/lib/python3.10 /usr/local/lib/python3.10
COPY --from=iopaint-builder /usr/local/bin/iopaint /usr/local/bin/iopaint

# Copy Java application
COPY --from=builder /app/target/watermark-remover-1.0.0.jar app.jar
RUN mkdir -p /app/uploads
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
