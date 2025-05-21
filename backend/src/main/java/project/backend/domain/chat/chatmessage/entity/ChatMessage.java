package project.backend.domain.chat.chatmessage.entity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Lob;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import project.backend.domain.chat.chatroom.entity.ChatParticipant;
import project.backend.domain.chat.chatroom.entity.ChatRoom;
import project.backend.domain.imagefile.ImageFile;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	@Column(name = "message_id")
	private Long id;

	@Setter
    @ManyToOne
	@JoinColumn(name = "sender_id")
	private ChatParticipant sender;

	@ManyToOne
	@JoinColumn(name = "room_id")
	private ChatRoom chatRoom;

	@Lob
	@Column(columnDefinition = "TEXT")
	private String content;

	private LocalDateTime sendAt;

	@Enumerated(EnumType.STRING)
	private MessageType type = MessageType.TEXT;

	private String codeLanguage; //추가, 문법마다 다르게 하이라이팅을 하기 위함

	@OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
	@JoinColumn(name = "chat_image_id")
	private ImageFile chatImage;

	private boolean isEdited = false;
	private boolean isDeleted = false;

	@Builder
	public ChatMessage(ChatParticipant sender, ChatRoom chatRoom, String content,
		LocalDateTime sendAt,
		MessageType type, String codeLanguage, ImageFile chatImage) {
		this.sender = sender;
		this.chatRoom = chatRoom;
		this.content = content;
		this.sendAt = sendAt;
		this.type = type;
		this.codeLanguage = codeLanguage;
		this.chatImage = chatImage;
	}

	public void updateContent(String newContent) {
		if (newContent != null) {
			this.content = newContent;
			isEdited = true;
		}
	}

	public void updateLanguage(String language) {
		if (language != null) {
			this.codeLanguage = language;
			isEdited = true;
		}
	}

	public void delete() {
		this.isDeleted = true;
	}

}
