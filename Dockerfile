FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

FROM eclipse-temurin:17-jre
WORKDIR /app

# 安装 Python3 和 IOPaint 所需依赖
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    libsm6 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# 创建 Python 虚拟环境并安装 IOPaint
RUN python3 -m venv /app/iopaint-env && \
    /app/iopaint-env/bin/pip install --upgrade pip && \
    /app/iopaint-env/bin/pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu && \
    /app/iopaint-env/bin/pip install iopaint

# Copy Java application
COPY --from=builder /app/target/watermark-remover-1.0.0.jar app.jar

# Copy startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN mkdir -p /app/uploads
EXPOSE 8080 8089
ENTRYPOINT ["/app/start.sh"]
