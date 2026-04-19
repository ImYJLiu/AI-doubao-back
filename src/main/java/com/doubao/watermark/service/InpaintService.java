package com.doubao.watermark.service;

import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.config.IOPaintConfig;
import com.doubao.watermark.mapper.ImageMapper;
import com.doubao.watermark.model.entity.Image;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InpaintService {

    private final IOPaintConfig config;
    private final StorageService storageService;
    private final ImageMapper imageMapper;
    private final RestTemplate restTemplate;

    /**
     * 执行图片修复
     * @param imageId 原图ID
     * @param maskUrl 蒙版图URL
     * @return 处理后图片URL
     */
    public String inpaint(Long imageId, String maskUrl) {
        if (!config.isEnabled()) {
            log.warn("IOPaint 服务未启用，返回模拟结果");
            return getFallbackResult(imageId);
        }

        log.info("开始 IOPaint 图片修复: imageId={}, maskUrl={}", imageId, maskUrl);

        try {
            // 1. 获取原图文件路径
            String originalUrl = getOriginalImageUrl(imageId);

            // 2. 读取原图和蒙版文件
            byte[] originalBytes = readFileBytes(originalUrl);
            byte[] maskBytes = readFileBytes(maskUrl);

            // 3. 预处理蒙版：裁剪 aspectFit 区域 → 缩放到原图尺寸 → alpha 转黑白
            byte[] processedMask = preprocessMask(originalBytes, maskBytes);

            String originalBase64 = Base64.getEncoder().encodeToString(originalBytes);
            String maskBase64 = Base64.getEncoder().encodeToString(processedMask);

            // 4. 调用 IOPaint API
            byte[] resultBytes = callIOPaintAPI(originalBase64, maskBase64);

            // 5. 保存结果
            return saveResultImage(resultBytes);

        } catch (ResourceAccessException e) {
            log.error("IOPaint 服务连接失败: {}", e.getMessage());
            throw new BusinessException("AI 处理服务连接失败，请稍后重试");
        } catch (Exception e) {
            log.error("IOPaint 处理异常", e);
            throw new BusinessException("AI 处理失败: " + e.getMessage());
        }
    }

    /**
     * 预处理蒙版：
     * 前端导出的是整个画布的 PNG（灰色半透明区域 + 透明涂抹区域），需要：
     * 1. 根据 aspectFit 模式计算图片在画布中的显示区域
     * 2. 裁剪蒙版到图片显示区域
     * 3. 缩放到原图尺寸
     * 4. 将 alpha 通道转为黑白（alpha < 64 → 白色/需修复，alpha >= 64 → 黑色/保留）
     */
    private byte[] preprocessMask(byte[] originalBytes, byte[] maskBytes) throws IOException {
        BufferedImage originalImage = ImageIO.read(new ByteArrayInputStream(originalBytes));
        int origWidth = originalImage.getWidth();
        int origHeight = originalImage.getHeight();

        BufferedImage maskImage = ImageIO.read(new ByteArrayInputStream(maskBytes));
        int maskWidth = maskImage.getWidth();
        int maskHeight = maskImage.getHeight();

        log.info("蒙版预处理: 原图={}x{}, 蒙版画布={}x{}", origWidth, origHeight, maskWidth, maskHeight);

        // 1. 计算 aspectFit 显示区域（与前端 onImageLoad 中的计算一致）
        double scale = Math.min((double) maskWidth / origWidth, (double) maskHeight / origHeight);
        int displayWidth = (int) Math.round(origWidth * scale);
        int displayHeight = (int) Math.round(origHeight * scale);
        int displayX = (maskWidth - displayWidth) / 2;
        int displayY = (maskHeight - displayHeight) / 2;

        // 边界保护
        displayX = Math.max(0, displayX);
        displayY = Math.max(0, displayY);
        displayWidth = Math.min(displayWidth, maskWidth - displayX);
        displayHeight = Math.min(displayHeight, maskHeight - displayY);

        log.info("aspectFit 显示区域: x={}, y={}, w={}, h={}", displayX, displayY, displayWidth, displayHeight);

        // 2. 裁剪蒙版到图片显示区域
        BufferedImage croppedMask = maskImage.getSubimage(displayX, displayY, displayWidth, displayHeight);

        // 3. 缩放到原图尺寸（使用最近邻插值保持边界清晰）
        BufferedImage resizedMask = new BufferedImage(origWidth, origHeight, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2d = resizedMask.createGraphics();
        g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_NEAREST_NEIGHBOR);
        g2d.drawImage(croppedMask, 0, 0, origWidth, origHeight, null);
        g2d.dispose();

        // 4. 将 alpha 通道转为黑白蒙版
        //    alpha < 64 = 透明/已涂抹区域 → 白色（IOPaint 修复这些区域）
        //    alpha >= 64 = 灰色蒙版/未涂抹 → 黑色（保留不动）
        BufferedImage bwMask = new BufferedImage(origWidth, origHeight, BufferedImage.TYPE_INT_RGB);
        for (int y = 0; y < origHeight; y++) {
            for (int x = 0; x < origWidth; x++) {
                int rgba = resizedMask.getRGB(x, y);
                int alpha = (rgba >> 24) & 0xFF;
                int color = alpha < 64 ? 0xFFFFFF : 0x000000;
                bwMask.setRGB(x, y, color);
            }
        }

        // 5. 导出为 PNG
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(bwMask, "png", baos);

        log.info("蒙版预处理完成: 输出尺寸={}x{}, 文件大小={}KB", origWidth, origHeight, baos.size() / 1024);
        return baos.toByteArray();
    }

    /**
     * 获取原图的真实 URL
     */
    private String getOriginalImageUrl(Long imageId) {
        Image image = imageMapper.selectById(imageId);
        if (image == null) {
            throw new BusinessException("原图不存在: " + imageId);
        }
        return image.getOriginalUrl();
    }

    /**
     * 读取本地文件字节数组
     */
    private byte[] readFileBytes(String relativeUrl) throws IOException {
        var path = storageService.getFilePath(relativeUrl);
        return Files.readAllBytes(path);
    }

    /**
     * 调用 IOPaint REST API
     */
    private byte[] callIOPaintAPI(String imageBase64, String maskBase64) {
        String url = config.getEndpoint() + "/api/v1/inpaint";

        // 构建请求体
        Map<String, Object> body = new HashMap<>();
        body.put("image", "data:image/png;base64," + imageBase64);
        body.put("mask", "data:image/png;base64," + maskBase64);
        body.put("model", config.getModel());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        try {
            // IOPaint 返回的是直接的 PNG 图片，不是 JSON
            ResponseEntity<byte[]> response = restTemplate.exchange(url, HttpMethod.POST, request, byte[].class);

            if (response.getStatusCode() != HttpStatus.OK || response.getBody() == null) {
                throw new BusinessException("IOPaint 服务返回异常");
            }

            return response.getBody();

        } catch (ResourceAccessException e) {
            throw new BusinessException("无法连接到 IOPaint 服务: " + config.getEndpoint());
        }
    }

    /**
     * 保存处理结果到本地存储
     */
    private String saveResultImage(byte[] imageBytes) {
        try {
            // 临时文件用于上传
            String fileName = UUID.randomUUID() + ".png";
            var resultPath = java.nio.file.Paths.get("./uploads/results", fileName);
            Files.createDirectories(resultPath.getParent());
            Files.write(resultPath, imageBytes);

            String resultUrl = "/uploads/results/" + fileName;
            log.info("结果图片已保存: {}", resultUrl);
            return resultUrl;
        } catch (IOException e) {
            throw new BusinessException("保存结果图片失败");
        }
    }

    /**
     * IOPaint 未就绪时的降级处理
     */
    private String getFallbackResult(Long imageId) {
        log.warn("IOPaint 未启用，返回原图 URL");
        Image image = imageMapper.selectById(imageId);
        return image != null ? image.getOriginalUrl() : null;
    }
}