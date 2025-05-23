package project.backend.domain.chat.chatmessage.dto;

import java.time.LocalDateTime;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import project.backend.domain.chat.chatmessage.entity.MessageType;

@Getter
@Builder
public class ChatMessageResponse {

    private String content;
    private String senderName;
    private LocalDateTime sendAt;
    private MessageType type;
    private String language;
    private String profileImageUrl;
    private String chatImageUrl;
    private Long senderId;
    private Long messageId;
    @Setter
    private boolean isDeleted;
    @Setter
    private boolean isEdited;

}
