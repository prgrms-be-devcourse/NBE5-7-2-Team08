package project.backend.domain.chat.chatmessage.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Getter;
import project.backend.domain.chat.chatmessage.entity.MessageType;

@Getter
@Builder
public class ChatMessageSearchResponse {

	private Long messageId;

	private String content;

	private MessageType type;

	private String senderId;

	private LocalDateTime sendAt;
}

