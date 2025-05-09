package project.backend.domain.chat.chatroom.app;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.chat.chatroom.mapper.ChatRoomMapper;
import project.backend.domain.member.dao.MemberRepository;
import project.backend.domain.member.entity.Member;

@Service
@RequiredArgsConstructor
public class ChatRoomService {

	private final ChatRoomRepository chatRoomRepository;
	private final MemberRepository memberRepository;
	private final ChatRoomMapper chatRoomMapper;

	@Transactional
	public ChatRoomResponse createChatRoom(ChatRoomRequest request, Long ownerId) {
		Member owner = memberRepository.findById(ownerId)
			.orElseThrow(() -> new IllegalArgumentException("없는 사용자"));

		ChatRoom chatRoom = chatRoomMapper.toEntity(request, owner);

		ChatRoom savedRoom = chatRoomRepository.save(chatRoom);

		return chatRoomMapper.toResponse(savedRoom);
	}

}
