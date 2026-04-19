#!/bin/bash

# AI去水印工具部署脚本
# 适用于 macOS 系统

echo "========================================="
echo "  AI去水印工具 - 部署脚本"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Java版本
check_java() {
    echo ""
    echo "📦 检查Java环境..."
    
    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java -version 2>&1 | head -1 | cut -d'"' -f2 | cut -d'.' -f1)
        echo "✅ Java已安装: $(java -version 2>&1 | head -1)"
        
        if [ "$JAVA_VERSION" -lt 17 ]; then
            echo -e "${RED}❌ 需要Java 17或更高版本，当前版本: $JAVA_VERSION${NC}"
            echo -e "${YELLOW}请安装Java 17:${NC}"
            echo "  brew install openjdk@17"
            echo "  sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk"
            return 1
        fi
    else
        echo -e "${RED}❌ Java未安装${NC}"
        echo -e "${YELLOW}请安装Java 17:${NC}"
        echo "  brew install openjdk@17"
        return 1
    fi
    return 0
}

# 检查Maven
check_maven() {
    echo ""
    echo "📦 检查Maven环境..."
    
    if command -v mvn &> /dev/null; then
        echo "✅ Maven已安装: $(mvn -version 2>&1 | head -1)"
    else
        echo -e "${RED}❌ Maven未安装${NC}"
        echo -e "${YELLOW}请安装Maven:${NC}"
        echo "  brew install maven"
        return 1
    fi
    return 0
}

# 检查MySQL
check_mysql() {
    echo ""
    echo "📦 检查MySQL环境..."
    
    if command -v mysql &> /dev/null; then
        echo "✅ MySQL已安装: $(mysql --version)"
        
        # 检查MySQL是否运行
        if pgrep -x "mysqld" > /dev/null; then
            echo "✅ MySQL服务正在运行"
        else
            echo -e "${YELLOW}⚠️  MySQL服务未运行，正在启动...${NC}"
            brew services start mysql || sudo brew services start mysql
        fi
    else
        echo -e "${RED}❌ MySQL未安装${NC}"
        echo -e "${YELLOW}请安装MySQL:${NC}"
        echo "  brew install mysql"
        echo "  brew services start mysql"
        return 1
    fi
    return 0
}

# 初始化数据库
setup_database() {
    echo ""
    echo "🗄️  初始化数据库..."
    
    read -p "请输入MySQL root密码 (默认为root): " MYSQL_PASSWORD
    MYSQL_PASSWORD=${MYSQL_PASSWORD:-root}
    
    echo "执行数据库初始化脚本..."
    mysql -u root -p"$MYSQL_PASSWORD" < src/main/resources/schema.sql
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 数据库初始化成功${NC}"
    else
        echo -e "${RED}❌ 数据库初始化失败${NC}"
        return 1
    fi
    return 0
}

# 检查MinIO
check_minio() {
    echo ""
    echo "📦 检查MinIO环境..."
    
    if command -v minio &> /dev/null; then
        echo "✅ MinIO已安装"
        
        # 检查MinIO是否运行
        if pgrep -x "minio" > /dev/null; then
            echo "✅ MinIO服务正在运行"
        else
            echo -e "${YELLOW}⚠️  MinIO服务未运行${NC}"
            echo -e "${YELLOW}启动MinIO服务:${NC}"
            echo "  minio server /tmp/minio-data --console-address ':9001' &"
            read -p "是否现在启动MinIO? (y/n): " START_MINIO
            if [ "$START_MINIO" = "y" ]; then
                mkdir -p /tmp/minio-data
                minio server /tmp/minio-data --console-address ':9001' &
                echo "✅ MinIO已启动"
                echo "  - API地址: http://localhost:9000"
                echo "  - 控制台: http://localhost:9001"
                echo "  - 默认账号: minioadmin"
                echo "  - 默认密码: minioadmin"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  MinIO未安装${NC}"
        echo -e "${YELLOW}安装MinIO:${NC}"
        echo "  brew install minio/stable/minio"
        echo ""
        echo "或者使用Docker运行MinIO:"
        echo "  docker run -p 9000:9000 -p 9001:9001 \\"
        echo "    --name minio \\"
        echo "    -v /tmp/minio-data:/data \\"
        echo "    -e 'MINIO_ROOT_USER=minioadmin' \\"
        echo "    -e 'MINIO_ROOT_PASSWORD=minioadmin' \\"
        echo "    minio/minio server /data --console-address ':9001'"
    fi
}

# 构建项目
build_project() {
    echo ""
    echo "🔨 构建项目..."
    
    mvn clean package -DskipTests
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 项目构建成功${NC}"
        echo "📦 JAR文件位置: target/watermark-remover-1.0.0.jar"
    else
        echo -e "${RED}❌ 项目构建失败${NC}"
        return 1
    fi
    return 0
}

