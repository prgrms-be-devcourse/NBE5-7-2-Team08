package project.backend.domain.chat.chatroom.listener;

import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.entity.MessageType;
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

	@Async
	@EventListener
	public void handleMemberJoin(JoinChatRoomEvent joinEvent) {
		ChatRoom chatRoom = chatRoomRepository.findById(joinEvent.roomId())
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

		// 2. ChatParticipant 엔티티 조회 (입장하는 사용자)
		ChatParticipant participant = chatParticipantRepository
			.findByChatRoom_IdAndParticipant_Id(joinEvent.roomId(), joinEvent.memberId())
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

		// 3. ChatMessage 엔티티 생성 및 저장 -> 매퍼로 분리 예정
		ChatMessage chatMessage = ChatMessage.builder()
			.chatRoom(chatRoom)
			.sender(participant)
			.type(MessageType.EVENT)
			.content(joinEvent.nickname() + "님이 입장했습니다.")
			.sendAt(joinEvent.joinedAt())
			.build();

		chatMessageRepository.save(chatMessage);

		EventMessageResponse eventMessageResponse = ChatRoomMapper.toEventMessageResponse(
			joinEvent);

		// 입장 메시지 전송
		simpMessagingTemplate.convertAndSend("/topic/chat/" + joinEvent.roomId(),
			eventMessageResponse);

		// 입장한 인원에 대한 채팅방 인원 갱신 트리거
		simpMessagingTemplate.convertAndSend("/topic/chat/" + joinEvent.roomId() + "/refresh",
			joinEvent.roomId()
		);
	}
}

