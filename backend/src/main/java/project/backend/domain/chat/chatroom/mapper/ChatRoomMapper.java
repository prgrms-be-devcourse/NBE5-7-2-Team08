package project.backend.domain.chat.chatroom.mapper;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatroom.dto.ChatParticipantResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse2;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;
import project.backend.domain.member.entity.Member;

@Component
public class ChatRoomMapper {

	// 강현님: 상세 응답 변환
	public static ChatRoomResponse toDetailResponse(ChatRoom chatRoom) {
		List<ChatParticipantResponse> participants = chatRoom.getParticipants().stream()
			.map(ChatRoomMapper::toParticipantResponse)
			.collect(Collectors.toList());

		return ChatRoomResponse.builder()
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
	public ChatRoomResponse2 toSimpleResponse(ChatRoom entity) {
		return ChatRoomResponse2.of(
			entity.getId(),
			entity.getName(),
			entity.getRepositoryUrl(),
			entity.getOwner().getId()
		);
	}

	// 임창인 엔티티 변환
	public ChatRoom toEntity(ChatRoomRequest dto, Member owner) {
		return ChatRoom.builder()
			.name(dto.getName())
			.createdAt(LocalDateTime.now())
			.repositoryUrl(dto.getRepositoryUrl())
			.inviteCode(UUID.randomUUID().toString())
			.owner(owner)
			.build();
	}
}