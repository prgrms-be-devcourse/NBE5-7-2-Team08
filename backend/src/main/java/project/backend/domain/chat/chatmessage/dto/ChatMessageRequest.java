package project.backend.domain.chat.chatmessage.dto;

import lombok.Data;
import project.backend.domain.chat.chatmessage.entity.MessageType;

@Data
public class ChatMessageRequest {

    private String content;
    private MessageType type;

}
