package project.backend.domain.chat.chatroom.app;

import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.entity.MessageType;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;

@Service
@RequiredArgsConstructor
public class ChatRoomEventService {

	private final ChatRoomRepository chatRoomRepository;

	public void saveJoinMessage(ChatParticipant sender, ChatRoom chatRoom,
		LocalDateTime joinedAt) {
		ChatMessage.builder()
			.chatRoom(chatRoom)
			.sender(sender)
			.type(MessageType.EVENT)
			.sendAt(joinedAt)
			.content(sender.getParticipant().getNickname() + "님이 입장했습니다.")
			.build();

		chatRoomRepository.save(chatRoom);
	}
}

