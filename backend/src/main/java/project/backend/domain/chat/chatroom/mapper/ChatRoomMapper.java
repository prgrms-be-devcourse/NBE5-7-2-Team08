package project.backend.domain.chat.chatroom.mapper;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;
import project.backend.domain.chat.chatroom.dto.ChatParticipantResponse;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;

@NoArgsConstructor(access = AccessLevel.PRIVATE)
public class ChatRoomMapper {

	public static ChatRoomResponse toResponse(ChatRoom chatRoom) {
		List<ChatParticipantResponse> participants = chatRoom.getParticipants().stream()
			.map(ChatRoomMapper::toResponse)
			.collect(Collectors.toList());

		return ChatRoomResponse.builder()
			.roomName(chatRoom.getName())
			.ownerId(chatRoom.getOwner().getId())
			.repositoryUrl(chatRoom.getRepositoryUrl())
			.participants(participants)
			.participantCount(chatRoom.getParticipants().size())
			.build();
	}

	public static ChatParticipantResponse toResponse(ChatParticipant p) {
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
}

