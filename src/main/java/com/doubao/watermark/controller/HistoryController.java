package com.doubao.watermark.controller;

import com.doubao.watermark.common.Result;
import com.doubao.watermark.model.vo.HistoryItemVO;
import com.doubao.watermark.service.HistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/history")
@RequiredArgsConstructor
public class HistoryController {

    private final HistoryService historyService;

    @GetMapping("/list")
    public Result<List<HistoryItemVO>> list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "all") String period
    ) {
        List<HistoryItemVO> list = historyService.getHistory(page, size, period);
        return Result.success(list);
    }

    @DeleteMapping("/{taskId}")
    public Result<?> delete(@PathVariable Long taskId) {
        historyService.deleteTask(taskId);
        return Result.success();
    }

    @PostMapping("/batch-delete")
    public Result<Map<String, Integer>> batchDelete(@RequestBody Map<String, List<Long>> body) {
        int count = historyService.batchDelete(body.get("taskIds"));
        return Result.success(Map.of("deletedCount", count));
    }
}
