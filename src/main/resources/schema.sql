-- AI去水印工具数据库初始化脚本

CREATE DATABASE IF NOT EXISTS watermark_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE watermark_db;

-- 用户表
CREATE TABLE IF NOT EXISTS `user` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `openid` VARCHAR(64) NOT NULL,
    `unionid` VARCHAR(64) DEFAULT NULL,
    `nickname` VARCHAR(64) DEFAULT NULL,
    `avatar_url` VARCHAR(512) DEFAULT NULL,
    `credits` INT NOT NULL DEFAULT 3,
    `is_vip` TINYINT(1) NOT NULL DEFAULT 0,
    `vip_expire_at` DATETIME DEFAULT NULL,
    `daily_ad_count` INT NOT NULL DEFAULT 0,
    `daily_share_count` INT NOT NULL DEFAULT 0,
    `last_reset_date` DATE DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_openid` (`openid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 图片表
CREATE TABLE IF NOT EXISTS `image` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `original_url` VARCHAR(512) NOT NULL,
    `thumbnail_url` VARCHAR(512) DEFAULT NULL,
    `file_size` BIGINT DEFAULT NULL,
    `width` INT DEFAULT NULL,
    `height` INT DEFAULT NULL,
    `format` VARCHAR(10) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 任务表
CREATE TABLE IF NOT EXISTS `task` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `image_id` BIGINT NOT NULL,
    `mask_url` VARCHAR(512) NOT NULL,
    `result_url` VARCHAR(512) DEFAULT NULL,
    `result_thumbnail_url` VARCHAR(512) DEFAULT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `error_message` VARCHAR(512) DEFAULT NULL,
    `rating` ENUM('SATISFIED', 'UNSATISFIED') DEFAULT NULL,
    `ai_model` VARCHAR(64) DEFAULT NULL,
    `process_duration_ms` BIGINT DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_created` (`user_id`, `created_at` DESC),
    KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 次数变动记录表
CREATE TABLE IF NOT EXISTS `credit_record` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `type` ENUM('INIT_GIFT', 'DAILY_RESET', 'CONSUME', 'AD_REWARD', 'SHARE_REWARD', 'VIP_GRANT', 'TASK_REFUND') NOT NULL,
    `delta` INT NOT NULL,
    `balance_after` INT NOT NULL,
    `related_task_id` BIGINT DEFAULT NULL,
    `remark` VARCHAR(256) DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_user_created` (`user_id`, `created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- VIP订单表
CREATE TABLE IF NOT EXISTS `order` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT NOT NULL,
    `order_no` VARCHAR(64) NOT NULL,
    `wx_trade_no` VARCHAR(64) DEFAULT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `product_type` VARCHAR(32) NOT NULL DEFAULT 'VIP_MONTHLY',
    `status` ENUM('CREATED', 'PAID', 'REFUNDED', 'CLOSED') NOT NULL DEFAULT 'CREATED',
    `paid_at` DATETIME DEFAULT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_order_no` (`order_no`),
    KEY `idx_user_id` (`user_id`),
    KEY `idx_wx_trade_no` (`wx_trade_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
