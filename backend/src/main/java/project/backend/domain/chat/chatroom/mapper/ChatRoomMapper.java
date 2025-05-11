package project.backend.domain.chat.chatroom.mapper;

import java.time.LocalDateTime;
import java.util.UUID;
import org.springframework.stereotype.Component;
import project.backend.domain.chat.chatroom.dto.ChatRoomRequest;
import project.backend.domain.chat.chatroom.dto.ChatRoomResponse;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.member.entity.Member;

@Component
public class ChatRoomMapper {

	public ChatRoom toEntity(ChatRoomRequest dto, Member owner){
		return ChatRoom.builder()
			.name(dto.getName())
			.createdAt(LocalDateTime.now())
			.repositoryUrl(dto.getRepositoryUrl())
			.inviteCode(UUID.randomUUID().toString())
			.owner(owner)
			.build();
	}

	public ChatRoomResponse toResponse(ChatRoom entity){
		return ChatRoomResponse.of(
			entity.getId(),
			entity.getName(),
			entity.getRepositoryUrl(),
			entity.getOwner().getId()
		);
	}

}
