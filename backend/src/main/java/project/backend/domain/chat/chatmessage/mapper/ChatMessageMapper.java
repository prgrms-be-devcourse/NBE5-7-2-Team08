package project.backend.domain.chat.chatmessage.mapper;

import org.springframework.stereotype.Component;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

@Component
public class ChatMessageMapper {

    public ChatMessage toEntity(ChatRoom room, ChatParticipant sender, ChatMessageRequest request) {
        return ChatMessage.builder()
            .chatRoom(room)
            .sender(sender)
            .content(request.getContent())
            .type(request.getType())
            .build();

    }

    public ChatMessageResponse toResponse(ChatMessage message) {
        String senderName = message.getSender().getParticipant().getNickname();

        return ChatMessageResponse.builder()
            .senderName(senderName)
            .content(message.getContent())
            .type(message.getType())
            .sendAt(message.getSendAt())
            .build();
    }

}
