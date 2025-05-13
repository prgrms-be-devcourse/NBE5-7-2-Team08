package project.backend.domain.chat.chatroom.mapper;

import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Component;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse2;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.entity.Member;

@Component
public class ChatRoomMapper2 {

	public ChatRoom toEntity(ChatRoomRequest dto, Member owner) {
		return ChatRoom.builder()
			.name(dto.getName())
			.createdAt(LocalDateTime.now())
			.repositoryUrl(dto.getRepositoryUrl())
			.inviteCode(UUID.randomUUID().toString())
			.owner(owner)
			.build();
	}

	public ChatRoomResponse2 toResponse(ChatRoom entity) {
		return ChatRoomResponse2.of(
			entity.getId(),
			entity.getName(),
			entity.getRepositoryUrl(),
			entity.getOwner().getId()
		);
	}

}
