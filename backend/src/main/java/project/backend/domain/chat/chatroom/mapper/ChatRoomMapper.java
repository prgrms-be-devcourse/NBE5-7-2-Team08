package project.backend.domain.chat.chatroom.mapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import project.backend.domain.chat.chatroom.dto.ChatParticipantResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomDetailResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomSimpleResponse;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.member.entity.Member;

@Component
public class ChatRoomMapper {

	// 강현님: 상세 응답 변환
	public static ChatRoomDetailResponse toDetailResponse(ChatRoom chatRoom) {
		List<ChatParticipantResponse> participants = chatRoom.getParticipants().stream()
			.map(ChatRoomMapper::toParticipantResponse)
			.collect(Collectors.toList());

		return ChatRoomDetailResponse.builder()
			.roomName(chatRoom.getName())
			.ownerId(chatRoom.getOwner().getId())
			.repositoryUrl(chatRoom.getRepositoryUrl())
			.participants(participants)
			.participantCount(chatRoom.getParticipants().size())
			.build();
	}

	// 강현님: 참여자 응답 변환
	public static ChatParticipantResponse toParticipantResponse(ChatParticipant p) {
		return ChatParticipantResponse.builder()
			.memberId(p.getParticipant().getId())
			.nickname(p.getParticipant().getNickname())
			.profileImageUrl(
				Optional.ofNullable(p.getParticipant().getProfileImage())
					.map(ImageFile::getUploadFileName)
					.orElse("default_image.jpg"))
			.isOwner(p.getParticipant().getId().equals(p.getChatRoom().getOwner().getId()))
			.build();
	}


	// 임창인: 간단 응답 변환
	public ChatRoomSimpleResponse toSimpleResponse(ChatRoom entity) {
		return ChatRoomSimpleResponse.of(
			entity.getId(),
			entity.getName(),
			entity.getRepositoryUrl(),
			entity.getOwner().getId(),
			entity.getInviteCode()
		);
	}

	// 임창인 엔티티 변환
	public ChatRoom toEntity(ChatRoomRequest dto, Member owner) {
		return ChatRoom.builder()
			.name(dto.getName())
			.createdAt(LocalDateTime.now())
			.repositoryUrl(dto.getRepositoryUrl())
			.inviteCode(generateInviteCode())
			.owner(owner)
			.build();
	}

	private String generateInviteCode() {
		return UUID.randomUUID().toString();
	}
}