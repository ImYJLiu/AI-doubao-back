#!/bin/bash

# 启动 IOPaint 服务（后台运行）
echo "Starting IOPaint service on port 8089..."
iopaint start --model=lama --device=cpu --port=8089 --host=0.0.0.0 &
IOPAINT_PID=$!

# 等待 IOPaint 启动
echo "Waiting for IOPaint to start..."
sleep 10

# 启动 Java 应用
echo "Starting Java application..."
java -jar app.jar &
JAVA_PID=$!

# 等待任一进程退出
wait $IOPAINT_PID $JAVA_PID
