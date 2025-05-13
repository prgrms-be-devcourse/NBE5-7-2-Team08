package project.backend.domain.chat.chatroom.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
//임창인
public class ChatRoomResponse2 {

	private Long id;
	private String name;
	private String repositoryUrl;
	private Long ownerId;

	public static ChatRoomResponse2 of(Long id, String name, String repositoryUrl, Long ownerId) {
		return new ChatRoomResponse2(id, name, repositoryUrl, ownerId);
	}
}