# 配置应用
configure_app() {
    echo ""
    echo "⚙️  配置应用参数..."
    
    # 创建配置文件
    cat > application-prod.yml << EOF
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/watermark_db?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: ${MYSQL_PASSWORD:-root}
    driver-class-name: com.mysql.cj.jdbc.Driver
  servlet:
    multipart:
      max-file-size: 10MB
      max-request-size: 10MB

mybatis-plus:
  mapper-locations: classpath:mapper/*.xml
  type-aliases-package: com.doubao.watermark.model.entity
  configuration:
    map-underscore-to-camel-case: true

# 微信小程序配置
wx:
  miniapp:
    appid: \${WX_MINIAPP-APPID:your-app-id}
    secret: \${WX_MINIAPP-SECRET:your-app-secret}

# JWT配置
jwt:
  secret: watermark-ai-secret-key-2026-very-long-key-for-security
  expiration: 604800

# MinIO配置
minio:
  endpoint: http://localhost:9000
  access-key: minioadmin
  secret-key: minioadmin
  bucket-name: watermark-images
EOF
    
    echo -e "${GREEN}✅ 配置文件已创建: application-prod.yml${NC}"
    echo -e "${YELLOW}⚠️  请记得修改以下配置:${NC}"
    echo "  - 微信小程序的 appid 和 secret"
    echo "  - 数据库密码（如果不同）"
    echo "  - MinIO配置（如果使用远程服务）"
}

# 启动应用
start_app() {
    echo ""
    echo "🚀 启动应用..."
    
    if [ -f "target/watermark-remover-1.0.0.jar" ]; then
        echo "启动Spring Boot应用..."
        nohup java -jar target/watermark-remover-1.0.0.jar \
            --spring.config.location=classpath:/application.yml,./application-prod.yml \
            > app.log 2>&1 &
        
        APP_PID=$!
        echo $APP_PID > app.pid
        
        echo -e "${GREEN}✅ 应用已启动${NC}"
        echo "  - PID: $APP_PID"
        echo "  - 端口: 8080"
        echo "  - 日志: app.log"
        echo ""
        echo "等待应用启动..."
        sleep 5
        
        # 检查应用是否启动成功
        if curl -s http://localhost:8080/actuator/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ 应用运行正常${NC}"
        else
            echo -e "${YELLOW}⚠️  应用可能还在启动中，请查看日志: tail -f app.log${NC}"
        fi
    else
        echo -e "${RED}❌ JAR文件不存在，请先构建项目${NC}"
        return 1
    fi
}

# 显示帮助信息
show_help() {
    echo "========================================="
    echo "  AI去水印工具 - 部署帮助"
    echo "========================================="
    echo ""
    echo "使用方法:"
    echo "  ./deploy.sh [选项]"
    echo ""
    echo "选项:"
    echo "  all        - 完整部署流程（默认）"
    echo "  check      - 仅检查环境"
    echo "  db         - 仅初始化数据库"
    echo "  build      - 仅构建项目"
    echo "  start      - 仅启动应用"
    echo "  stop       - 停止应用"
    echo "  help       - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh          # 完整部署"
    echo "  ./deploy.sh check    # 检查环境"
    echo "  ./deploy.sh build    # 构建项目"
    echo ""
}

# 停止应用
stop_app() {
    echo ""
    echo "🛑 停止应用..."
    
    if [ -f "app.pid" ]; then
        PID=$(cat app.pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID
            echo -e "${GREEN}✅ 应用已停止 (PID: $PID)${NC}"
            rm app.pid
        else
            echo -e "${YELLOW}⚠️  应用未运行 (PID: $PID)${NC}"
            rm app.pid
        fi
    else
        echo -e "${YELLOW}⚠️  未找到PID文件${NC}"
        # 尝试查找并杀死进程
        PIDS=$(pgrep -f "watermark-remover")
        if [ ! -z "$PIDS" ]; then
            echo "发现运行中的进程: $PIDS"
            kill $PIDS
            echo -e "${GREEN}✅ 已停止应用${NC}"
        fi
    fi
}

# 主流程
main() {
    case "${1:-all}" in
        all)
            check_java || exit 1
            check_maven || exit 1
            check_mysql || exit 1
            setup_database || exit 1
            check_minio
            build_project || exit 1
            configure_app
            start_app || exit 1
            ;;
        check)
            check_java
            check_maven
            check_mysql
            check_minio
            ;;
        db)
            check_mysql || exit 1
            setup_database || exit 1
            ;;
        build)
            check_java || exit 1
            check_maven || exit 1
            build_project || exit 1
            ;;
        start)
            start_app || exit 1
            ;;
        stop)
            stop_app
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    echo "========================================="
    echo -e "${GREEN}  部署完成！${NC}"
    echo "========================================="
    echo ""
    echo "访问地址:"
    echo "  - API服务: http://localhost:8080"
    echo "  - MinIO控制台: http://localhost:9001"
    echo ""
    echo "常用命令:"
    echo "  查看日志: tail -f app.log"
    echo "  停止应用: ./deploy.sh stop"
    echo "  重启应用: ./deploy.sh stop && ./deploy.sh start"
    echo ""
}

# 执行主流程
main "$@"
