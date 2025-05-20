package project.backend.domain.chat.chatmessage.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessageSearch {

	@Id
	// chat_message의 id를 그대로 넣어줌
	private Long id;

	@Column(name = "room_id", nullable = false)
	private Long roomId;

	@Column(name = "content", nullable = false)
	private String content;

	@Builder
	public ChatMessageSearch(Long id, Long roomId, String content) {
		this.id = id;
		this.roomId = roomId;
		this.content = content;
	}
}