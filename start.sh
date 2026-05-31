#!/bin/bash

# 激活 IOPaint 虚拟环境
export PATH="/app/iopaint-env/bin:$PATH"

# 启动 IOPaint 服务（后台运行）
echo "Starting IOPaint service on port 8089..."
/app/iopaint-env/bin/iopaint start --model=lama --device=cpu --port=8089 --host=0.0.0.0 &
IOPAINT_PID=$!

# 等待 IOPaint 启动
echo "Waiting for IOPaint to start..."
sleep 15

# 检查 IOPaint 是否启动成功
if curl -s http://localhost:8089 > /dev/null 2>&1; then
    echo "IOPaint service started successfully"
else
    echo "WARNING: IOPaint service may not have started properly"
fi

# 启动 Java 应用
echo "Starting Java application..."
java -jar app.jar &
JAVA_PID=$!

# 等待任一进程退出
wait $IOPAINT_PID $JAVA_PID
