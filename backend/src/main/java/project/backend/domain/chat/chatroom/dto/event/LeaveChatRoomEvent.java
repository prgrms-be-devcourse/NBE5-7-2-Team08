package project.backend.domain.chat.chatroom.dto.event;

public record LeaveChatRoomEvent(Long roomId, Long memberId, String nickname) {

}
