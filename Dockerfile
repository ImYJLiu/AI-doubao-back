# ============== 阶段1: 构建 Java 应用 ==============
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

# ============== 阶段2: 构建运行镜像 ==============
FROM eclipse-temurin:17-jre
WORKDIR /app

# --- 1. 安装系统依赖（编译器 + Python编译依赖 + 图像处理库） ---
RUN apt-get update && apt-get install -y \
    build-essential curl ffmpeg \
    zlib1g-dev libgdbm-dev libssl-dev libsqlite3-dev \
    libreadline-dev libffi-dev libbz2-dev liblzma-dev \
    libjpeg-dev libwebp-dev libfreetype6-dev \
    libsm6 libxext6 \
    && rm -rf /var/lib/apt/lists/*

# --- 2. 从华为云镜像下载 Python 3.12 源码并编译 ---
RUN cd /tmp && \
    curl -o Python-3.12.8.tgz https://mirrors.huaweicloud.com/python/3.12.8/Python-3.12.8.tgz && \
    tar xzf Python-3.12.8.tgz && \
    cd Python-3.12.8 && \
    ./configure --prefix=/usr/local/python3.12 && \
    make -j$(nproc) && \
    make install && \
    rm -rf /tmp/Python-3.12.8*

# --- 3. 创建虚拟环境（腾讯云镜像加速） ---
RUN /usr/local/python3.12/bin/python3.12 -m venv /app/iopaint-env && \
    /app/iopaint-env/bin/pip install --upgrade pip \
    -i https://mirrors.cloud.tencent.com/pypi/simple \
    --trusted-host mirrors.cloud.tencent.com

# --- 4. 安装 PyTorch CPU 版（腾讯云镜像） ---
RUN /app/iopaint-env/bin/pip install torch torchvision \
    -i https://mirrors.cloud.tencent.com/pypi/simple \
    --trusted-host mirrors.cloud.tencent.com

# --- 5. 安装 iopaint（跳过依赖，避免 Pillow 版本冲突） ---
RUN /app/iopaint-env/bin/pip install iopaint --no-deps \
    -i https://mirrors.cloud.tencent.com/pypi/simple \
    --trusted-host mirrors.cloud.tencent.com

# --- 6. 手动安装 iopaint 运行时依赖（腾讯云镜像） ---
RUN /app/iopaint-env/bin/pip install \
    typer "typer-config==1.4.0" "fastapi==0.108.0" uvicorn \
    opencv-python-headless loguru rich omegaconf aiohttp \
    "huggingface-hub==0.25.2" "diffusers==0.27.2" "peft==0.7.1" \
    "transformers>=4.39.1" "controlnet-aux==0.0.3" "gradio==4.21.0" \
    accelerate easydict "piexif==1.1.3" python-multipart \
    "python-socketio==5.7.2" safetensors yacs \
    -i https://mirrors.cloud.tencent.com/pypi/simple \
    --trusted-host mirrors.cloud.tencent.com

# --- 6.1 清理 OpenCV 冲突 ---
RUN /app/iopaint-env/bin/pip uninstall opencv-python -y 2>/dev/null || true && \
    /app/iopaint-env/bin/pip install opencv-python-headless --force-reinstall \
    -i https://mirrors.cloud.tencent.com/pypi/simple \
    --trusted-host mirrors.cloud.tencent.com

# --- 7. 清理编译工具，减小镜像体积 ---
RUN apt-get purge -y build-essential && apt-get autoremove -y

# --- 8. 复制 Java 应用和启动脚本 ---
COPY --from=builder /app/target/watermark-remover-1.0.0.jar app.jar
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN mkdir -p /app/uploads
EXPOSE 8080 8089
ENTRYPOINT ["/app/start.sh"]
