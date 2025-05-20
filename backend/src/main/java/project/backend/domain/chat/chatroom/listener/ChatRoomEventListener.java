package project.backend.domain.chat.chatroom.listener;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.dto.event.EventMessageResponse;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.chat.chatroom.dto.event.JoinChatRoomEvent;
import project.backend.domain.chat.chatroom.mapper.ChatRoomMapper;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.ex.ChatRoomException;

@Component
@RequiredArgsConstructor
public class ChatRoomEventListener {

	private final SimpMessagingTemplate simpMessagingTemplate;
	private final ChatMessageRepository chatMessageRepository;
	private final ChatRoomRepository chatRoomRepository;
	private final ChatParticipantRepository chatParticipantRepository;
	private final ChatMessageMapper chatMessageMapper;

	@Async
	@EventListener
	public void handleMemberJoin(JoinChatRoomEvent joinEvent) {
		ChatRoom chatRoom = getChatRoomById(joinEvent.roomId());
		ChatParticipant participant = getParticipantByRoomAndMember(joinEvent.roomId(),
			joinEvent.memberId());

		ChatMessage message = chatMessageMapper.toEntityWithEvent(chatRoom, participant, joinEvent);
		chatMessageRepository.save(message);

		EventMessageResponse eventMessageResponse = ChatRoomMapper.toEventMessageResponse(
			joinEvent);

		// 입장 메시지 전송
		simpMessagingTemplate.convertAndSend("/topic/chat/" + joinEvent.roomId(),
			eventMessageResponse);

		// 채팅방 인원 갱신 트리거 전송
		simpMessagingTemplate.convertAndSend("/topic/chat/" + joinEvent.roomId() + "/refresh",
			joinEvent.roomId());
	}

	private ChatRoom getChatRoomById(Long roomId) {
		return chatRoomRepository.findById(roomId)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));
	}

	private ChatParticipant getParticipantByRoomAndMember(Long roomId, Long memberId) {
		return chatParticipantRepository.findByChatRoom_IdAndParticipant_Id(roomId, memberId)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));
	}
}

