# ============== 阶段1: 构建 Java 应用 ==============
FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -q
COPY src ./src
RUN mvn clean package -DskipTests -q

# ============== 阶段2: 运行镜像（基于预构建的 iopaint 基础镜像） ==============
# 该镜像已包含: Java 17 + Python 3.12 + PyTorch + iopaint 完整环境
FROM ccr.ccs.tencentyun.com/doubao/doubao:latest
WORKDIR /app

# 只需复制新构建的 JAR 文件
COPY --from=builder /app/target/watermark-remover-1.0.0.jar app.jar
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN mkdir -p /app/uploads
EXPOSE 8080 8089
ENTRYPOINT ["/app/start.sh"]
