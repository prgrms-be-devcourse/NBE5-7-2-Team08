package project.backend.domain.chat.chatroom.app;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import project.backend.domain.chat.chatmessage.dao.ChatMessageRepository;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.chat.chatroom.mapper.ChatRoomMapper;
import project.backend.global.exception.errorcode.MemberErrorCode;
import project.backend.global.exception.ex.ChatRoomException;
import project.backend.global.exception.errorcode.ChatRoomErrorCode;
import project.backend.global.exception.ex.MemberException;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

	private final ChatRoomRepository chatRoomRepository;
	private final ChatMessageRepository chatMessageRepository;
	private final ChatParticipantRepository chatParticipantRepository;

	@Transactional(readOnly = true)
	public Long getMostRecentRoomId(String email) {

		// 1순위: 가장 최근 메시지가 도착한 채팅방
		Optional<Long> recentRoomId = chatMessageRepository.findMostRecentRoomIdByMemberEmail(
			email);
		if (recentRoomId.isPresent()) {
			return recentRoomId.get();
		}

		// 2순위: 채팅방에 메세지가 없을 때 참여중인 채팅방 중 roomId가 가장 큰 채팅방
		Optional<Long> fallbackRoomId = chatParticipantRepository.findMostLargeRoomIdByEmail(email);
		if (fallbackRoomId.isPresent()) {
			return fallbackRoomId.get();
		}

		// 아무 채팅방에도 참여한 적이 없음 → 예외 던지기
		throw new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_EXIST);

	}

	@Transactional(readOnly = true)
	public Page<ChatRoomResponse> findAllByMemberId(Long memberId, Pageable pageable) {

		chatRoomRepository.findById(memberId)
			.orElseThrow(() -> new MemberException(MemberErrorCode.MEMBER_NOT_FOUND));

		Page<ChatRoom> chatRooms = chatRoomRepository.findAllRoomsByMemberId(memberId, pageable);
		if (chatRooms.isEmpty()) {
			throw new ChatRoomException(ChatRoomErrorCode.CHATROOM_NOT_FOUND);
		}
		return chatRooms.map(ChatRoomMapper::toResponse);
	}
}
