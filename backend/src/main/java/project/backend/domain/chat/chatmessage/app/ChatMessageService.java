package project.backend.domain.chat.chatmessage.app;

import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchResponse;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.global.exception.errorcode.ChatMessageErrorCode;
import project.backend.global.exception.ex.ChatMessageException;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.ex.MemberException;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.errorcode.MemberErrorCode;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

	private final ChatMessageRepository chatMessageRepository;
	private final ChatRoomRepository chatRoomRepository;
	private final MemberRepository memberRepository;
	private final ChatParticipantRepository chatParticipantRepository;

	private final ChatMessageMapper messageMapper;

	@Transactional
	public ChatMessageResponse save(Long roomId, ChatMessageRequest request, String email) {

		Member sender = memberRepository.findByEmail(email)
			.orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

		ChatRoom room = chatRoomRepository.findById(roomId)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

		ChatParticipant participant = chatParticipantRepository.findByParticipantAndChatRoom(
				sender, room)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.NOT_PARTICIPANT));

		ChatMessage message = messageMapper.toEntity(room, participant, request);
		chatMessageRepository.save(message);

		return messageMapper.toResponse(message);
	}

	@Transactional(readOnly = true)
	public Page<ChatMessageSearchResponse> searchMessages(Long roomId,
		ChatMessageSearchRequest request) {
		if (request.getKeyword() == null || request.getKeyword().trim().length() < 2) {
			throw new ChatMessageException(ChatMessageErrorCode.INVALID_KEYWORD_LENGTH);
		}
		PageRequest pageable = PageRequest.of(request.getPage(), request.getPageSize());

		Page<ChatMessage> resultPage = chatMessageRepository.searchByKeywordAndRoomId(
			request.getKeyword(),
			roomId,
			pageable
		);
		return resultPage.map(messageMapper::toSearchResponse);
	}

	@Transactional(readOnly = true)
	public List<ChatMessageResponse> getMessagesByRoomId(Long roomId) {
		chatRoomRepository.findById(roomId)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND));

		List<ChatMessage> messages = chatMessageRepository.findByChatRoom_IdOrderBySendAtAsc(
			roomId);
		return messages.stream()
			.map(messageMapper::toResponse)
			.toList();
	}
}
