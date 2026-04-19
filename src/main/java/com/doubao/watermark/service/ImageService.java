package com.doubao.watermark.service;

import com.doubao.watermark.common.BusinessException;
import com.doubao.watermark.common.UserContext;
import com.doubao.watermark.mapper.ImageMapper;
import com.doubao.watermark.model.entity.Image;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ImageService {

    private final ImageMapper imageMapper;
    private final StorageService storageService;

    @Value("${server.servlet.context-path:}")
    private String contextPath;

    @Value("${server.port:8080}")
    private String serverPort;

    /**
     * 上传图片到本地存储
     */
    public Map<String, Object> uploadImage(MultipartFile file) {
        Long userId = UserContext.getUserId();

        // 校验
        if (file.isEmpty()) {
            throw new BusinessException("文件不能为空");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.matches("image/(jpeg|png|webp)")) {
            throw new BusinessException("仅支持JPG、PNG、WEBP格式");
        }

        if (file.getSize() > 10 * 1024 * 1024) {
            throw new BusinessException("文件大小不能超过10MB");
        }

        // 上传到本地存储
        String imageUrl = storageService.uploadFile(file, "images");

        // 保存图片记录
        Image image = new Image();
        image.setUserId(userId);
        image.setOriginalUrl(imageUrl);
        image.setFileSize(file.getSize());
        image.setFormat(contentType.split("/")[1]);
        imageMapper.insert(image);

        Map<String, Object> result = new HashMap<>();
        result.put("imageId", image.getId());
        result.put("imageUrl", imageUrl);
        // 返回完整URL，供小程序使用
        String fullUrl = "http://localhost:" + serverPort + imageUrl;
        result.put("fullImageUrl", fullUrl);
        log.info("图片上传成功, imageId: {}, fullUrl: {}", image.getId(), fullUrl);
        return result;
    }
}
