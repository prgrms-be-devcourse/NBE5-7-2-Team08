package project.backend.domain.chat.chatmessage.app;

import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatmessage.dao.ChatMessageSearchRepository;
import project.backend.domain.chat.chatmessage.dto.ChatMessageEditRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageResponse;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchRequest;
import project.backend.domain.chat.chatmessage.dto.ChatMessageSearchResponse;
import project.backend.domain.chat.chatmessage.entity.ChatMessage;
import project.backend.domain.chat.chatmessage.entity.ChatMessageSearch;
import project.backend.domain.chat.chatmessage.entity.MessageType;
import project.backend.domain.chat.chatmessage.mapper.ChatMessageMapper;
import project.backend.domain.chat.chatroom.app.ChatRoomService;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.imagefile.ImageFileService;
import project.backend.domain.member.app.MemberService;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;
import project.backend.global.exception.errorcode.AuthErrorCode;
import project.backend.global.exception.errorcode.ChatMessageErrorCode;
import project.backend.global.exception.ex.AuthException;
import project.backend.global.exception.ex.ChatMessageException;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.ex.MemberException;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.errorcode.MemberErrorCode;

@Service
@RequiredArgsConstructor
public class ChatMessageService {

	private final ChatMessageRepository chatMessageRepository;
	private final ChatRoomService chatRoomService;
	private final MemberService memberService;
	private final ChatParticipantRepository chatParticipantRepository;
	private final ImageFileService imageFileService;
	private final ChatRoomRepository chatRoomRepository;
	private final ChatMessageSearchRepository chatMessageSearchRepository;

	private final ChatMessageMapper messageMapper;

	@Transactional
	public ChatMessageResponse save(Long roomId, ChatMessageRequest request, String email) {

		Member sender = memberService.getMemberByEmail(email);

		ChatRoom room = chatRoomService.getRoomById(roomId);

		ChatParticipant participant = chatParticipantRepository.findByParticipantAndChatRoom(
				sender, room)
			.orElseThrow(() -> new ChatRoomException(ChatRoomErrorCode.NOT_PARTICIPANT));

		ChatMessage message;

		if (request.getType().equals(MessageType.IMAGE) && request.getImageFileId() != null) {
			ImageFile findImage = imageFileService.getImageById(request.getImageFileId());
			message = messageMapper.toEntityWithImage(room, participant, findImage);
		} else if (request.getType().equals(MessageType.TEXT)) {
			message = messageMapper.toEntityWithText(room, participant, request);
		} else if (request.getType().equals(MessageType.CODE)) {
			message = messageMapper.toEntityWithCode(room, participant, request);
		} else {
			throw new ChatMessageException(ChatMessageErrorCode.INVALID_ROUTE);
		}

		chatMessageRepository.save(message);

		// 검색용 테이블에도 저장된 메시지의 id(pk), roomId, content를 다시 뽑아서 저장
		if (isSearchable(message)) {
			ChatMessageSearch searchMessage = messageMapper.toSearchEntity(message);
			chatMessageSearchRepository.save(searchMessage);
		}

		return messageMapper.toResponse(message);
	}

	private boolean isSearchable(ChatMessage message) {
		return message.getType() != MessageType.IMAGE;
	}

	@Transactional(readOnly = true)
	public Page<ChatMessageSearchResponse> searchMessages(Long roomId,
		@Valid ChatMessageSearchRequest request) {

		String keyword = request.getKeyword();
		int page = request.getPage();
		int size = request.getPageSize();
		int offset = page * size;

		List<Long> messageIds = chatMessageSearchRepository.searchIdsByKeywordAndRoomId(keyword,
			roomId,
			size, offset);

		long totalCount = chatMessageSearchRepository.countByKeywordAndRoomId(keyword, roomId);

		List<ChatMessage> chatMessages = chatMessageRepository.findByIdInOrderBySendAtDesc(
			messageIds);

		List<ChatMessageSearchResponse> resultList = chatMessages.stream()
			.map(messageMapper::toSearchResponse).toList();

		// PageImpl 구체 클래스로 담아서 반환
		return new PageImpl<>(resultList, PageRequest.of(page, size), totalCount);
	}

	@Transactional
	public ChatMessageResponse editMessage(Long roomId, ChatMessageEditRequest request,
		String email) {

		//유효성 확인
		memberService.getMemberByEmail(email);
		chatRoomService.getRoomById(roomId);

		ChatMessage message = chatMessageRepository.findById(request.messageId())
			.orElseThrow(() -> new ChatMessageException(ChatMessageErrorCode.MESSAGE_NOT_FOUND));

		if (!message.getSender().getParticipant().getEmail().equals(email)) {
			throw new AuthException(AuthErrorCode.FORBIDDEN_MESSAGE_EDIT);
		}

		message.updateContent(request.content());

		//현재 코드 언어 변경은 받지 않고 있음 (확장성 고려)
		if (message.getType().equals(MessageType.CODE)) {
			message.updateLanguage(request.language());
		}

		if (isSearchable(message)) {
			chatMessageSearchRepository.findById(message.getId())
				.ifPresent(searchEntity -> {
					searchEntity.updateContent(message.getContent());
				});
		}

		ChatMessageResponse response = messageMapper.toResponse(message);
		response.setEdited(true);

		return response;
	}

	@Transactional
	public ChatMessageResponse deleteMessage(Long roomId, Long messageId, String email) {

		//유효성 확인
		memberService.getMemberByEmail(email);
		chatRoomService.getRoomById(roomId);

		ChatMessage message = chatMessageRepository.findById(messageId)
			.orElseThrow(() -> new ChatMessageException(ChatMessageErrorCode.MESSAGE_NOT_FOUND));

		if (!message.getSender().getParticipant().getEmail().equals(email)) {
			throw new AuthException(AuthErrorCode.FORBIDDEN_MESSAGE_DELETE);
		}

		message.delete();

		if (isSearchable(message)) {
			chatMessageSearchRepository.findById(message.getId())
				.ifPresent(ChatMessageSearch::deleteContent);
		}

		ChatMessageResponse response = messageMapper.toResponse(message);
		response.setDeleted(true);

		return response;
	}

	// 예외 처리
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