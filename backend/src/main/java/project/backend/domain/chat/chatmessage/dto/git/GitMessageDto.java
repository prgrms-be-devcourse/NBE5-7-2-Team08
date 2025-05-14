package project.backend.domain.chat.chatmessage.dto.git;

import lombok.Builder;
import lombok.Data;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

@Data
@Builder
public class GitMessageDto {

    private GitEventType type;
    private String actor;
    private String content;
    private ChatRoom room;

    public static GitMessageDto create(ChatRoom room, GitEventType type, String actor,
        String content) {
        return GitMessageDto.builder()
            .room(room)
            .type(type)
            .actor(actor)
            .content(content)
            .build();
    }

}
