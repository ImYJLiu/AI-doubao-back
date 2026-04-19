# AI去水印工具 - 部署指南

## 项目简介

这是一个基于Spring Boot 3.2的AI图片去水印工具后端服务，主要功能包括：
- 微信小程序登录认证
- 图片上传和管理
- AI去水印任务处理
- 积分系统管理
- 历史记录查询

## 技术栈

- **后端框架**: Spring Boot 3.2.0
- **Java版本**: 17
- **数据库**: MySQL 8.0+
- **ORM**: MyBatis-Plus 3.5.5
- **对象存储**: MinIO
- **认证**: JWT
- **微信小程序**: weixin-java-miniapp 4.6.0

## 系统要求

- Java 17 或更高版本
- Maven 3.6+
- MySQL 8.0+
- MinIO (可选，用于图片存储)

## 快速部署

### 方式一：使用部署脚本（推荐）

```bash
# 赋予执行权限
chmod +x deploy.sh

# 执行完整部署
./deploy.sh
```

部署脚本会自动：
1. 检查Java、Maven、MySQL环境
2. 初始化数据库
3. 构建项目
4. 创建配置文件
5. 启动应用

### 方式二：手动部署

#### 1. 环境准备

**安装Java 17**
```bash
# macOS (使用Homebrew)
brew install openjdk@17
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk

# 验证安装
java -version
```

**安装Maven**
```bash
brew install maven

# 验证安装
mvn -version
```

**安装MySQL**
```bash
brew install mysql
brew services start mysql

# 验证安装
mysql --version
```

**安装MinIO**
```bash
# 方式1: 使用Homebrew
brew install minio/stable/minio

# 方式2: 使用Docker
docker run -p 9000:9000 -p 9001:9001 \
  --name minio \
  -v /tmp/minio-data:/data \
  -e 'MINIO_ROOT_USER=minioadmin' \
  -e 'MINIO_ROOT_PASSWORD=minioadmin' \
  minio/minio server /data --console-address ':9001'
```

#### 2. 初始化数据库

```bash
# 登录MySQL
mysql -u root -p

# 执行初始化脚本
mysql -u root -p < src/main/resources/schema.sql
```

#### 3. 配置应用

编辑 `src/main/resources/application.yml` 或创建 `application-prod.yml`：

```yaml
server:
  port: 8080

spring:
  datasource:
    url: jdbc:mysql://localhost:3306/watermark_db?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai
    username: root
    password: your_password  # 修改为你的MySQL密码
    driver-class-name: com.mysql.cj.jdbc.Driver

# 微信小程序配置（必须修改）
wx:
  miniapp:
    appid: your-wechat-appid      # 替换为你的小程序AppID
    secret: your-wechat-secret    # 替换为你的小程序AppSecret

# MinIO配置（如果使用远程MinIO，需要修改）
minio:
  endpoint: http://localhost:9000
  access-key: minioadmin
  secret-key: minioadmin
  bucket-name: watermark-images
```

#### 4. 构建项目

```bash
mvn clean package -DskipTests
```

#### 5. 启动应用

```bash
# 方式1: 使用Maven启动
mvn spring-boot:run

# 方式2: 使用JAR包启动
java -jar target/watermark-remover-1.0.0.jar

# 方式3: 指定配置文件启动
java -jar target/watermark-remover-1.0.0.jar \
  --spring.config.location=classpath:/application.yml,./application-prod.yml
```

#### 6. 验证部署

```bash
# 检查应用是否启动
curl http://localhost:8080/actuator/health

# 查看日志
tail -f logs/spring.log
```

## 常用操作

### 启动应用
```bash
./deploy.sh start
```

### 停止应用
```bash
./deploy.sh stop
```

### 重启应用
```bash
./deploy.sh stop
./deploy.sh start
```

### 查看日志
```bash
tail -f app.log
```

### 查看应用状态
```bash
# 检查进程
ps aux | grep watermark-remover

# 检查端口
lsof -i :8080
```

## 数据库说明

### 数据库表结构

项目包含以下核心表：
- `user` - 用户表
- `image` - 图片表
- `task` - 任务表
- `credit_record` - 积分记录表
- `order` - 订单表

### 初始化数据库
```bash
mysql -u root -p < src/main/resources/schema.sql
```

## MinIO配置

### 启动MinIO
```bash
# 创建数据目录
mkdir -p /tmp/minio-data

# 启动MinIO
minio server /tmp/minio-data --console-address ':9001'
```

### 访问MinIO控制台
- 地址: http://localhost:9001
- 用户名: minioadmin
- 密码: minioadmin

### 创建Bucket
在MinIO控制台中创建名为 `watermark-images` 的bucket。

## 微信小程序配置

### 获取AppID和AppSecret

1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 开发 -> 开发管理 -> 开发设置
4. 复制AppID和AppSecret

### 配置服务器域名

在微信小程序后台配置服务器域名：
- request合法域名: `https://your-domain.com`
- uploadFile合法域名: `https://your-domain.com`
- downloadFile合法域名: `https://your-domain.com`

## 生产环境部署

### 使用systemd管理（Linux）

创建服务文件 `/etc/systemd/system/watermark.service`:

```ini
[Unit]
Description=AI Watermark Remover Service
After=network.target mysql.service

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/watermark-remover
ExecStart=/usr/bin/java -jar target/watermark-remover-1.0.0.jar \
  --spring.config.location=classpath:/application.yml,./application-prod.yml
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable watermark
sudo systemctl start watermark
sudo systemctl status watermark
```

### 使用Docker部署

创建 `Dockerfile`:

```dockerfile
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY target/watermark-remover-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

构建和运行：
```bash
docker build -t watermark-remover .
docker run -d -p 8080:8080 \
  --name watermark-app \
  --network host \
  watermark-remover
```

## 故障排查

### 常见问题

**1. Java版本不正确**
```bash
# 查看Java版本
java -version

# 如果版本不对，检查JAVA_HOME
echo $JAVA_HOME

# 设置正确的Java版本
export JAVA_HOME=/path/to/java17
```

**2. 数据库连接失败**
- 检查MySQL是否运行: `brew services list | grep mysql`
- 检查数据库是否创建: `mysql -u root -p -e "SHOW DATABASES;"`
- 检查用户名密码是否正确

**3. MinIO连接失败**
- 检查MinIO是否运行: `pgrep -x minio`
- 检查端口是否监听: `lsof -i :9000`
- 检查bucket是否创建

**4. 端口被占用**
```bash
# 查看端口占用
lsof -i :8080

# 修改端口
java -jar target/watermark-remover-1.0.0.jar --server.port=8081
```

### 查看日志

```bash
# 应用日志
tail -f app.log

# 实时查看
tail -f app.log | grep -i error
```

## API文档

应用启动后，可以通过以下方式查看API：

- Swagger UI: http://localhost:8080/swagger-ui.html (如果配置了Swagger)
- 或者直接查看Controller代码

## 开发模式

### 热重载开发

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### 运行测试

```bash
mvn test
```

## 性能优化建议

1. **数据库连接池**: 配置HikariCP参数
2. **线程池**: 调整ThreadPoolConfig配置
3. **缓存**: 添加Redis缓存
4. **CDN**: 使用CDN加速图片访问
5. **负载均衡**: 多实例部署

## 安全建议

1. 修改默认JWT密钥
2. 使用HTTPS
3. 配置CORS策略
4. 定期更新依赖
5. 启用SQL注入防护

## 技术支持

如有问题，请查看：
- 应用日志: `app.log`
- MySQL错误日志
- MinIO日志

## 许可证

本项目仅供学习和研究使用。
