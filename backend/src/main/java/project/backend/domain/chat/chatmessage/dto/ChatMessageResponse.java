package project.backend.domain.chat.chatmessage.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;
import project.backend.domain.chat.chatmessage.entity.MessageType;

@Data
@Builder
public class ChatMessageResponse {

    private String content;
    private String senderName;
    private LocalDateTime sendAt;
    private MessageType type;
    private String language;
    private Long senderId; //사용자 식별을 위한 id 추가

}
