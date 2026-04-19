#!/bin/bash

# 环境配置脚本 - 配置Java 17和安装Maven

echo "========================================="
echo "  配置Java 17和安装Maven"
echo "========================================="

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 配置Java 17
echo ""
echo "☕ 配置Java 17..."

JAVA_17_HOME="/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"

if [ -d "$JAVA_17_HOME" ]; then
    echo -e "${GREEN}✅ 找到Java 17: $JAVA_17_HOME${NC}"
    
    # 添加到当前会话
    export JAVA_HOME=$JAVA_17_HOME
    export PATH=$JAVA_HOME/bin:$PATH
    
    echo "✅ Java 17已配置到当前会话"
    java -version
    
    # 添加到shell配置文件
    SHELL_CONFIG=""
    if [ -f ~/.zshrc ]; then
        SHELL_CONFIG=~/.zshrc
    elif [ -f ~/.bash_profile ]; then
        SHELL_CONFIG=~/.bash_profile
    elif [ -f ~/.bashrc ]; then
        SHELL_CONFIG=~/.bashrc
    fi
    
    if [ -n "$SHELL_CONFIG" ]; then
        # 检查是否已经配置
        if ! grep -q "JAVA_HOME.*jdk-17" "$SHELL_CONFIG" 2>/dev/null; then
            echo "" >> "$SHELL_CONFIG"
            echo "# Java 17 Configuration" >> "$SHELL_CONFIG"
            echo "export JAVA_HOME=$JAVA_17_HOME" >> "$SHELL_CONFIG"
            echo "export PATH=\$JAVA_HOME/bin:\$PATH" >> "$SHELL_CONFIG"
            echo -e "${GREEN}✅ Java 17已添加到 $SHELL_CONFIG${NC}"
            echo -e "${YELLOW}⚠️  请运行 'source $SHELL_CONFIG' 或重新打开终端以生效${NC}"
        else
            echo -e "${YELLOW}⚠️  Java 17已在 $SHELL_CONFIG 中配置${NC}"
        fi
    fi
else
    echo -e "${RED}❌ 未找到Java 17在 $JAVA_17_HOME${NC}"
    exit 1
fi

# 安装Maven
echo ""
echo "📦 安装Maven..."

if command -v mvn &> /dev/null; then
    echo -e "${GREEN}✅ Maven已安装: $(mvn -version 2>&1 | head -1)${NC}"
else
    echo "下载Maven..."
    
    MAVEN_VERSION="3.9.6"
    MAVEN_URL="https://dlcdn.apache.org/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz"
    MAVEN_DIR="/usr/local"
    
    # 检查是否有权限
    if [ -w "$MAVEN_DIR" ]; then
        echo "下载并安装Maven到 $MAVEN_DIR..."
        
        cd /tmp
        curl -LO "$MAVEN_URL"
        
        if [ $? -eq 0 ]; then
            sudo tar -xzf "apache-maven-${MAVEN_VERSION}-bin.tar.gz" -C "$MAVEN_DIR"
            sudo ln -sf "$MAVEN_DIR/apache-maven-${MAVEN_VERSION}" "$MAVEN_DIR/maven"
            
            # 添加到PATH
            if [ -n "$SHELL_CONFIG" ]; then
                if ! grep -q "maven" "$SHELL_CONFIG" 2>/dev/null; then
                    echo "" >> "$SHELL_CONFIG"
                    echo "# Maven Configuration" >> "$SHELL_CONFIG"
                    echo "export M2_HOME=$MAVEN_DIR/maven" >> "$SHELL_CONFIG"
                    echo 'export PATH=$M2_HOME/bin:$PATH' >> "$SHELL_CONFIG"
                    echo -e "${GREEN}✅ Maven已添加到 $SHELL_CONFIG${NC}"
                fi
            fi
            
            export M2_HOME=$MAVEN_DIR/maven
            export PATH=$M2_HOME/bin:$PATH
            
            echo -e "${GREEN}✅ Maven安装成功${NC}"
            mvn -version
            
            # 清理下载文件
            rm -f "apache-maven-${MAVEN_VERSION}-bin.tar.gz"
        else
            echo -e "${RED}❌ Maven下载失败${NC}"
            echo -e "${YELLOW}请手动安装Maven:${NC}"
            echo "  brew install maven"
            echo "或"
            echo "  1. 下载: https://maven.apache.org/download.cgi"
            echo "  2. 解压到: /usr/local/"
            echo "  3. 配置环境变量"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  没有 /usr/local 的写入权限${NC}"
        echo ""
        echo "请选择以下一种方式安装Maven:"
        echo ""
        echo "方式1: 修复Homebrew权限后使用brew安装"
        echo "  sudo chown -R $(whoami) /opt/homebrew"
        echo "  brew install maven"
        echo ""
        echo "方式2: 手动下载安装"
        echo "  1. 下载: https://maven.apache.org/download.cgi"
        echo "  2. 解压到用户目录: ~/apache-maven"
        echo "  3. 配置环境变量"
        echo ""
        echo "方式3: 使用sudo权限运行此脚本"
        echo "  sudo $0"
        exit 1
    fi
fi

echo ""
echo "========================================="
echo -e "${GREEN}  环境配置完成！${NC}"
echo "========================================="
echo ""
echo "请运行以下命令使配置生效:"
echo "  source $SHELL_CONFIG"
echo ""
echo "然后可以运行部署脚本:"
echo "  ./deploy.sh"
echo ""
