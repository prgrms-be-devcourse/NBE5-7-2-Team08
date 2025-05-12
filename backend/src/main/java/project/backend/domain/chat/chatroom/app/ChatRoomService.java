package project.backend.domain.chat.chatroom.app;

import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import project.backend.domain.chat.chatroom.dao.ChatParticipantRepository;
import project.backend.domain.chat.chatroom.dao.ChatRoomRepository;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
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
	private final ChatParticipantRepository chatParticipantRepository;

	@Transactional
	public ChatRoomResponse createChatRoom(ChatRoomRequest request, Long ownerId) {
		Member owner = memberRepository.findById(ownerId)
			.orElseThrow(() -> new IllegalArgumentException("없는 사용자"));

		ChatRoom chatRoom = chatRoomMapper.toEntity(request, owner);

		ChatRoom savedRoom = chatRoomRepository.save(chatRoom);

		ChatParticipant chatParticipant = ChatParticipant.builder()
			.participant(owner)
			.chatRoom(savedRoom)
			.build();

		chatParticipantRepository.save(chatParticipant);

		return chatRoomMapper.toResponse(savedRoom);
	}

	@Transactional
	public String getInviteCode(Long roomId) {
		ChatRoom room = chatRoomRepository.findById(roomId)
			.orElseThrow(() -> new EntityNotFoundException("채팅방이 없습니다"));

		return room.getInviteCode();
	}

	@Transactional
	public void joinChatRoom(String inviteCode, Long memberId) {
		ChatRoom room = chatRoomRepository.findByInviteCode(inviteCode)
			.orElseThrow(() -> new EntityNotFoundException("존재하지 않는 초대코드입니다"));

		Member member = memberRepository.findById(memberId)
			.orElseThrow(() -> new IllegalArgumentException("없는 사용자 입니다"));

		boolean isAlreadyParticipant = chatParticipantRepository
			.existsByParticipantIdAndChatRoomId(memberId, room.getId());

		if (isAlreadyParticipant) {
			throw new IllegalStateException("이미 채팅방에 참여 중입니다");
		}

		ChatParticipant chatParticipant = ChatParticipant.builder()
			.participant(member)
			.chatRoom(room)
			.build();

		chatParticipantRepository.save(chatParticipant);
	}
}

