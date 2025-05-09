package project.backend.domain.chat.chatmessage.api;

import java.security.Principal;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import project.backend.domain.chat.chatmessage.app.ChatMessageService;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;

@Controller
@RequiredArgsConstructor
public class ChatMessageController {

    private final ChatMessageService chatMessageService;

    @MessageMapping("/send-message/{roomId}") //클라이언트가 메세지를 보낼 경로
    @SendTo("/topic/public") //브로드캐스트할 경로
    public ChatMessageRequest sendMessage(@DestinationVariable Long roomId,
        @Payload ChatMessageRequest request,
        Principal principal) {
        chatMessageService.save(roomId, request, principal.getName());
        return request;
    }
}
