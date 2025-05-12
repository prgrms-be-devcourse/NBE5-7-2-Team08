package project.backend.domain.chat.chatmessage.api;

import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.RestController;
import project.backend.domain.chat.chatmessage.app.ChatMessageService;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;

@RestController
@RequiredArgsConstructor
public class ChatMessageController {

    private final ChatMessageService chatMessageService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/send-message/{roomId}") //클라이언트가 메세지를 보낼 경로
    public ChatMessageResponse sendMessage(@DestinationVariable Long roomId,
        @Payload ChatMessageRequest request, Principal principal) {
        ChatMessageResponse response = chatMessageService.save(roomId, request,
            principal.getName());

        messagingTemplate.convertAndSend("/topic/chat/" + roomId, response);

        return response;
    }
}
