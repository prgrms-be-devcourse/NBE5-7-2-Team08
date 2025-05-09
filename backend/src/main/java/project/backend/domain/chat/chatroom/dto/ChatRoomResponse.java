package project.backend.domain.chat.chatroom.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ChatRoomResponse {

	private Long id;
	private String name;
	private String repositoryUrl;
	private Long ownerId;

	public static ChatRoomResponse of(Long id, String name, String repositoryUrl, Long ownerId) {
		return new ChatRoomResponse(id, name, repositoryUrl, ownerId);
	}
}
