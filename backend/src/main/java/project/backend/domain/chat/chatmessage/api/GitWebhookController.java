package project.backend.domain.chat.chatmessage.api;

import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatmessage.app.GitMessageService;

@RestController
@RequestMapping("/github")
@RequiredArgsConstructor
public class GitWebhookController {

    private final GitMessageService gitMessageService;

//    @PostMapping("/{roomId}")
//    public Map<String, Object> receiveWebhook(@PathVariable Long roomId,
//        @RequestBody Map<String, Object> payload) {
//        gitMessageService.handleWebhook(roomId, payload);
//        return payload;
//    }

    @PostMapping("/{roomId}")
    public void handleWebhook(@PathVariable Long roomId,
        @RequestBody Map<String, Object> payload,
        @RequestHeader("X-GitHub-Event") String eventType) {

        gitMessageService.handleEvent(roomId, eventType, payload);
    }

}
