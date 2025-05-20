package project.backend.domain.chat.chatroom.dto.event;

import java.time.LocalDateTime;

public record JoinChatRoomEvent(Long roomId, Long memberId, String nickname,
								LocalDateTime joinedAt) {

}

