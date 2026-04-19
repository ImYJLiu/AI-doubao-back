package com.doubao.watermark.service;

import com.doubao.watermark.common.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Slf4j
@Service
public class StorageService {

    @Value("${storage.local.path:./uploads}")
    private String basePath;

    private Path baseDir;

    @PostConstruct
    public void init() {
        try {
            baseDir = Paths.get(basePath).toAbsolutePath().normalize();
            Files.createDirectories(baseDir);
            log.info("存储目录已就绪: {}", baseDir);
        } catch (IOException e) {
            log.error("创建存储目录失败", e);
        }
    }

    /**
     * 上传文件到本地存储
     */
    public String uploadFile(MultipartFile file, String subDir) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("文件不能为空");
        }

        try {
            Path dir = baseDir.resolve(subDir);
            Files.createDirectories(dir);

            String originalName = file.getOriginalFilename();
            String ext = ".png";
            if (originalName != null && originalName.contains(".")) {
                ext = originalName.substring(originalName.lastIndexOf("."));
            }

            String fileName = UUID.randomUUID() + ext;
            Path filePath = dir.resolve(fileName);
            file.transferTo(filePath.toFile());

            String url = "/uploads/" + subDir + "/" + fileName;
            log.info("文件已保存: {}", filePath.toAbsolutePath());
            return url;
        } catch (IOException e) {
            log.error("文件上传失败", e);
            throw new BusinessException("文件上传失败");
        }
    }

    /**
     * 获取文件的绝对路径
     */
    public Path getFilePath(String relativeUrl) {
        String path = relativeUrl.replaceFirst("^/uploads/", "");
        return baseDir.resolve(path);
    }
}
